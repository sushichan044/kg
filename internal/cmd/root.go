// Package cmd wires the kg command line to the HTTP server. By default `kg`
// starts (or forwards paths to) a detached background server; --foreground runs
// the server in the current process.
package cmd

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/pkg/browser"

	"github.com/sushichan044/kg/internal/backup"
	"github.com/sushichan044/kg/internal/logfile"
	"github.com/sushichan044/kg/internal/server"
	"github.com/sushichan044/kg/internal/static"
	"github.com/sushichan044/kg/internal/xdg"
)

const (
	defaultPort       = 6280
	shutdownTimeout   = 5 * time.Second
	readHeaderTimeout = 10 * time.Second

	daemonPollInterval = 100 * time.Millisecond
	daemonPollAttempts = 30
)

// Process exit codes.
const (
	exitOK         = 0
	exitRunFailure = 1
	exitUsageError = 2
)

type options struct {
	port       int
	noOpen     bool
	foreground bool
	shutdown   bool
	restart    bool
	status     bool
	jsonOut    bool
	restore    string
	roots      []string
	baseDir    string
}

// Execute parses arguments and dispatches to the requested action. It returns a
// process exit code.
func Execute() int {
	opts, err := parseArgs(os.Args[1:])
	if err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return exitOK
		}
		fmt.Fprintln(os.Stderr, "kg:", err)

		return exitUsageError
	}

	logger := slog.New(slog.NewTextHandler(os.Stderr, nil))

	if err = dispatch(opts, logger); err != nil {
		logger.ErrorContext(context.Background(), "kg failed", "error", err)

		return exitRunFailure
	}

	return exitOK
}

func parseArgs(args []string) (options, error) {
	fs := flag.NewFlagSet("kg", flag.ContinueOnError)
	fs.Usage = func() {
		fmt.Fprintln(fs.Output(), "Usage: kg [flags] [PATH ...]")
		fmt.Fprintln(fs.Output(), "\nPreview .txt files as a vertical manuscript grid.")
		fmt.Fprintln(fs.Output(), "\nFlags:")
		fs.PrintDefaults()
	}

	var opts options
	fs.IntVar(&opts.port, "port", defaultPort, "port to listen on")
	fs.IntVar(&opts.port, "p", defaultPort, "port to listen on (shorthand)")
	fs.BoolVar(&opts.noOpen, "no-open", false, "do not open the browser on start")
	fs.BoolVar(&opts.foreground, "foreground", false, "run the server in the foreground instead of daemonizing")
	fs.BoolVar(&opts.shutdown, "shutdown", false, "stop the running server")
	fs.BoolVar(&opts.restart, "restart", false, "restart the running server")
	fs.BoolVar(&opts.status, "status", false, "print the running server status")
	fs.BoolVar(&opts.jsonOut, "json", false, "with --status, print raw JSON")
	fs.StringVar(&opts.restore, "restore", "", "internal: restore watched roots from this file")

	if err := fs.Parse(args); err != nil {
		return options{}, err
	}

	baseDir, err := os.Getwd()
	if err != nil {
		return options{}, fmt.Errorf("get working directory: %w", err)
	}
	opts.baseDir = baseDir

	roots := fs.Args()
	if len(roots) == 0 {
		roots = []string{"."}
	}
	opts.roots = absPaths(roots, baseDir)

	return opts, nil
}

func absPaths(paths []string, baseDir string) []string {
	out := make([]string, 0, len(paths))
	for _, p := range paths {
		abs := p
		if !filepath.IsAbs(abs) {
			abs = filepath.Join(baseDir, abs)
		}
		out = append(out, filepath.Clean(abs))
	}

	return out
}

func dispatch(opts options, logger *slog.Logger) error {
	switch {
	case opts.shutdown:
		if err := requestShutdown(opts.port); err != nil {
			return err
		}
		fmt.Fprintln(os.Stdout, "kg: shutdown requested")

		return nil
	case opts.restart:
		if err := requestRestart(opts.port); err != nil {
			return err
		}
		fmt.Fprintln(os.Stdout, "kg: restart requested")

		return nil
	case opts.status:
		return printStatus(opts)
	case opts.foreground:
		return serveForeground(opts, logger)
	default:
		return startDaemon(opts, logger)
	}
}

func printStatus(opts options) error {
	body, err := fetchStatus(opts.port)
	if err != nil {
		fmt.Fprintln(os.Stdout, "kg: not running")

		return nil //nolint:nilerr // an unreachable server is a normal status result, not a failure
	}

	if opts.jsonOut {
		fmt.Fprintln(os.Stdout, string(body))

		return nil
	}

	var s struct {
		PID   int               `json:"pid"`
		Files []json.RawMessage `json:"files"`
	}
	if err = json.Unmarshal(body, &s); err != nil {
		return fmt.Errorf("parse status: %w", err)
	}
	fmt.Fprintf(os.Stdout, "kg is running (pid %d, %d files) on %s\n", s.PID, len(s.Files), baseURL(opts.port))

	return nil
}

