// Command admin creates admin accounts:
//
//	go run ./cmd/admin create --email you@example.com
//
// The password is read from the terminal (hidden) or from stdin when piped.
package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"golang.org/x/term"

	"wedding-rentals/backend/internal/auth"
	"wedding-rentals/backend/internal/db"
)

func main() {
	if len(os.Args) < 2 || os.Args[1] != "create" {
		fmt.Fprintln(os.Stderr, "usage: admin create --email you@example.com")
		os.Exit(2)
	}
	fs := flag.NewFlagSet("create", flag.ExitOnError)
	email := fs.String("email", "", "admin email")
	_ = fs.Parse(os.Args[2:])
	if *email == "" {
		log.Fatal("--email is required")
	}
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		log.Fatal("DATABASE_URL is required")
	}
	pw, err := readPassword()
	if err != nil {
		log.Fatal(err)
	}
	ctx := context.Background()
	pool, err := db.Connect(ctx, url)
	if err != nil {
		log.Fatal(err)
	}
	defer pool.Close()
	if err := db.Migrate(ctx, pool); err != nil {
		log.Fatal(err)
	}
	id, err := auth.CreateAdmin(ctx, pool, *email, pw)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("created admin #%d (%s)\n", id, *email)
}

func readPassword() (string, error) {
	fd := int(os.Stdin.Fd())
	if term.IsTerminal(fd) {
		fmt.Fprint(os.Stderr, "Password (min 10 characters): ")
		b, err := term.ReadPassword(fd)
		fmt.Fprintln(os.Stderr)
		return string(b), err
	}
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", err
	}
	return strings.TrimRight(line, "\r\n"), nil
}
