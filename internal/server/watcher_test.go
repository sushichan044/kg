package server_test

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sushichan044/kg/internal/server"
)

func TestWatcher_EmitsEventsOnFilesystemChanges(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	target := filepath.Join(dir, "a.txt")
	writeFile(t, target, "hi")

	srv := newRunningServer(t, dir, dir)
	ts := httptest.NewServer(srv.Handler(dummySPA()))
	t.Cleanup(ts.Close)

	events := subscribeSSE(t, ts.URL+"/_/events")
	require.Equal(t, "started", waitFor(t, events, "started").name)

	// Writing to a known file notifies just that file.
	writeFile(t, target, "hi there")
	changed := waitFor(t, events, "file-changed")
	assert.Contains(t, changed.data, server.FileID(target))

	// Creating a new file changes the catalog.
	writeFile(t, filepath.Join(dir, "b.txt"), "b")
	waitFor(t, events, "update")
}

type sseEvent struct {
	name string
	data string
}

// subscribeSSE connects to an SSE endpoint and streams parsed events on the
// returned channel until the test ends.
func subscribeSSE(t *testing.T, url string) <-chan sseEvent {
	t.Helper()

	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	require.NoError(t, err)
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	t.Cleanup(func() { _ = resp.Body.Close() })

	out := make(chan sseEvent, 32)
	go func() {
		scanner := bufio.NewScanner(resp.Body)
		var cur sseEvent
		for scanner.Scan() {
			line := scanner.Text()
			switch {
			case strings.HasPrefix(line, "event: "):
				cur.name = strings.TrimPrefix(line, "event: ")
			case strings.HasPrefix(line, "data: "):
				cur.data = strings.TrimPrefix(line, "data: ")
			case line == "":
				if cur.name != "" {
					out <- cur
				}
				cur = sseEvent{}
			}
		}
		// The scan loop ends when the response body closes at test teardown;
		// any resulting error is expected and not actionable here.
		_ = scanner.Err()
	}()

	return out
}

// waitFor returns the next event with the given name, failing the test if it
// does not arrive in time.
func waitFor(t *testing.T, events <-chan sseEvent, name string) sseEvent {
	t.Helper()

	deadline := time.After(3 * time.Second)
	for {
		select {
		case e := <-events:
			if e.name == name {
				return e
			}
		case <-deadline:
			t.Fatalf("timed out waiting for %q event", name)

			return sseEvent{}
		}
	}
}
