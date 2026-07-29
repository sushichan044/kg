// Package server owns filesystem access and watching for kg. It exposes a small
// HTTP interface: listing the watched text files, reading one file, and
// notifying the browser over server-sent events when the catalog or a file
// changes. It is the only filesystem watcher in the application.
package server

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"sync"

	"github.com/sushichan044/kg/internal/version"
)

// rootAdder lets the HTTP layer add watch roots to the running watcher, so a
// second `kg <path>` invocation can extend an already-running server.
type rootAdder interface {
	AddRoots(paths []string)
	Roots() []string
}

// Server holds the watched file catalog and the SSE hub. It is safe for
// concurrent use.
type Server struct {
	mu    sync.RWMutex
	byID  map[string]File
	order []File

	hub    *hub
	logger *slog.Logger
	pid    int
	roots  rootAdder

	shutdownCh   chan struct{}
	restartCh    chan struct{}
	shutdownOnce sync.Once
	restartOnce  sync.Once
}

// New creates a Server with an empty catalog.
func New(logger *slog.Logger) *Server {
	return &Server{
		byID:       map[string]File{},
		hub:        newHub(),
		logger:     logger,
		pid:        os.Getpid(),
		shutdownCh: make(chan struct{}),
		restartCh:  make(chan struct{}),
	}
}

// AttachRoots wires the watcher so the server can extend the watched roots at
// runtime.
func (s *Server) AttachRoots(r rootAdder) {
	s.roots = r
}

// ShutdownRequested is closed when a client asks the server to stop.
func (s *Server) ShutdownRequested() <-chan struct{} {
	return s.shutdownCh
}

// RestartRequested is closed when a client asks the server to restart.
func (s *Server) RestartRequested() <-chan struct{} {
	return s.restartCh
}

// SetFiles replaces the catalog. It returns true when the set of files changed,
// so callers can decide whether to notify clients.
func (s *Server) SetFiles(files []File) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	changed := len(files) != len(s.order)
	next := make(map[string]File, len(files))
	for _, f := range files {
		if _, ok := s.byID[f.ID]; !ok {
			changed = true
		}
		next[f.ID] = f
	}

	s.byID = next
	s.order = files

	return changed
}

// Files returns a snapshot of the catalog in display order.
func (s *Server) Files() []File {
	s.mu.RLock()
	defer s.mu.RUnlock()

	out := make([]File, len(s.order))
	copy(out, s.order)

	return out
}

func (s *Server) fileByID(id string) (File, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	f, ok := s.byID[id]

	return f, ok
}

// CloseSubscribers disconnects all SSE clients. Register it with
// [net/http.Server.RegisterOnShutdown] so long-lived SSE handlers return during
// graceful shutdown instead of blocking it.
func (s *Server) CloseSubscribers() {
	s.hub.closeAll()
}

// notifyCatalog tells clients to refetch the file list.
func (s *Server) notifyCatalog() {
	s.hub.broadcast(event{name: eventUpdate, data: "{}"})
}

// notifyFileChanged tells clients to refetch a single file's content.
func (s *Server) notifyFileChanged(id string) {
	s.hub.broadcast(event{name: eventFileChanged, data: fmt.Sprintf(`{"id":%q}`, id)})
}

// Handler builds the HTTP handler. spa serves the embedded frontend for all
// non-API routes.
func (s *Server) Handler(spa http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /_/api/files", s.handleListFiles)
	mux.HandleFunc("GET /_/api/files/{id}/content", s.handleFileContent)
	mux.HandleFunc("GET /_/api/status", s.handleStatus)
	mux.HandleFunc("POST /_/api/roots", s.handleAddRoots)
	mux.HandleFunc("POST /_/api/shutdown", s.handleShutdown)
	mux.HandleFunc("POST /_/api/restart", s.handleRestart)
	mux.HandleFunc("GET /_/events", s.handleSSE)
	mux.Handle("GET /", spa)

	return mux
}

func (s *Server) handleAddRoots(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Paths []string `json:"paths"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)

		return
	}

	if s.roots != nil {
		s.roots.AddRoots(body.Paths)
	}
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) handleShutdown(w http.ResponseWriter, _ *http.Request) {
	s.shutdownOnce.Do(func() { close(s.shutdownCh) })
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) handleRestart(w http.ResponseWriter, _ *http.Request) {
	s.restartOnce.Do(func() { close(s.restartCh) })
	w.WriteHeader(http.StatusAccepted)
}

func (s *Server) handleListFiles(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, s.Files())
}

func (s *Server) handleStatus(w http.ResponseWriter, _ *http.Request) {
	// Roots is always an array in the response, so a client never has to tell
	// "no roots" apart from "unknown roots".
	roots := []string{}
	if s.roots != nil {
		roots = append(roots, s.roots.Roots()...)
	}

	writeJSON(w, statusResponse{
		Version:   version.Get(),
		PID:       s.pid,
		FileCount: len(s.Files()),
		Roots:     roots,
	})
}

func (s *Server) handleFileContent(w http.ResponseWriter, r *http.Request) {
	f, ok := s.fileByID(r.PathValue("id"))
	if !ok {
		http.Error(w, "file not found", http.StatusNotFound)

		return
	}

	content, err := os.ReadFile(f.AbsPath)
	if err != nil {
		s.logger.WarnContext(r.Context(), "read file", "path", f.AbsPath, "error", err)
		http.Error(w, "read failed", http.StatusInternalServerError)

		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	if _, writeErr := w.Write(content); writeErr != nil {
		s.logger.WarnContext(r.Context(), "write response", "path", f.AbsPath, "error", writeErr)
	}
}

// statusResponse describes the daemon itself, not its catalog: the CLI polls it
// while starting or replacing a daemon, so it stays small. The catalog is served
// by /_/api/files.
type statusResponse struct {
	Version   string   `json:"version"`
	PID       int      `json:"pid"`
	FileCount int      `json:"file_count"`
	Roots     []string `json:"roots"`
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, "encode failed", http.StatusInternalServerError)
	}
}
