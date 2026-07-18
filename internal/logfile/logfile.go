// Package logfile provides the append log used by the background (daemon) server,
// which has no terminal to write to. The previous log is rotated aside once it
// grows past a size cap.
package logfile

import (
	"fmt"
	"os"
	"path/filepath"
)

const (
	maxSize = 5 << 20 // 5 MiB
	dirName = "kg"
	logName = "kg.log"
)

// Open returns an append writer to the daemon log under stateDir, rotating the
// existing log to <name>.1 if it has grown past the size cap. The caller owns
// the returned file and must close it.
func Open(stateDir string) (*os.File, error) {
	dir := filepath.Join(stateDir, dirName)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, fmt.Errorf("create log directory: %w", err)
	}

	path := filepath.Join(dir, logName)
	rotateIfLarge(path)

	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return nil, fmt.Errorf("open log file: %w", err)
	}

	return f, nil
}

func rotateIfLarge(path string) {
	info, err := os.Stat(path)
	if err != nil || info.Size() <= maxSize {
		return
	}
	// Best-effort: if rotation fails we keep appending to the existing file.
	_ = os.Rename(path, path+".1")
}
