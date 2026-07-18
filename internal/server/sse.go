package server

import (
	"fmt"
	"net/http"
)

// SSE event names, mirroring mo's semantics.
const (
	// eventStarted identifies the server process so the browser can reload
	// after a server replacement. It carries the process PID.
	eventStarted = "started"
	// eventUpdate tells the client to refetch the file list.
	eventUpdate = "update"
	// eventFileChanged carries a file ID and tells the client to refetch that
	// file when it is selected.
	eventFileChanged = "file-changed"
)

func (s *Server) handleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)

		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	ch := s.hub.subscribe()
	defer s.hub.unsubscribe(ch)

	// Announce the process identity so a reconnecting client can detect a
	// server replacement (different PID) and reload.
	writeEvent(w, flusher, event{name: eventStarted, data: fmt.Sprintf(`{"pid":%d}`, s.pid)})

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case e, open := <-ch:
			if !open {
				return
			}
			writeEvent(w, flusher, e)
		}
	}
}

func writeEvent(w http.ResponseWriter, flusher http.Flusher, e event) {
	// A write error means the client is gone; the handler loop will exit on the
	// next context cancellation, so we ignore it here.
	_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", e.name, e.data)
	flusher.Flush()
}
