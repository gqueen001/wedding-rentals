package images

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"wedding-rentals/backend/internal/db"
	"wedding-rentals/backend/internal/httpx"
)

const MaxUploadBytes = 10 << 20

var (
	errTooLarge     = httpx.New(http.StatusRequestEntityTooLarge, "file_too_large", "image must be 10 MB or smaller")
	errInvalidImage = httpx.New(http.StatusUnprocessableEntity, "invalid_image", "file must be a JPEG, PNG or WebP image")
)

type Handler struct {
	DB      db.DBTX
	Storage Storage
}

func (h *Handler) RegisterAdmin(g *gin.RouterGroup) {
	g.POST("/images", h.upload)
	g.PATCH("/images/order", h.reorder)
	g.DELETE("/images/:id", h.delete)
}

type owner struct{ listingID, shopID int64 }

func (h *Handler) upload(c *gin.Context) {
	const slack = 1 << 20 // room for multipart headers and fields
	if c.Request.ContentLength > MaxUploadBytes+slack {
		httpx.Abort(c, errTooLarge)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxUploadBytes+slack)
	fh, err := c.FormFile("file")
	if err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			httpx.Abort(c, errTooLarge)
			return
		}
		httpx.Abort(c, httpx.Validation(map[string]string{"file": "required"}))
		return
	}
	if fh.Size > MaxUploadBytes {
		httpx.Abort(c, errTooLarge)
		return
	}
	ctx := c.Request.Context()
	o, ok := h.parseOwner(c)
	if !ok {
		return
	}
	f, err := fh.Open()
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	data, err := io.ReadAll(f)
	f.Close()
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	p, err := Process(data)
	if errors.Is(err, ErrUnsupported) {
		httpx.Abort(c, errInvalidImage)
		return
	}
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	small, large := newNames()
	if err := h.Storage.Save(small, p.Small); err != nil {
		httpx.Abort(c, err)
		return
	}
	if err := h.Storage.Save(large, p.Large); err != nil {
		DeleteFiles(h.Storage, []string{small})
		httpx.Abort(c, err)
		return
	}
	img, oldFiles, err := insert(ctx, h.DB, o, small, large, p)
	if err != nil {
		DeleteFiles(h.Storage, []string{small, large})
		httpx.Abort(c, err)
		return
	}
	DeleteFiles(h.Storage, oldFiles)
	c.JSON(http.StatusCreated, img)
}

// parseOwner requires exactly one existing listing_id or shop_id.
func (h *Handler) parseOwner(c *gin.Context) (owner, bool) {
	l, _ := strconv.ParseInt(c.PostForm("listing_id"), 10, 64)
	s, _ := strconv.ParseInt(c.PostForm("shop_id"), 10, 64)
	if (l > 0) == (s > 0) {
		httpx.Abort(c, httpx.Validation(map[string]string{"owner": "exactly_one_of_listing_id_or_shop_id"}))
		return owner{}, false
	}
	table, field, id := "listings", "listing_id", l
	if s > 0 {
		table, field, id = "shops", "shop_id", s
	}
	var exists bool
	if err := h.DB.QueryRow(c.Request.Context(), `SELECT EXISTS(SELECT 1 FROM `+table+` WHERE id = $1)`, id).Scan(&exists); err != nil {
		httpx.Abort(c, err)
		return owner{}, false
	}
	if !exists {
		httpx.Abort(c, httpx.Validation(map[string]string{field: "invalid"}))
		return owner{}, false
	}
	return owner{listingID: l, shopID: s}, true
}

func newNames() (small, large string) {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	id := hex.EncodeToString(b)
	return id[:2] + "/" + id + "_s.jpg", id[:2] + "/" + id + "_l.jpg"
}

// insert stores the image row. For a shop it replaces the previous logo and
// returns the old logo's files so the caller can delete them after commit.
func insert(ctx context.Context, d db.DBTX, o owner, small, large string, p Processed) (Image, []string, error) {
	img := Image{Small: URL(small), Large: URL(large), Width: p.Width, Height: p.Height}
	var oldFiles []string
	err := db.InTx(ctx, d, func(tx pgx.Tx) error {
		if o.listingID > 0 {
			return tx.QueryRow(ctx, `
				INSERT INTO images (listing_id, position, path_small, path_large, width, height)
				VALUES ($1, (SELECT COALESCE(max(position) + 1, 0) FROM images WHERE listing_id = $1), $2, $3, $4, $5)
				RETURNING id, position`, o.listingID, small, large, p.Width, p.Height).Scan(&img.ID, &img.Position)
		}
		rows, err := tx.Query(ctx, `DELETE FROM images WHERE shop_id = $1 RETURNING path_small, path_large`, o.shopID)
		if err != nil {
			return err
		}
		if oldFiles, err = collectPaths(rows); err != nil {
			return err
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO images (shop_id, position, path_small, path_large, width, height)
			VALUES ($1, 0, $2, $3, $4, $5) RETURNING id, position`,
			o.shopID, small, large, p.Width, p.Height).Scan(&img.ID, &img.Position)
		if err != nil {
			return err
		}
		_, err = tx.Exec(ctx, `UPDATE shops SET logo_image_id = $2, updated_at = now() WHERE id = $1`, o.shopID, img.ID)
		return err
	})
	return img, oldFiles, err
}

func (h *Handler) reorder(c *gin.Context) {
	var in struct {
		IDs []int64 `json:"ids"`
	}
	if !httpx.BindJSON(c, &in) {
		return
	}
	invalid := httpx.Validation(map[string]string{"ids": "must_list_all_images_of_one_listing"})
	if len(in.IDs) == 0 {
		httpx.Abort(c, invalid)
		return
	}
	ctx := c.Request.Context()
	err := db.InTx(ctx, h.DB, func(tx pgx.Tx) error {
		var listings, found int
		var listingID *int64
		err := tx.QueryRow(ctx, `
			SELECT count(DISTINCT listing_id), count(*), min(listing_id)
			FROM images WHERE id = ANY($1) AND listing_id IS NOT NULL`, in.IDs).Scan(&listings, &found, &listingID)
		if err != nil {
			return err
		}
		if listings != 1 || found != len(in.IDs) {
			return invalid
		}
		var total int
		if err := tx.QueryRow(ctx, `SELECT count(*) FROM images WHERE listing_id = $1`, *listingID).Scan(&total); err != nil {
			return err
		}
		if total != len(in.IDs) {
			return invalid
		}
		_, err = tx.Exec(ctx, `
			UPDATE images SET position = x.ord - 1, updated_at = now()
			FROM unnest($1::bigint[]) WITH ORDINALITY AS x(id, ord)
			WHERE images.id = x.id`, in.IDs)
		return err
	})
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) delete(c *gin.Context) {
	id, ok := httpx.ParseID(c, "id")
	if !ok {
		return
	}
	var small, large string
	err := h.DB.QueryRow(c.Request.Context(), `DELETE FROM images WHERE id = $1 RETURNING path_small, path_large`, id).Scan(&small, &large)
	if err != nil {
		httpx.Abort(c, err)
		return
	}
	DeleteFiles(h.Storage, []string{small, large})
	c.Status(http.StatusNoContent)
}
