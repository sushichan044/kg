package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// fileChangeDebounce coalesces rapid writes (e.g. an editor saving) into a
// single file-changed notification per file.
const fileChangeDebounce = 200 * time.Millisecond

// Watcher is the single filesystem watcher. It keeps the Server catalog in sync
// with the roots and emits SSE notifications on change. Directories are watched
// (not individual files), so atomic saves that replace a file are handled by the
// persistent directory watch.
type Watcher struct {
	fsw     *fsnotify.Watcher
	srv     *Server
	roots   []string
	baseDir string
	logger  *slog.Logger

	mu      sync.Mutex
	timers  map[string]*time.Timer
	watched map[string]struct{}
}

// NewWatcher creates a Watcher, performs the initial scan, and begins watching
// the discovered directories. Call Run to process events.
func NewWatcher(srv *Server, roots []string, baseDir string, logger *slog.Logger) (*Watcher, error) {
	fsw, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, fmt.Errorf("create watcher: %w", err)
	}

	w := &Watcher{
		fsw:     fsw,
		srv:     srv,
		roots:   roots,
		baseDir: baseDir,
		logger:  logger,
		timers:  map[string]*time.Timer{},
		watched: map[string]struct{}{},
	}

	if rescanErr := w.rescan(context.Background()); rescanErr != nil {
		_ = fsw.Close()

		return nil, rescanErr
	}

	return w, nil
}

// Run processes filesystem events until ctx is cancelled, then stops watching.
func (w *Watcher) Run(ctx context.Context) {
	defer func() {
		if err := w.fsw.Close(); err != nil {
			w.logger.WarnContext(ctx, "close watcher", "error", err)
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case err, ok := <-w.fsw.Errors:
			if !ok {
				return
			}
			w.logger.WarnContext(ctx, "watch error", "error", err)
		case ev, ok := <-w.fsw.Events:
			if !ok {
				return
			}
			w.handleEvent(ctx, ev)
		}
	}
}

func (w *Watcher) handleEvent(ctx context.Context, ev fsnotify.Event) {
	// A write to a known text file only changes that file's content.
	if ev.Op.Has(fsnotify.Write) && isTxt(ev.Name) {
		w.scheduleFileChanged(ev.Name)

		return
	}

	// Create, remove, and rename may change the catalog or the directory set.
	if ev.Op.Has(fsnotify.Create) || ev.Op.Has(fsnotify.Remove) || ev.Op.Has(fsnotify.Rename) {
		if err := w.rescan(ctx); err != nil {
			w.logger.WarnContext(ctx, "rescan", "error", err)
		}
	}
}

// AddRoots extends the watched roots and rescans. It lets a second kg invocation
// forward new paths to an already-running server.
func (w *Watcher) AddRoots(paths []string) {
	w.mu.Lock()
	for _, p := range paths {
		if !slices.Contains(w.roots, p) {
			w.roots = append(w.roots, p)
		}
	}
	w.mu.Unlock()

	if err := w.rescan(context.Background()); err != nil {
		w.logger.WarnContext(context.Background(), "rescan after add roots", "error", err)
	}
}

// Roots returns a snapshot of the watched roots, used when exporting state for a
// restart.
func (w *Watcher) Roots() []string {
	w.mu.Lock()
	defer w.mu.Unlock()

	return slices.Clone(w.roots)
}

// rescan re-discovers files, updates the catalog, reconciles directory watches,
// and notifies clients when the catalog changed. It holds the mutex for its full
// duration so concurrent rescans (event loop vs. AddRoots) do not interleave.
func (w *Watcher) rescan(ctx context.Context) error {
	w.mu.Lock()
	defer w.mu.Unlock()

	files, dirs, err := discover(w.roots, w.baseDir)
	if err != nil {
		return err
	}

	changed := w.srv.SetFiles(files)
	w.reconcileWatches(ctx, dirs)

	if changed {
		w.srv.notifyCatalog()
	}

	return nil
}

func (w *Watcher) reconcileWatches(ctx context.Context, dirs []string) {
	next := make(map[string]struct{}, len(dirs))
	for _, dir := range dirs {
		next[dir] = struct{}{}
		if _, ok := w.watched[dir]; ok {
			continue
		}
		if err := w.fsw.Add(dir); err != nil {
			w.logger.WarnContext(ctx, "add watch", "dir", dir, "error", err)

			continue
		}
		w.watched[dir] = struct{}{}
	}

	for dir := range w.watched {
		if _, ok := next[dir]; ok {
			continue
		}
		// A removed directory is dropped by fsnotify automatically; Remove may
		// return an error for an already-gone path, which is safe to ignore.
		if err := w.fsw.Remove(dir); err != nil && !errors.Is(err, fsnotify.ErrNonExistentWatch) {
			w.logger.WarnContext(ctx, "remove watch", "dir", dir, "error", err)
		}
		delete(w.watched, dir)
	}
}

func (w *Watcher) scheduleFileChanged(absPath string) {
	w.mu.Lock()
	defer w.mu.Unlock()

	if t, ok := w.timers[absPath]; ok {
		t.Stop()
	}

	w.timers[absPath] = time.AfterFunc(fileChangeDebounce, func() {
		w.mu.Lock()
		delete(w.timers, absPath)
		w.mu.Unlock()

		if _, ok := w.srv.fileByID(FileID(absPath)); ok {
			w.srv.notifyFileChanged(FileID(absPath))
		}
	})
}
