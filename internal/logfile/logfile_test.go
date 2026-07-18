package logfile_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sushichan044/kg/internal/logfile"
)

func TestOpen_CreatesAppendableLog(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	f, err := logfile.Open(dir)
	require.NoError(t, err)
	_, writeErr := f.WriteString("hello\n")
	require.NoError(t, writeErr)
	require.NoError(t, f.Close())

	content, err := os.ReadFile(filepath.Join(dir, "kg", "kg.log"))
	require.NoError(t, err)
	assert.Equal(t, "hello\n", string(content))
}

func TestOpen_AppendsAcrossOpens(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()

	first, err := logfile.Open(dir)
	require.NoError(t, err)
	_, _ = first.WriteString("a\n")
	require.NoError(t, first.Close())

	second, err := logfile.Open(dir)
	require.NoError(t, err)
	_, _ = second.WriteString("b\n")
	require.NoError(t, second.Close())

	content, err := os.ReadFile(filepath.Join(dir, "kg", "kg.log"))
	require.NoError(t, err)
	assert.Equal(t, "a\nb\n", string(content))
}
