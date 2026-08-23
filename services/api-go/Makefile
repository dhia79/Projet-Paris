.PHONY: tidy build run test lint docker

BINARY := bin/api

tidy:
	go mod tidy

build:
	go build -trimpath -o $(BINARY) ./cmd/api

run:
	go run ./cmd/api

test:
	go test ./... -race -cover

lint:
	go vet ./...
	gofmt -l .

docker:
	docker build -t projet-paris/api-go:local .
