-include .env
export

.PHONY: test run admin

test:
	go test -p 1 ./...

run:
	go run ./cmd/server

admin:
	go run ./cmd/admin create --email $(EMAIL)
