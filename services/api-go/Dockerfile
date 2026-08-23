# syntax=docker/dockerfile:1
# ---- build ----------------------------------------------------------------
FROM golang:1.23-bookworm AS build

WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Static binary so the runtime stage needs no libc beyond what Debian ships.
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# ---- runtime (Debian) -----------------------------------------------------
FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Never run the API as root.
RUN useradd --system --uid 10001 --no-create-home apiuser
USER apiuser

COPY --from=build /out/api /usr/local/bin/api

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/api"]
