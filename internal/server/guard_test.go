package server_test

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/sushichan044/kg/internal/server"
)

func TestHandler_AllowsLoopbackHosts(t *testing.T) {
	t.Parallel()

	port := strconv.Itoa(testPort)
	hosts := []string{"127.0.0.1:" + port, "localhost:" + port, "[::1]:" + port}

	for _, host := range hosts {
		t.Run(host, func(t *testing.T) {
			t.Parallel()

			srv := server.New(discardLogger())
			req := newLocalRequest(http.MethodGet, "/_/api/status", nil)
			req.Host = host
			req.Header.Set("Origin", "http://"+host)
			rec := httptest.NewRecorder()

			srv.Handler(dummySPA(), testPort).ServeHTTP(rec, req)

			assert.Equal(t, http.StatusOK, rec.Code)
		})
	}
}

func TestHandler_RejectsForeignHost(t *testing.T) {
	t.Parallel()

	hosts := []string{
		"evil.example",
		"evil.example:" + strconv.Itoa(testPort),
		"127.0.0.1:1",
	}

	for _, host := range hosts {
		t.Run(host, func(t *testing.T) {
			t.Parallel()

			srv := server.New(discardLogger())
			req := newLocalRequest(http.MethodGet, "/_/api/files", nil)
			req.Host = host
			rec := httptest.NewRecorder()

			srv.Handler(dummySPA(), testPort).ServeHTTP(rec, req)

			assert.Equal(t, http.StatusForbidden, rec.Code)
		})
	}
}

func TestHandler_RejectsForeignOrigin(t *testing.T) {
	t.Parallel()

	origins := []string{"http://evil.example", "null", "https://127.0.0.1:" + strconv.Itoa(testPort)}

	for _, origin := range origins {
		t.Run(origin, func(t *testing.T) {
			t.Parallel()

			srv := server.New(discardLogger())
			req := newLocalRequest(http.MethodPost, "/_/api/shutdown", nil)
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Origin", origin)
			rec := httptest.NewRecorder()

			srv.Handler(dummySPA(), testPort).ServeHTTP(rec, req)

			assert.Equal(t, http.StatusForbidden, rec.Code)
			assertOpen(t, srv.ShutdownRequested())
		})
	}
}

func TestHandler_RejectsNonJSONPost(t *testing.T) {
	t.Parallel()

	srv := server.New(discardLogger())
	req := newLocalRequest(http.MethodPost, "/_/api/shutdown", strings.NewReader("{}"))
	req.Header.Set("Content-Type", "text/plain")
	rec := httptest.NewRecorder()

	srv.Handler(dummySPA(), testPort).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnsupportedMediaType, rec.Code)
	assertOpen(t, srv.ShutdownRequested())
}

func TestHandler_AcceptsJSONPostWithCharset(t *testing.T) {
	t.Parallel()

	srv := server.New(discardLogger())
	req := newLocalRequest(http.MethodPost, "/_/api/shutdown", nil)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	rec := httptest.NewRecorder()

	srv.Handler(dummySPA(), testPort).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusAccepted, rec.Code)
}

func TestHandler_AddRootsRejectsOversizedBody(t *testing.T) {
	t.Parallel()

	srv := server.New(discardLogger())
	body := `{"paths":["` + strings.Repeat("a", 1<<20) + `"]}`
	req := newLocalRequest(http.MethodPost, "/_/api/roots", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	srv.Handler(dummySPA(), testPort).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusRequestEntityTooLarge, rec.Code)
}

func assertOpen(t *testing.T, ch <-chan struct{}) {
	t.Helper()

	select {
	case <-ch:
		t.Fatal("expected channel to stay open")
	default:
	}
}
