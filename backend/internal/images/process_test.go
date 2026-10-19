package images_test

import (
	"bytes"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"testing"

	"wedding-rentals/backend/internal/images"
)

func pngBytes(t *testing.T, w, h int, c color.Color) []byte {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func decodeJPEG(t *testing.T, b []byte) image.Image {
	t.Helper()
	img, err := jpeg.Decode(bytes.NewReader(b))
	if err != nil {
		t.Fatalf("output is not JPEG: %v", err)
	}
	return img
}

func TestProcessResizesToTwoWidths(t *testing.T) {
	p, err := images.Process(pngBytes(t, 2000, 1000, color.NRGBA{200, 100, 50, 255}))
	if err != nil {
		t.Fatal(err)
	}
	if p.Width != 1200 || p.Height != 600 {
		t.Fatalf("large = %dx%d", p.Width, p.Height)
	}
	if b := decodeJPEG(t, p.Large).Bounds(); b.Dx() != 1200 || b.Dy() != 600 {
		t.Fatalf("large bytes = %v", b)
	}
	if b := decodeJPEG(t, p.Small).Bounds(); b.Dx() != 400 || b.Dy() != 200 {
		t.Fatalf("small bytes = %v", b)
	}
}

func TestProcessDoesNotUpscale(t *testing.T) {
	p, err := images.Process(pngBytes(t, 300, 200, color.White))
	if err != nil {
		t.Fatal(err)
	}
	if p.Width != 300 || decodeJPEG(t, p.Small).Bounds().Dx() != 300 {
		t.Fatalf("upscaled: %d", p.Width)
	}
}

func TestProcessFlattensTransparencyToWhite(t *testing.T) {
	p, err := images.Process(pngBytes(t, 50, 50, color.NRGBA{0, 0, 0, 0}))
	if err != nil {
		t.Fatal(err)
	}
	r, g, b, _ := decodeJPEG(t, p.Small).At(10, 10).RGBA()
	if r>>8 < 240 || g>>8 < 240 || b>>8 < 240 {
		t.Fatalf("pixel = %d,%d,%d; want white", r>>8, g>>8, b>>8)
	}
}

func TestProcessRejectsUnsupported(t *testing.T) {
	var gifBuf bytes.Buffer
	_ = gif.Encode(&gifBuf, image.NewPaletted(image.Rect(0, 0, 10, 10), []color.Color{color.White}), nil)
	for name, data := range map[string][]byte{"text": []byte("hello, not an image"), "gif": gifBuf.Bytes()} {
		if _, err := images.Process(data); !errors.Is(err, images.ErrUnsupported) {
			t.Errorf("%s: err = %v, want ErrUnsupported", name, err)
		}
	}
}

// hugeHeaderPNG is a truncated PNG whose IHDR declares w x h pixels; it is
// enough for image.DecodeConfig but would be enormous to fully decode.
func hugeHeaderPNG(w, h uint32) []byte {
	var buf bytes.Buffer
	buf.WriteString("\x89PNG\r\n\x1a\n")
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:], w)
	binary.BigEndian.PutUint32(ihdr[4:], h)
	ihdr[8], ihdr[9] = 8, 0 // 8-bit grayscale
	_ = binary.Write(&buf, binary.BigEndian, uint32(len(ihdr)))
	chunk := append([]byte("IHDR"), ihdr...)
	buf.Write(chunk)
	_ = binary.Write(&buf, binary.BigEndian, crc32.ChecksumIEEE(chunk))
	return buf.Bytes()
}

func TestProcessRejectsHugeDimensionsWithoutDecoding(t *testing.T) {
	if _, err := images.Process(hugeHeaderPNG(30000, 30000)); !errors.Is(err, images.ErrTooLarge) {
		t.Fatalf("err = %v, want ErrTooLarge", err)
	}
	if _, err := images.Process(hugeHeaderPNG(7000, 6000)); !errors.Is(err, images.ErrTooLarge) {
		t.Fatalf("42MP: err = %v, want ErrTooLarge", err)
	}
}

func TestProcessKeepsOpaqueColours(t *testing.T) {
	p, err := images.Process(pngBytes(t, 1600, 800, color.NRGBA{10, 200, 30, 255}))
	if err != nil {
		t.Fatal(err)
	}
	_, g, _, _ := decodeJPEG(t, p.Large).At(5, 5).RGBA()
	if g>>8 < 150 {
		t.Fatalf("green = %d", g>>8)
	}
}
