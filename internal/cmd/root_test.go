package cmd //nolint:testpackage // parseArgs is unexported; the CLI surface is exercised directly.

import (
	"io/fs"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseArgs_RejectsNonexistentPath(t *testing.T) {
	t.Parallel()

	missing := filepath.Join(t.TempDir(), "typo.txt")

	_, err := parseArgs([]string{missing})

	require.Error(t, err)
	require.ErrorIs(t, err, fs.ErrNotExist)
	assert.Contains(t, err.Error(), missing)
}

func TestParseArgs_AcceptsExistingPath(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	opts, err := parseArgs([]string{dir})

	require.NoError(t, err)
	assert.Equal(t, []string{dir}, opts.roots)
}
