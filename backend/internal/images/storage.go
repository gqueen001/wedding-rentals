package images

import (
	"errors"
	"io/fs"
	"log"
	"os"
	"path/filepath"
)

// Storage keeps image files; names are server-generated relative paths.
type Storage interface {
	Save(name string, data []byte) error
	Delete(name string) error
}

type LocalStorage struct{ Dir string }

func (s LocalStorage) Save(name string, data []byte) error {
	p := filepath.Join(s.Dir, filepath.FromSlash(name))
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	return os.WriteFile(p, data, 0o644)
}

func (s LocalStorage) Delete(name string) error {
	err := os.Remove(filepath.Join(s.Dir, filepath.FromSlash(name)))
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return err
}

// DeleteFiles removes files best-effort; failures are logged, not returned.
func DeleteFiles(st Storage, names []string) {
	for _, n := range names {
		if err := st.Delete(n); err != nil {
			log.Printf("delete image file %s: %v", n, err)
		}
	}
}
