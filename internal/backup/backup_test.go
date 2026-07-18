package backup_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sushichan044/kg/internal/backup"
)

func TestSaveLoad_RoundTrips(t *testing.T) {
	t.Parallel()

	path := backup.Path(t.TempDir())
	roots := []string{"/a/one", "/b/two"}

	require.NoError(t, backup.Save(path, roots))

	got, err := backup.Load(path)
	require.NoError(t, err)
	assert.Equal(t, roots, got)
}

func TestLoad_DiscardsIncompatibleVersion(t *testing.T) {
	t.Parallel()

	path := backup.Path(t.TempDir())
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))
	require.NoError(t, os.WriteFile(path, []byte(`{"version":999,"roots":["/x"]}`), 0o600))

	got, err := backup.Load(path)
	require.NoError(t, err)
	assert.Empty(t, got)
}
