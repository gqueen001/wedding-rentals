package images

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/color"
	"net/http"

	"github.com/disintegration/imaging"
	_ "golang.org/x/image/webp" // registers the WebP decoder
)

const (
	SmallWidth  = 400
	LargeWidth  = 1200
	jpegQuality = 82
)

// maxPixels bounds the decoded size. 52 MP covers 8000x6000 and 8160x6120
// phone sensors; anything larger is rejected before decoding.
const maxPixels = 52_000_000

var (
	ErrUnsupported = errors.New("unsupported image")
	ErrTooLarge    = errors.New("image dimensions too large")
)

type Processed struct {
	Small, Large  []byte
	Width, Height int // dimensions of Large
}

// Process validates an upload by content, fixes EXIF rotation, flattens
// transparency onto white and returns small and large JPEG versions.
func Process(data []byte) (Processed, error) {
	switch http.DetectContentType(data) {
	case "image/jpeg", "image/png", "image/webp":
	default:
		return Processed{}, ErrUnsupported
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return Processed{}, fmt.Errorf("%w: %v", ErrUnsupported, err)
	}
	if cfg.Width <= 0 || cfg.Height <= 0 {
		return Processed{}, ErrUnsupported
	}
	if int64(cfg.Width)*int64(cfg.Height) > maxPixels {
		return Processed{}, ErrTooLarge
	}
	img, err := imaging.Decode(bytes.NewReader(data), imaging.AutoOrientation(true))
	if err != nil {
		return Processed{}, fmt.Errorf("%w: %v", ErrUnsupported, err)
	}
	// Resize first so flattening only touches the small outputs.
	large := flatten(fitWidth(img, LargeWidth))
	lb, err := encode(large)
	if err != nil {
		return Processed{}, err
	}
	sb, err := encode(flatten(fitWidth(img, SmallWidth)))
	if err != nil {
		return Processed{}, err
	}
	return Processed{Small: sb, Large: lb, Width: large.Bounds().Dx(), Height: large.Bounds().Dy()}, nil
}

func fitWidth(img image.Image, w int) image.Image {
	if img.Bounds().Dx() <= w {
		return img
	}
	return imaging.Resize(img, w, 0, imaging.Lanczos)
}

// flatten composites img onto white; opaque images are returned untouched.
func flatten(img image.Image) image.Image {
	if o, ok := img.(interface{ Opaque() bool }); ok && o.Opaque() {
		return img
	}
	b := img.Bounds()
	bg := imaging.New(b.Dx(), b.Dy(), color.White)
	return imaging.Overlay(bg, img, image.Pt(0, 0), 1.0)
}

func encode(img image.Image) ([]byte, error) {
	var buf bytes.Buffer
	err := imaging.Encode(&buf, img, imaging.JPEG, imaging.JPEGQuality(jpegQuality))
	return buf.Bytes(), err
}
