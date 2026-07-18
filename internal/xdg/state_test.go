package xdg_test

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sushichan044/kg/internal/xdg"
)

func TestStateHome_PrefersXDGStateHome(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("XDG_STATE_HOME is not consulted on Windows")
	}

	t.Setenv("XDG_STATE_HOME", "/custom/state")

	got, err := xdg.StateHome()
	require.NoError(t, err)
	assert.Equal(t, "/custom/state", got)
}

func TestStateHome_FallsBackToLocalState(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("uses %LOCALAPPDATA% on Windows")
	}

	t.Setenv("XDG_STATE_HOME", "")
	t.Setenv("HOME", "/home/tester")

	got, err := xdg.StateHome()
	require.NoError(t, err)
	assert.Equal(t, filepath.Join("/home/tester", ".local", "state"), got)
}
