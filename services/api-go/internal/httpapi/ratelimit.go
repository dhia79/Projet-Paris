package httpapi

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

// rateLimiter is a per-client token bucket.
//
// The report endpoint is anonymous by design -- reporting a broken fountain
// during a heatwave must not require an account -- which makes it the one
// endpoint worth throttling. Deliberately in-memory: with a single instance
// that is sufficient, and reaching for Redis to slow down form spam would cost
// more than the abuse does.
type rateLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	rate    time.Duration // time to regain one token
	burst   int
}

type bucket struct {
	tokens int
	last   time.Time
}

func newRateLimiter(perMinute, burst int) *rateLimiter {
	return &rateLimiter{
		buckets: make(map[string]*bucket),
		rate:    time.Minute / time.Duration(perMinute),
		burst:   burst,
	}
}

// allow consumes a token for key, reporting whether the request may proceed.
func (l *rateLimiter) allow(key string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	b, ok := l.buckets[key]
	if !ok {
		l.buckets[key] = &bucket{tokens: l.burst - 1, last: now}
		return true
	}

	// Refill for the time elapsed since this client was last seen.
	refill := int(now.Sub(b.last) / l.rate)
	if refill > 0 {
		b.tokens = min(l.burst, b.tokens+refill)
		b.last = now
	}

	if b.tokens <= 0 {
		return false
	}
	b.tokens--
	return true
}

// sweep drops buckets untouched for longer than ttl, so a long-running process
// does not accumulate an entry per IP it has ever seen.
func (l *rateLimiter) sweep(now time.Time, ttl time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()

	for key, b := range l.buckets {
		if now.Sub(b.last) > ttl {
			delete(l.buckets, key)
		}
	}
}

// startSweeper runs sweep periodically until done is closed.
func (l *rateLimiter) startSweeper(every, ttl time.Duration, done <-chan struct{}) {
	ticker := time.NewTicker(every)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case now := <-ticker.C:
				l.sweep(now, ttl)
			case <-done:
				return
			}
		}
	}()
}

// clientIP identifies the caller for rate-limiting purposes.
//
// X-Forwarded-For is only consulted because this service runs behind Google's
// load balancer, which sets it. Directly exposed, the header would be trivially
// spoofable and RemoteAddr would be the honest choice.
func clientIP(r *http.Request, trustProxy bool) string {
	if trustProxy {
		if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
			// Left-most entry is the original client.
			if first, _, found := strings.Cut(forwarded, ","); found {
				return strings.TrimSpace(first)
			}
			return strings.TrimSpace(forwarded)
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// withRateLimit throttles a single handler.
func withRateLimit(l *rateLimiter, trustProxy bool, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !l.allow(clientIP(r, trustProxy), time.Now()) {
			w.Header().Set("Retry-After", "60")
			writeError(w, http.StatusTooManyRequests, "too many reports, try again shortly")
			return
		}
		next.ServeHTTP(w, r)
	})
}
