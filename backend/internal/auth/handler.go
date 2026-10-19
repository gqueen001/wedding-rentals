package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

const AdminIDKey = "admin_id"

var (
	errInvalidCredentials = httpx.New(http.StatusUnauthorized, "invalid_credentials", "email or password is wrong")
	errUnauthorized       = httpx.New(http.StatusUnauthorized, "unauthorized", "login required")
	errRateLimited        = httpx.New(http.StatusTooManyRequests, "rate_limited", "too many login attempts, try again in a minute")
)

// dummyHash keeps login timing similar whether or not the email exists.
var dummyHash, _ = HashPassword("timing-equalizer-password")

type Handler struct {
	DB      db.DBTX
	Tokens  *Tokens
	Limiter *Limiter
}

func (h *Handler) RegisterPublic(g *gin.RouterGroup) {
	g.POST("/admin/login", h.login)
}

func (h *Handler) login(c *gin.Context) {
	if !h.Limiter.Allow(c.ClientIP()) {
		httpx.Abort(c, errRateLimited)
		return
	}
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !httpx.BindJSON(c, &in) {
		return
	}
	a, err := findAdminByEmail(c.Request.Context(), h.DB, normalizeEmail(in.Email))
	if errors.Is(err, pgx.ErrNoRows) {
		CheckPassword(dummyHash, in.Password)
		httpx.Abort(c, errInvalidCredentials)
		return
	}
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	if !CheckPassword(a.PasswordHash, in.Password) {
		httpx.Abort(c, errInvalidCredentials)
		return
	}
	token, err := h.Tokens.Issue(a.ID)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token})
}

// Middleware rejects requests without a valid admin bearer token.
func Middleware(t *Tokens) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
		if !ok || token == "" {
			httpx.Abort(c, errUnauthorized)
			return
		}
		id, err := t.Verify(token)
		if err != nil {
			httpx.Abort(c, errUnauthorized)
			return
		}
		c.Set(AdminIDKey, id)
		c.Next()
	}
}
