package server_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sushichan044/kg/internal/server"
	"github.com/sushichan044/kg/internal/version"
)

func TestHandler_AddRootsExtendsCatalog(t *testing.T) {
	t.Parallel()

	empty := t.TempDir()
	added := t.TempDir()
	writeFile(t, filepath.Join(added, "b.txt"), "x")

	srv := server.New(discardLogger())
	w, err := server.NewWatcher(srv, []string{empty}, added, discardLogger())
	require.NoError(t, err)
	srv.AttachRoots(w)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go w.Run(ctx)

	body := `{"paths":["` + added + `"]}`
	req := httptest.NewRequest(http.MethodPost, "/_/api/roots", strings.NewReader(body))
	rec := httptest.NewRecorder()
	srv.Handler(dummySPA()).ServeHTTP(rec, req)

	require.Equal(t, http.StatusAccepted, rec.Code)
	// AddRoots rescans synchronously, so the catalog is updated by now.
	assert.Equal(t, []string{"b.txt"}, relPaths(srv.Files()))
}

func TestHandler_StatusReportsVersionRootsAndFileCount(t *testing.T) {
	t.Parallel()

	root := t.TempDir()
	writeFile(t, filepath.Join(root, "a.txt"), "x")

	srv := server.New(discardLogger())
	w, err := server.NewWatcher(srv, []string{root}, root, discardLogger())
	require.NoError(t, err)
	srv.AttachRoots(w)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go w.Run(ctx)

	req := httptest.NewRequest(http.MethodGet, "/_/api/status", nil)
	rec := httptest.NewRecorder()
	srv.Handler(dummySPA()).ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)

	var status struct {
		Version   string   `json:"version"`
		FileCount int      `json:"file_count"`
		Roots     []string `json:"roots"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &status))
	assert.Equal(t, version.Get(), status.Version)
	assert.Equal(t, []string{root}, status.Roots)
	assert.Equal(t, 1, status.FileCount)
}

func TestHandler_StatusReportsRootsAsArrayWhenNoneWatched(t *testing.T) {
	t.Parallel()

	srv := server.New(discardLogger())
	w, err := server.NewWatcher(srv, nil, t.TempDir(), discardLogger())
	require.NoError(t, err)
	srv.AttachRoots(w)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go w.Run(ctx)

	req := httptest.NewRequest(http.MethodGet, "/_/api/status", nil)
	rec := httptest.NewRecorder()
	srv.Handler(dummySPA()).ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `"roots":[]`)
}

func TestHandler_ShutdownRequestSignals(t *testing.T) {
	t.Parallel()

	srv := server.New(discardLogger())

	req := httptest.NewRequest(http.MethodPost, "/_/api/shutdown", nil)
	rec := httptest.NewRecorder()
	srv.Handler(dummySPA()).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusAccepted, rec.Code)
	assertClosed(t, srv.ShutdownRequested())
}

func TestHandler_RestartRequestSignals(t *testing.T) {
	t.Parallel()

	srv := server.New(discardLogger())

	req := httptest.NewRequest(http.MethodPost, "/_/api/restart", nil)
	rec := httptest.NewRecorder()
	srv.Handler(dummySPA()).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusAccepted, rec.Code)
	assertClosed(t, srv.RestartRequested())
}

func assertClosed(t *testing.T, ch <-chan struct{}) {
	t.Helper()

	select {
	case <-ch:
	default:
		t.Fatal("expected channel to be closed")
	}
}
