// Package cmd wires the kg command line to the HTTP server. By default `kg`
// starts (or forwards paths to) a detached background server; --foreground runs
// the server in the current process.
package cmd

import (
	"context"
	"encoding/json"
	"errors"
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
	"github.com/spf13/pflag"

	"github.com/sushichan044/kg/internal/backup"
	"github.com/sushichan044/kg/internal/logfile"
	"github.com/sushichan044/kg/internal/server"
	"github.com/sushichan044/kg/internal/static"
	"github.com/sushichan044/kg/internal/version"
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
		if errors.Is(err, pflag.ErrHelp) {
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
	fs := pflag.NewFlagSet("kg", pflag.ContinueOnError)
	fs.SetInterspersed(false)
	fs.Usage = func() {
		fmt.Fprintln(fs.Output(), "Usage: kg [flags] [PATH ...]")
		fmt.Fprintln(fs.Output(), "\nPreview .txt files as a vertical manuscript grid.")
		fmt.Fprintln(fs.Output(), "\nFlags:")
		fs.PrintDefaults()
	}

	var opts options
	var help bool
	fs.IntVarP(&opts.port, "port", "p", defaultPort, "port to listen on")
	fs.BoolVar(&opts.noOpen, "no-open", false, "do not open the browser on start")
	fs.BoolVar(&opts.foreground, "foreground", false, "run the server in the foreground instead of daemonizing")
	fs.BoolVar(&opts.shutdown, "shutdown", false, "stop the running server")
	fs.BoolVar(&opts.restart, "restart", false, "restart the running server")
	fs.BoolVar(&opts.status, "status", false, "print the running server status")
	fs.BoolVar(&opts.jsonOut, "json", false, "with --status, print raw JSON")
	fs.StringVar(&opts.restore, "restore", "", "internal: restore watched roots from this file")
	fs.BoolVarP(&help, "help", "h", false, "show help")

	if err := fs.Parse(args); err != nil {
		return options{}, err
	}
	if help {
		fs.Usage()

		return options{}, pflag.ErrHelp
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
	status, err := fetchStatus(opts.port)
	if err != nil {
		fmt.Fprintln(os.Stdout, "kg: not running")

		return nil //nolint:nilerr // an unreachable server is a normal status result, not a failure
	}

	if opts.jsonOut {
		if err = json.NewEncoder(os.Stdout).Encode(status); err != nil {
			return fmt.Errorf("write status: %w", err)
		}

		return nil
	}
	fmt.Fprintf(
		os.Stdout,
		"kg is running (pid %d, version %s, %d files, %d roots) on %s\n",
		status.PID,
		status.Version,
		status.FileCount,
		len(status.Roots),
		baseURL(opts.port),
	)

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

type daemonSpawner func(options, []string, *slog.Logger) error

// startDaemon forwards paths to a matching server, replaces an outdated
// server, or spawns a detached one.
func startDaemon(opts options, logger *slog.Logger) error {
	return startDaemonWith(opts, logger, spawnFromState)
}

func startDaemonWith(opts options, logger *slog.Logger, spawn daemonSpawner) error {
	status, err := fetchStatusWithTimeout(opts.port, probeTimeout)
	if err == nil && status.Version == version.Get() {
		if len(opts.roots) > 0 {
			if addErr := addRoots(opts.port, opts.roots); addErr != nil {
				return addErr
			}
		}
		openIfWanted(opts)
		fmt.Fprintf(os.Stdout, "kg is already running on %s\n", baseURL(opts.port))

		return nil
	}

	if err == nil {
		return replaceDaemon(opts, status, logger, spawn)
	}

	if err = spawn(opts, opts.roots, logger); err != nil {
		return err
	}

	if !waitUntilVersion(opts.port, version.Get()) {
		return fmt.Errorf(
			"kg did not start version %q on port %d; check the log",
			version.Get(),
			opts.port,
		)
	}

	openIfWanted(opts)
	fmt.Fprintf(os.Stdout, "kg is running on %s\n", baseURL(opts.port))

	return nil
}

func replaceDaemon(
	opts options,
	status daemonStatus,
	logger *slog.Logger,
	spawn daemonSpawner,
) error {
	// A daemon that reports roots always reports an array, so nil means it is old
	// enough to predate the field and its roots have to come from the backup.
	// An empty array is an answer, not a gap: reading it as one would resurrect
	// paths the user stopped watching.
	roots := status.Roots
	if roots == nil {
		roots = loadBackupRoots(logger)
	}
	roots = mergeRoots(roots, opts.roots)

	if err := requestShutdown(opts.port); err != nil {
		return fmt.Errorf("stop outdated kg version %q: %w", status.Version, err)
	}
	if !waitUntilStopped(opts.port) {
		return fmt.Errorf("outdated kg on port %d did not stop", opts.port)
	}
	if err := spawn(opts, roots, logger); err != nil {
		return err
	}
	if !waitUntilVersion(opts.port, version.Get()) {
		return fmt.Errorf(
			"kg did not restart with version %q on port %d; check the log",
			version.Get(),
			opts.port,
		)
	}

	openIfWanted(opts)
	fmt.Fprintf(os.Stdout, "kg restarted on %s\n", baseURL(opts.port))

	return nil
}

func loadBackupRoots(logger *slog.Logger) []string {
	stateDir, err := xdg.StateHome()
	if err != nil {
		logger.WarnContext(context.Background(), "resolve state dir for daemon replacement", "error", err)

		return nil
	}

	roots, err := backup.Load(backup.Path(stateDir))
	if err != nil {
		logger.WarnContext(context.Background(), "load roots for daemon replacement", "error", err)

		return nil
	}

	return roots
}

func mergeRoots(existing, added []string) []string {
	roots := make([]string, 0, len(existing)+len(added))
	seen := make(map[string]struct{}, len(existing)+len(added))
	for _, root := range existing {
		if _, ok := seen[root]; ok {
			continue
		}
		seen[root] = struct{}{}
		roots = append(roots, root)
	}
	for _, root := range added {
		if _, ok := seen[root]; ok {
			continue
		}
		seen[root] = struct{}{}
		roots = append(roots, root)
	}

	return roots
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

func waitUntilStopped(port int) bool {
	for range daemonPollAttempts {
		if !probeRunning(port) {
			return true
		}
		time.Sleep(daemonPollInterval)
	}

	return false
}

func waitUntilVersion(port int, expected string) bool {
	for range daemonPollAttempts {
		status, err := fetchStatusWithTimeout(port, probeTimeout)
		if err == nil && status.Version == expected {
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
