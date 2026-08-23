// Package config reads the service's runtime configuration from the
// environment. App Engine and Cloud Run both inject PORT; Cloud SQL injects
// INSTANCE_CONNECTION_NAME when the unix-socket path is in play.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config is the fully resolved service configuration.
type Config struct {
	Port            string
	DSN             string
	AllowedOrigins  []string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownGrace   time.Duration
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v, err := strconv.Atoi(os.Getenv(key)); err == nil && v > 0 {
		return v
	}
	return fallback
}

// Load builds a Config, returning an error only for values the service cannot
// invent a safe default for.
func Load() (Config, error) {
	cfg := Config{
		Port:            env("PORT", "8080"),
		MaxOpenConns:    envInt("DB_MAX_OPEN_CONNS", 25),
		MaxIdleConns:    envInt("DB_MAX_IDLE_CONNS", 5),
		ConnMaxLifetime: 5 * time.Minute,
		ReadTimeout:     10 * time.Second,
		WriteTimeout:    30 * time.Second,
		ShutdownGrace:   15 * time.Second,
	}

	for _, o := range strings.Split(env("ALLOWED_ORIGINS", "http://localhost:5173"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			cfg.AllowedOrigins = append(cfg.AllowedOrigins, o)
		}
	}

	dsn, err := buildDSN()
	if err != nil {
		return cfg, err
	}
	cfg.DSN = dsn

	return cfg, nil
}

// buildDSN assembles a go-sql-driver DSN. DB_DSN wins when set; otherwise the
// parts are composed, choosing a Cloud SQL unix socket over TCP when
// INSTANCE_CONNECTION_NAME is present (the App Engine standard path).
func buildDSN() (string, error) {
	if dsn := os.Getenv("DB_DSN"); dsn != "" {
		return dsn, nil
	}

	user := env("DB_USER", "paris_api")
	pass := os.Getenv("DB_PASSWORD")
	name := env("DB_NAME", "paris_fraicheur")
	if pass == "" {
		return "", fmt.Errorf("DB_PASSWORD (or a full DB_DSN) is required")
	}

	// Options, not decoration: parseTime hands us time.Time instead of []byte,
	// and the utf8mb4 collation must match the schema or accented names garble.
	const opts = "parseTime=true&collation=utf8mb4_unicode_ci&loc=UTC&timeout=10s"

	if instance := os.Getenv("INSTANCE_CONNECTION_NAME"); instance != "" {
		socketDir := env("DB_SOCKET_DIR", "/cloudsql")
		return fmt.Sprintf("%s:%s@unix(%s/%s)/%s?%s",
			user, pass, socketDir, instance, name, opts), nil
	}

	host := env("DB_HOST", "127.0.0.1")
	port := env("DB_PORT", "3306")
	return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?%s", user, pass, host, port, name, opts), nil
}
