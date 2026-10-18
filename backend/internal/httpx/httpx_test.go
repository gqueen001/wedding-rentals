package httpx_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"wedding-rentals/backend/internal/httpx"
)

type errBody struct {
	Error struct {
		Code   string            `json:"code"`
		Fields map[string]string `json:"fields"`
	} `json:"error"`
}

func TestAbortMapsErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)
	cases := []struct {
		name   string
		err    error
		status int
		code   string
	}{
		{"validation", httpx.Validation(map[string]string{"phone": "required"}), 400, "validation_failed"},
		{"no rows", fmt.Errorf("get: %w", pgx.ErrNoRows), 404, "not_found"},
		{"unique", &pgconn.PgError{Code: "23505"}, 409, "conflict"},
		{"foreign key", &pgconn.PgError{Code: "23503"}, 400, "invalid_reference"},
		{"unknown", errors.New("boom"), 500, "internal_error"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(rec)
			httpx.Abort(c, tc.err)
			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d", rec.Code, tc.status)
			}
			var body errBody
			if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if body.Error.Code != tc.code {
				t.Fatalf("code = %q, want %q", body.Error.Code, tc.code)
			}
		})
	}
}

func TestValidationIncludesFields(t *testing.T) {
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	httpx.Abort(c, httpx.Validation(map[string]string{"phone": "required"}))
	var body errBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body.Error.Fields["phone"] != "required" {
		t.Fatalf("fields = %v", body.Error.Fields)
	}
}

func TestRecoveryReturnsJSON500(t *testing.T) {
	r := gin.New()
	r.Use(httpx.Recovery())
	r.GET("/panic", func(c *gin.Context) { panic("kaboom") })
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/panic", nil))
	if rec.Code != 500 {
		t.Fatalf("status = %d", rec.Code)
	}
	var body errBody
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	if body.Error.Code != "internal_error" {
		t.Fatalf("code = %q", body.Error.Code)
	}
}

func TestParseIDRejectsNonNumeric(t *testing.T) {
	r := gin.New()
	r.GET("/x/:id", func(c *gin.Context) {
		if id, ok := httpx.ParseID(c, "id"); ok {
			c.JSON(200, gin.H{"id": id})
		}
	})
	for path, want := range map[string]int{"/x/12": 200, "/x/abc": 404, "/x/0": 404} {
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		if rec.Code != want {
			t.Errorf("%s: status = %d, want %d", path, rec.Code, want)
		}
	}
}
