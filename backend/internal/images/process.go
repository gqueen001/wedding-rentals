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

var ErrUnsupported = errors.New("unsupported image")

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
	img, err := imaging.Decode(bytes.NewReader(data), imaging.AutoOrientation(true))
	if err != nil {
		return Processed{}, fmt.Errorf("%w: %v", ErrUnsupported, err)
	}
	img = flatten(img)
	large := fitWidth(img, LargeWidth)
	lb, err := encode(large)
	if err != nil {
		return Processed{}, err
	}
	sb, err := encode(fitWidth(img, SmallWidth))
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

func flatten(img image.Image) image.Image {
	b := img.Bounds()
	bg := imaging.New(b.Dx(), b.Dy(), color.White)
	return imaging.Overlay(bg, img, image.Pt(0, 0), 1.0)
}

func encode(img image.Image) ([]byte, error) {
	var buf bytes.Buffer
	err := imaging.Encode(&buf, img, imaging.JPEG, imaging.JPEGQuality(jpegQuality))
	return buf.Bytes(), err
}
