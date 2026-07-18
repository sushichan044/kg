// Package xdg resolves platform-appropriate base directories. It mirrors the
// OS-branching shape of sushichan044/sidetable's xdg helper, but maps the state
// directory to machine-local (non-roaming) storage on every platform.
package xdg

import (
	"os"
	"path/filepath"
	"runtime"
)

// StateHome returns the base directory for machine-local application state
// (logs, session backups) that should persist between runs but not roam between
// machines.
//
//   - Windows: %LOCALAPPDATA% (not %APPDATA%, which roams and is for config).
//   - Otherwise: $XDG_STATE_HOME, falling back to ~/.local/state.
func StateHome() (string, error) {
	if runtime.GOOS == "windows" {
		if dir := os.Getenv("LOCALAPPDATA"); dir != "" {
			return filepath.Clean(dir), nil
		}
		// os.UserCacheDir returns %LOCALAPPDATA% on Windows.
		return os.UserCacheDir()
	}

	if dir := os.Getenv("XDG_STATE_HOME"); dir != "" {
		return filepath.Clean(dir), nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	return filepath.Join(home, ".local", "state"), nil
}
