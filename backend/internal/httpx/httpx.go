package httpx

import (
	"errors"
	"log"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// APIError is the single error shape every endpoint returns.
type APIError struct {
	Status  int               `json:"-"`
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

func (e *APIError) Error() string { return e.Code + ": " + e.Message }

func New(status int, code, message string) *APIError {
	return &APIError{Status: status, Code: code, Message: message}
}

func Validation(fields map[string]string) *APIError {
	return &APIError{Status: http.StatusBadRequest, Code: "validation_failed", Message: "some fields are invalid", Fields: fields}
}

var ErrNotFound = New(http.StatusNotFound, "not_found", "resource not found")

// Abort writes err in the standard error format and stops the handler chain.
func Abort(c *gin.Context, err error) {
	var apiErr *APIError
	var pgErr *pgconn.PgError
	switch {
	case errors.As(err, &apiErr):
	case errors.Is(err, pgx.ErrNoRows):
		apiErr = ErrNotFound
	case errors.As(err, &pgErr) && pgErr.Code == "23505":
		apiErr = New(http.StatusConflict, "conflict", "resource already exists")
	case errors.As(err, &pgErr) && pgErr.Code == "23503":
		apiErr = New(http.StatusBadRequest, "invalid_reference", "referenced resource does not exist")
	default:
		log.Printf("internal error: %v", err)
		apiErr = New(http.StatusInternalServerError, "internal_error", "something went wrong")
	}
	c.AbortWithStatusJSON(apiErr.Status, gin.H{"error": apiErr})
}

func Recovery() gin.HandlerFunc {
	return gin.CustomRecovery(func(c *gin.Context, rec any) {
		log.Printf("panic: %v", rec)
		Abort(c, New(http.StatusInternalServerError, "internal_error", "something went wrong"))
	})
}

// ParseID reads a positive integer path parameter; it answers 404 when invalid.
func ParseID(c *gin.Context, name string) (int64, bool) {
	id, err := strconv.ParseInt(c.Param(name), 10, 64)
	if err != nil || id <= 0 {
		Abort(c, ErrNotFound)
		return 0, false
	}
	return id, true
}

// MaxJSONBytes caps JSON request bodies.
const MaxJSONBytes = 1 << 20

// BindJSON decodes the request body into dst; it answers 400 invalid_json on
// failure and 413 body_too_large when the body exceeds MaxJSONBytes.
func BindJSON(c *gin.Context, dst any) bool {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxJSONBytes)
	if err := c.ShouldBindJSON(dst); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			Abort(c, New(http.StatusRequestEntityTooLarge, "body_too_large", "request body is too large"))
			return false
		}
		Abort(c, New(http.StatusBadRequest, "invalid_json", "request body is not valid JSON"))
		return false
	}
	return true
}

// RequireScope fails closed for scoped handlers: when scope returns no positive shop id,
// the request is refused instead of being treated as unrestricted admin access.
func RequireScope(scope func(*gin.Context) int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if scope(c) <= 0 {
			Abort(c, New(http.StatusUnauthorized, "unauthorized", "login required"))
			return
		}
		c.Next()
	}
}
