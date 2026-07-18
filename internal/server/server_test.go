package server_test

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sushichan044/kg/internal/server"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.DiscardHandler)
}

func dummySPA() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("spa"))
	})
}

func TestFileID_IsStableAndShort(t *testing.T) {
	t.Parallel()

	id := server.FileID("/tmp/a.txt")
	assert.Len(t, id, 8)
	assert.Equal(t, id, server.FileID("/tmp/a.txt"))
	assert.NotEqual(t, id, server.FileID("/tmp/b.txt"))
}

func TestHandler_ListFilesReturnsCatalogInOrder(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "b.txt"), "b")
	writeFile(t, filepath.Join(dir, "a.txt"), "a")

	srv := newRunningServer(t, dir, dir)

	resp := getJSON(t, srv, "/_/api/files")
	var files []struct {
		ID   string `json:"id"`
		Path string `json:"path"`
	}
	require.NoError(t, json.Unmarshal(resp, &files))
	require.Len(t, files, 2)
	assert.Equal(t, "a.txt", files[0].Path)
	assert.Equal(t, "b.txt", files[1].Path)
}

func TestHandler_FileContentReturnsRawText(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "a.txt"), "こんにちは\n世界")

	srv := newRunningServer(t, dir, dir)
	id := server.FileID(filepath.Join(dir, "a.txt"))

	req := httptest.NewRequest(http.MethodGet, "/_/api/files/"+id+"/content", nil)
	rec := httptest.NewRecorder()
	srv.Handler(dummySPA()).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "こんにちは\n世界", rec.Body.String())
	assert.Contains(t, rec.Header().Get("Content-Type"), "text/plain")
}

func TestHandler_FileContentUnknownIDReturns404(t *testing.T) {
	t.Parallel()

	srv := server.New(discardLogger())

	req := httptest.NewRequest(http.MethodGet, "/_/api/files/deadbeef/content", nil)
	rec := httptest.NewRecorder()
	srv.Handler(dummySPA()).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}

func TestHandler_UnknownRouteFallsBackToSPA(t *testing.T) {
	t.Parallel()

	srv := server.New(discardLogger())

	req := httptest.NewRequest(http.MethodGet, "/some/client/route", nil)
	rec := httptest.NewRecorder()
	srv.Handler(dummySPA()).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "spa", rec.Body.String())
}

func TestWatcher_DirectoryRootScannedRecursively(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "top.txt"), "x")
	sub := filepath.Join(dir, "chapters")
	require.NoError(t, os.MkdirAll(sub, 0o755))
	writeFile(t, filepath.Join(sub, "one.txt"), "x")
	writeFile(t, filepath.Join(sub, "skip.md"), "not txt")

	srv := newRunningServer(t, dir, dir)

	paths := relPaths(srv.Files())
	assert.Equal(t, []string{"chapters/one.txt", "top.txt"}, paths)
}

func TestWatcher_SkipsGitignoredFilesAndGitDir(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(dir, ".git"), 0o755))
	writeFile(t, filepath.Join(dir, ".gitignore"), "ignored/\n*.tmp.txt\n")
	writeFile(t, filepath.Join(dir, "keep.txt"), "x")
	writeFile(t, filepath.Join(dir, "draft.tmp.txt"), "x")
	require.NoError(t, os.MkdirAll(filepath.Join(dir, "ignored"), 0o755))
	writeFile(t, filepath.Join(dir, "ignored", "secret.txt"), "x")
	// A .txt inside the .git directory must never be surfaced.
	require.NoError(t, os.MkdirAll(filepath.Join(dir, ".git", "hooks"), 0o755))
	writeFile(t, filepath.Join(dir, ".git", "hooks", "note.txt"), "x")
	// Any dot-directory is excluded, even without a matching .gitignore rule.
	require.NoError(t, os.MkdirAll(filepath.Join(dir, ".vscode"), 0o755))
	writeFile(t, filepath.Join(dir, ".vscode", "scratch.txt"), "x")

	srv := newRunningServer(t, dir, dir)

	assert.Equal(t, []string{"keep.txt"}, relPaths(srv.Files()))
}

// newRunningServer builds a Server, starts its watcher for the lifetime of the
// test, and returns it. baseDir is the directory relative paths are shown
// against.
func newRunningServer(t *testing.T, baseDir string, roots ...string) *server.Server {
	t.Helper()

	srv := server.New(discardLogger())
	w, err := server.NewWatcher(srv, roots, baseDir, discardLogger())
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	go w.Run(ctx)

	return srv
}

func getJSON(t *testing.T, srv *server.Server, path string) []byte {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	srv.Handler(dummySPA()).ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code)

	return rec.Body.Bytes()
}

func writeFile(t *testing.T, path, content string) {
	t.Helper()
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
}

func relPaths(files []server.File) []string {
	out := make([]string, len(files))
	for i, f := range files {
		out[i] = f.RelPath
	}

	return out
}
