// Package backup persists the set of watched roots so a restarted server can
// resume watching the same paths. The payload carries a top-level version; an
// incompatible version is discarded rather than misinterpreted.
package backup

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const (
	version = 1
	dirName = "kg"
	file    = "roots.json"
)

type state struct {
	Version int      `json:"version"`
	Roots   []string `json:"roots"`
}

// Path returns the backup file location under stateDir.
func Path(stateDir string) string {
	return filepath.Join(stateDir, dirName, file)
}

// Save atomically writes the roots to path (write-temp-then-rename).
func Save(path string, roots []string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return fmt.Errorf("create backup directory: %w", err)
	}

	data, err := json.Marshal(state{Version: version, Roots: roots})
	if err != nil {
		return fmt.Errorf("marshal backup: %w", err)
	}

	tmp := path + ".tmp"
	if err = os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("write backup: %w", err)
	}
	if err = os.Rename(tmp, path); err != nil {
		return fmt.Errorf("replace backup: %w", err)
	}

	return nil
}

// Load reads the roots from path. An incompatible version yields an empty slice
// so the caller falls back to its own defaults.
func Load(path string) ([]string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read backup: %w", err)
	}

	var s state
	if err = json.Unmarshal(data, &s); err != nil {
		return nil, fmt.Errorf("parse backup: %w", err)
	}
	if s.Version != version {
		return nil, nil
	}

	return s.Roots, nil
}
