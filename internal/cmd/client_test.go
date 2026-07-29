package cmd //nolint:testpackage // White-box coverage keeps daemon process spawning replaceable in tests.

import (
	"encoding/json"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sushichan044/kg/internal/backup"
	"github.com/sushichan044/kg/internal/version"
)

func TestStartDaemon_ReusesMatchingVersion(t *testing.T) {
	t.Parallel()

	daemon := newFakeDaemon(t, version.Get(), []string{"/old"})
	var spawned bool

	err := startDaemonWith(
		options{
			port:   daemon.port(t),
			noOpen: true,
			roots:  []string{"/new"},
		},
		slog.New(slog.DiscardHandler),
		func(options, []string, *slog.Logger) error {
			spawned = true

			return nil
		},
	)

	require.NoError(t, err)
	assert.False(t, spawned)
	assert.Equal(t, [][]string{{"/new"}}, daemon.addedRoots())
	assert.Equal(t, 0, daemon.shutdownCount())
}

func TestStartDaemon_ReplacesDifferentVersionWithCurrentExecutable(t *testing.T) {
	t.Parallel()

	daemon := newFakeDaemon(t, "v0.0.3", []string{"/old", "/shared"})
	var spawnedRoots []string

	err := startDaemonWith(
		options{
			port:   daemon.port(t),
			noOpen: true,
			roots:  []string{"/shared", "/new"},
		},
		slog.New(slog.DiscardHandler),
		func(_ options, roots []string, _ *slog.Logger) error {
			spawnedRoots = roots
			daemon.start(version.Get())

			return nil
		},
	)

	require.NoError(t, err)
	assert.Equal(t, []string{"/old", "/shared", "/new"}, spawnedRoots)
	assert.Empty(t, daemon.addedRoots())
	assert.Equal(t, 1, daemon.shutdownCount())
}

func TestStartDaemon_ReplacesLegacyDaemonUsingBackedUpRoots(t *testing.T) {
	stateHome := t.TempDir()
	t.Setenv("XDG_STATE_HOME", stateHome)
	require.NoError(t, backup.Save(backup.Path(stateHome), []string{"/saved"}))

	daemon := newFakeDaemon(t, "", nil)
	var spawnedRoots []string

	err := startDaemonWith(
		options{
			port:   daemon.port(t),
			noOpen: true,
			roots:  []string{"/new"},
		},
		slog.New(slog.DiscardHandler),
		func(_ options, roots []string, _ *slog.Logger) error {
			spawnedRoots = roots
			daemon.start(version.Get())

			return nil
		},
	)

	require.NoError(t, err)
	assert.Equal(t, []string{"/saved", "/new"}, spawnedRoots)
	assert.Equal(t, 1, daemon.shutdownCount())
}

func TestStartDaemon_ReplacesRootlessDaemonWithoutRestoringBackup(t *testing.T) {
	stateHome := t.TempDir()
	t.Setenv("XDG_STATE_HOME", stateHome)
	require.NoError(t, backup.Save(backup.Path(stateHome), []string{"/stale"}))

	daemon := newFakeDaemon(t, "v0.0.3", []string{})
	var spawnedRoots []string

	err := startDaemonWith(
		options{
			port:   daemon.port(t),
			noOpen: true,
			roots:  []string{"/new"},
		},
		slog.New(slog.DiscardHandler),
		func(_ options, roots []string, _ *slog.Logger) error {
			spawnedRoots = roots
			daemon.start(version.Get())

			return nil
		},
	)

	require.NoError(t, err)
	assert.Equal(t, []string{"/new"}, spawnedRoots)
	assert.Equal(t, 1, daemon.shutdownCount())
}

type fakeDaemon struct {
	mu sync.Mutex

	running   bool
	version   string
	roots     []string
	added     [][]string
	shutdowns int

	server *httptest.Server
}

func newFakeDaemon(t *testing.T, daemonVersion string, roots []string) *fakeDaemon {
	t.Helper()

	daemon := &fakeDaemon{
		running: true,
		version: daemonVersion,
		roots:   roots,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /_/api/status", daemon.handleStatus)
	mux.HandleFunc("POST /_/api/roots", daemon.handleAddRoots)
	mux.HandleFunc("POST /_/api/shutdown", daemon.handleShutdown)
	daemon.server = httptest.NewServer(mux)
	t.Cleanup(daemon.server.Close)

	return daemon
}

func (d *fakeDaemon) handleStatus(w http.ResponseWriter, _ *http.Request) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if !d.running {
		http.Error(w, "not running", http.StatusServiceUnavailable)

		return
	}

	_ = json.NewEncoder(w).Encode(daemonStatus{
		Version: d.version,
		Roots:   d.roots,
	})
}

func (d *fakeDaemon) handleAddRoots(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Paths []string `json:"paths"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)

		return
	}

	d.mu.Lock()
	d.added = append(d.added, body.Paths)
	d.mu.Unlock()
	w.WriteHeader(http.StatusAccepted)
}

func (d *fakeDaemon) handleShutdown(w http.ResponseWriter, _ *http.Request) {
	d.mu.Lock()
	d.shutdowns++
	d.running = false
	d.mu.Unlock()
	w.WriteHeader(http.StatusAccepted)
}

func (d *fakeDaemon) start(daemonVersion string) {
	d.mu.Lock()
	d.version = daemonVersion
	d.running = true
	d.mu.Unlock()
}

func (d *fakeDaemon) port(t *testing.T) int {
	t.Helper()

	parsed, err := url.Parse(d.server.URL)
	require.NoError(t, err)
	_, port, err := net.SplitHostPort(parsed.Host)
	require.NoError(t, err)
	n, err := strconv.Atoi(port)
	require.NoError(t, err)

	return n
}

func (d *fakeDaemon) addedRoots() [][]string {
	d.mu.Lock()
	defer d.mu.Unlock()

	return d.added
}

func (d *fakeDaemon) shutdownCount() int {
	d.mu.Lock()
	defer d.mu.Unlock()

	return d.shutdowns
}
