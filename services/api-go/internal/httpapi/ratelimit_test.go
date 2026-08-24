package httpapi

import (
	"net/http"
	"testing"
	"time"
)

func TestRateLimiterAllowsUpToTheBurst(t *testing.T) {
	l := newRateLimiter(60, 3)
	now := time.Now()

	for i := 1; i <= 3; i++ {
		if !l.allow("1.2.3.4", now) {
			t.Fatalf("request %d should be allowed within a burst of 3", i)
		}
	}
	if l.allow("1.2.3.4", now) {
		t.Error("the fourth request should be refused")
	}
}

func TestRateLimiterRefillsOverTime(t *testing.T) {
	l := newRateLimiter(60, 1) // one token per second
	now := time.Now()

	if !l.allow("1.2.3.4", now) {
		t.Fatal("first request should be allowed")
	}
	if l.allow("1.2.3.4", now) {
		t.Fatal("second immediate request should be refused")
	}
	if !l.allow("1.2.3.4", now.Add(2*time.Second)) {
		t.Error("a token should have been regained after two seconds")
	}
}

func TestRateLimiterNeverExceedsTheBurstOnRefill(t *testing.T) {
	l := newRateLimiter(60, 2)
	now := time.Now()

	l.allow("1.2.3.4", now)
	// An hour of idling must not bank an hour's worth of tokens.
	l.allow("1.2.3.4", now.Add(time.Hour))

	if !l.allow("1.2.3.4", now.Add(time.Hour)) {
		t.Fatal("second token should still be available")
	}
	if l.allow("1.2.3.4", now.Add(time.Hour)) {
		t.Error("bucket should be capped at the burst size")
	}
}

func TestRateLimiterIsPerClient(t *testing.T) {
	l := newRateLimiter(60, 1)
	now := time.Now()

	if !l.allow("1.1.1.1", now) || !l.allow("2.2.2.2", now) {
		t.Error("distinct clients must not share a bucket")
	}
}

func TestSweepDropsIdleBuckets(t *testing.T) {
	l := newRateLimiter(60, 1)
	now := time.Now()

	l.allow("1.1.1.1", now)
	l.allow("2.2.2.2", now.Add(9*time.Minute))
	l.sweep(now.Add(10*time.Minute), 5*time.Minute)

	l.mu.Lock()
	defer l.mu.Unlock()
	if _, ok := l.buckets["1.1.1.1"]; ok {
		t.Error("the idle bucket should have been swept")
	}
	if _, ok := l.buckets["2.2.2.2"]; !ok {
		t.Error("the recent bucket should have survived")
	}
}

func TestClientIP(t *testing.T) {
	r, _ := http.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "10.0.0.9:54321"

	if got := clientIP(r, false); got != "10.0.0.9" {
		t.Errorf("clientIP = %q, want the RemoteAddr host", got)
	}

	r.Header.Set("X-Forwarded-For", "203.0.113.7, 70.41.3.18")
	if got := clientIP(r, false); got != "10.0.0.9" {
		t.Errorf("clientIP = %q, want the header ignored when the proxy is untrusted", got)
	}
	if got := clientIP(r, true); got != "203.0.113.7" {
		t.Errorf("clientIP = %q, want the left-most forwarded address", got)
	}
}

func TestClientIPWithSingleForwardedEntry(t *testing.T) {
	r, _ := http.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "10.0.0.9:54321"
	r.Header.Set("X-Forwarded-For", "203.0.113.7")

	if got := clientIP(r, true); got != "203.0.113.7" {
		t.Errorf("clientIP = %q, want 203.0.113.7", got)
	}
}