// serveForeground runs the actual HTTP server in this process until it is asked
// to stop or restart.
func serveForeground(opts options, logger *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	roots := resolveRoots(opts, logger)

	srv := server.New(logger)
	watcher, err := server.NewWatcher(srv, roots, opts.baseDir, logger)
	if err != nil {
		return fmt.Errorf("start watcher: %w", err)
	}
	srv.AttachRoots(watcher)
	go watcher.Run(ctx)

	spa, err := static.Handler()
	if err != nil {
		return fmt.Errorf("build frontend handler: %w", err)
	}

	addr := fmt.Sprintf("127.0.0.1:%d", opts.port)
	var lc net.ListenConfig
	ln, err := lc.Listen(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", addr, err)
	}

	httpSrv := &http.Server{Handler: srv.Handler(spa), ReadHeaderTimeout: readHeaderTimeout}
	httpSrv.RegisterOnShutdown(srv.CloseSubscribers)

	url := fmt.Sprintf("http://localhost:%d", opts.port)
	logger.InfoContext(ctx, "kg is running", "url", url, "files", len(srv.Files()))
	if !opts.noOpen {
		if openErr := browser.OpenURL(url); openErr != nil {
			logger.WarnContext(ctx, "open browser", "error", openErr)
		}
	}

	restart, err := serve(ctx, srv, httpSrv, ln, logger)
	if err != nil {
		return err
	}
	if restart {
		return restartDaemon(opts, watcher, logger)
	}

	return nil
}

// resolveRoots picks the roots to watch: a restore file (set on restart) takes
// precedence over the positional arguments.
func resolveRoots(opts options, logger *slog.Logger) []string {
	if opts.restore == "" {
		return opts.roots
	}

	restored, err := backup.Load(opts.restore)
	if err != nil {
		logger.WarnContext(context.Background(), "load restore file", "error", err)

		return opts.roots
	}
	if len(restored) == 0 {
		return opts.roots
	}

	return restored
}

func serve(
	ctx context.Context,
	srv *server.Server,
	httpSrv *http.Server,
	ln net.Listener,
	logger *slog.Logger,
) (bool, error) {
	errCh := make(chan error, 1)
	go func() { errCh <- httpSrv.Serve(ln) }()

	select {
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return false, fmt.Errorf("serve: %w", err)
		}

		return false, nil
	case <-ctx.Done():
		return false, shutdownServer(httpSrv)
	case <-srv.ShutdownRequested():
		logger.InfoContext(ctx, "shutdown requested")

		return false, shutdownServer(httpSrv)
	case <-srv.RestartRequested():
		logger.InfoContext(ctx, "restart requested")

		return true, shutdownServer(httpSrv)
	}
}

func shutdownServer(httpSrv *http.Server) error {
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}

	return nil
}

// startDaemon forwards paths to a running server, or spawns a detached one.
func startDaemon(opts options, logger *slog.Logger) error {
	if probeRunning(opts.port) {
		if len(opts.roots) > 0 {
			if err := addRoots(opts.port, opts.roots); err != nil {
				return err
			}
		}
		openIfWanted(opts)
		fmt.Fprintf(os.Stdout, "kg is already running on %s\n", baseURL(opts.port))

		return nil
	}

	if err := spawnFromState(opts, opts.roots, logger); err != nil {
		return err
	}

	if !waitUntilRunning(opts.port) {
		return fmt.Errorf("kg did not start listening on port %d; check the log", opts.port)
	}

	openIfWanted(opts)
	fmt.Fprintf(os.Stdout, "kg is running on %s\n", baseURL(opts.port))

	return nil
}

// restartDaemon exports the current roots and spawns a fresh detached server.
func restartDaemon(opts options, watcher *server.Watcher, logger *slog.Logger) error {
	return spawnFromState(opts, watcher.Roots(), logger)
}

// spawnFromState writes the roots to the restore file and launches a detached
// server that reads them back.
func spawnFromState(opts options, roots []string, logger *slog.Logger) error {
	stateDir, err := xdg.StateHome()
	if err != nil {
		return fmt.Errorf("resolve state dir: %w", err)
	}

	restorePath := backup.Path(stateDir)
	if err = backup.Save(restorePath, roots); err != nil {
		return fmt.Errorf("save state: %w", err)
	}

	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve executable: %w", err)
	}

	logFile, err := logfile.Open(stateDir)
	if err != nil {
		return fmt.Errorf("open log: %w", err)
	}
	defer func() { _ = logFile.Close() }()

	if err = spawnDaemon(exe, opts.port, restorePath, logFile); err != nil {
		return err
	}
	logger.InfoContext(context.Background(), "spawned background server", "log", logFile.Name())

	return nil
}

func waitUntilRunning(port int) bool {
	for range daemonPollAttempts {
		if probeRunning(port) {
			return true
		}
		time.Sleep(daemonPollInterval)
	}

	return false
}

func openIfWanted(opts options) {
	if opts.noOpen {
		return
	}
	_ = browser.OpenURL(baseURL(opts.port))
}
