package cities_test

import (
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"

	"wedding-rentals/backend/internal/cities"
	"wedding-rentals/backend/internal/testutil"
)

func TestListCities(t *testing.T) {
	r := gin.New()
	(&cities.Handler{DB: testutil.Tx(t)}).RegisterPublic(r.Group("/api"))
	rec := testutil.Request(t, r, http.MethodGet, "/api/cities", nil, "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	body := testutil.Decode[struct{ Items []cities.City }](t, rec)
	if len(body.Items) != 9 {
		t.Fatalf("got %d cities", len(body.Items))
	}
	first := body.Items[0]
	if first.Slug != "ashgabat" || first.NameTK != "Aşgabat" || first.NameRU != "Ашхабад" {
		t.Fatalf("first city = %+v", first)
	}
}
