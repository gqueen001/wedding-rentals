package images

type Image struct {
	ID       int64  `json:"id"`
	Position int    `json:"position"`
	Small    string `json:"small"`
	Large    string `json:"large"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
}

// URL turns a stored relative path into the public URL served under /uploads.
func URL(path string) string { return "/uploads/" + path }
