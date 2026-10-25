package owners

import (
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
	"wedding-rentals/backend/internal/shops"
)

const minPassword = 6

const maxPasswordBytes = 72 // bcrypt's limit

var (
	errInvalidCredentials = httpx.New(http.StatusUnauthorized, "invalid_credentials", "phone or password is wrong")
	errRateLimited        = httpx.New(http.StatusTooManyRequests, "rate_limited", "too many attempts, try again in a minute")
	// The 15 minutes is server.go's default PhoneLimiter window.
	errTooManyAttempts = httpx.New(http.StatusTooManyRequests, "too_many_attempts", "too many wrong passwords for this number, try again in 15 minutes")
)

// dummyHash keeps sign-in timing similar whether or not the phone exists.
var dummyHash, _ = auth.HashPassword("timing-equalizer-password")

type Handler struct {
	DB      db.DBTX
	Tokens  *auth.Tokens
	Limiter *auth.Limiter
	// PhoneLimiter counts wrong passwords per phone number (the number is public, so a per-IP
	// limit alone lets many devices try one account).
	PhoneLimiter *auth.Limiter
}

// RegisterPublic adds sign-up and sign-in under /shop.
func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.POST("/shop/signup", h.signup)
	g.POST("/shop/login", h.login)
}

// RegisterShop adds the signed-in owner's own endpoints; g must use ShopMiddleware.
func (h *Handler) RegisterShop(g *gin.RouterGroup) {
	g.GET("/me", h.me)
	g.PUT("/me/shop", h.updateShop)
}

// RegisterAdmin adds the admin's owner tools; g must use the admin middleware.
func (h *Handler) RegisterAdmin(g *gin.RouterGroup) {
	g.POST("/shops/:id/owner-password", h.setPassword)
}

type signupInput struct {
	ShopName string `json:"shop_name"`
	CityID   int64  `json:"city_id"`
	Address  string `json:"address"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

func (h *Handler) signup(c *gin.Context) {
	if !h.Limiter.Allow(c.ClientIP()) {
		httpx.Abort(c, errRateLimited)
		return
	}
	var in signupInput
	if !httpx.BindJSON(c, &in) {
		return
	}
	ctx := c.Request.Context()
	phone, phoneOK := NormalizePhone(in.Phone)
	shop := shops.Input{Name: in.ShopName, CityID: in.CityID, Address: in.Address, Phone: phone, IsPublished: true}
	shopErrs, err := shops.Check(ctx, h.DB, &shop)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	// The phone is checked below with its own, stricter rule.
	errs := map[string]string{}
	for field, code := range shopErrs {
		switch field {
		case "name":
			errs["shop_name"] = code
		case "city_id", "address":
			errs[field] = code
		}
	}
	if !phoneOK {
		errs["phone"] = "invalid"
	} else if taken, err := phoneTaken(ctx, h.DB, phone); err != nil {
		httpx.Abort(c, err)
		return
	} else if taken {
		errs["phone"] = "taken"
	}
	if utf8.RuneCountInString(in.Password) < minPassword {
		errs["password"] = "too_short"
	} else if len(in.Password) > maxPasswordBytes {
		errs["password"] = "too_long"
	} else if commonPassword(in.Password, phoneIf(phoneOK, phone)) {
		errs["password"] = "too_common"
	}
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	o, err := create(ctx, h.DB, shop, phone, hash)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" && strings.Contains(pgErr.ConstraintName, "phone") {
		// Two sign-ups raced for the same phone.
		httpx.Abort(c, httpx.Validation(map[string]string{"phone": "taken"}))
		return
	}
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	h.respondWithToken(c, http.StatusCreated, o)
}

func (h *Handler) login(c *gin.Context) {
	if !h.Limiter.Allow(c.ClientIP()) {
		httpx.Abort(c, errRateLimited)
		return
	}
	var in struct {
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}
	if !httpx.BindJSON(c, &in) {
		return
	}
	phone, ok := NormalizePhone(in.Phone)
	// Each try is counted before the password is checked and taken back when it is right, so parallel
	// tries can't slip past the limit. Unknown numbers count too, so the answer never tells whether an
	// account exists; input that is not a phone number can't match an account and isn't counted.
	if ok && !h.PhoneLimiter.Allow(phone) {
		httpx.Abort(c, errTooManyAttempts)
		return
	}
	o, err := byPhone(c.Request.Context(), h.DB, phone)
	if errors.Is(err, pgx.ErrNoRows) {
		auth.CheckPassword(dummyHash, in.Password)
		httpx.Abort(c, errInvalidCredentials)
		return
	}
	if err != nil {
		h.PhoneLimiter.Undo(phone) // a server error is not a wrong password
		httpx.Abort(c, err)
		return
	}
	if !auth.CheckPassword(o.PasswordHash, in.Password) {
		httpx.Abort(c, errInvalidCredentials)
		return
	}
	h.PhoneLimiter.Undo(phone)
	h.respondWithToken(c, http.StatusOK, o)
}

func (h *Handler) respondWithToken(c *gin.Context, status int, o Owner) {
	token, err := h.Tokens.IssueShop(o.ID, o.TokenVersion)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(status, gin.H{"token": token})
}

// Me is the signed-in owner and their shop.
type Me struct {
	ID    int64      `json:"id"`
	Phone string     `json:"phone"`
	Shop  shops.Shop `json:"shop"`
}

func (h *Handler) me(c *gin.Context) {
	s, err := shops.Get(c.Request.Context(), h.DB, ShopID(c))
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, Me{ID: c.GetInt64(ownerIDKey), Phone: c.GetString(ownerPhoneKey), Shop: s})
}

// updateShop saves the owner's shop details. It never writes is_published, so an admin
// hiding the shop at any moment stays hidden: only admins can hide or show a shop.
func (h *Handler) updateShop(c *gin.Context) {
	var in shops.Input
	if !httpx.BindJSON(c, &in) {
		return
	}
	ctx := c.Request.Context()
	id := ShopID(c)
	errs, err := shops.Check(ctx, h.DB, &in)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	if len(errs) > 0 {
		httpx.Abort(c, httpx.Validation(errs))
		return
	}
	if err := shops.UpdateDetails(ctx, h.DB, id, in); err != nil {
		httpx.Abort(c, err)
		return
	}
	s, err := shops.Get(ctx, h.DB, id)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, s)
}

func (h *Handler) setPassword(c *gin.Context) {
	shopID, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	var in struct {
		Password string `json:"password"`
	}
	if !httpx.BindJSON(c, &in) {
		return
	}
	if utf8.RuneCountInString(in.Password) < minPassword {
		httpx.Abort(c, httpx.Validation(map[string]string{"password": "too_short"}))
		return
	}
	if len(in.Password) > maxPasswordBytes {
		httpx.Abort(c, httpx.Validation(map[string]string{"password": "too_long"}))
		return
	}
	if commonPassword(in.Password, "") {
		httpx.Abort(c, httpx.Validation(map[string]string{"password": "too_common"}))
		return
	}
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	phone, err := setPasswordForShop(c.Request.Context(), h.DB, shopID, hash)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	// An owner locked out by wrong passwords can sign in with the new one straight away.
	h.PhoneLimiter.Reset(phone)
	c.Status(http.StatusNoContent)
}

// phoneIf is phone when ok, else "": a password only matches the number when the number is valid.
func phoneIf(ok bool, phone string) string {
	if ok {
		return phone
	}
	return ""
}
