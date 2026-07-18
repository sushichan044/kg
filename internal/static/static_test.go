package static_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/sushichan044/kg/internal/static"
)

func serve(t *testing.T, path string) *httptest.ResponseRecorder {
	t.Helper()

	h, err := static.Handler()
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, path, nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	return rec
}

func TestHandler_ServesEmbeddedIndex(t *testing.T) {
	t.Parallel()

	rec := serve(t, "/")
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `<div id="root">`)
}

func TestHandler_FallsBackToIndexForClientRoutes(t *testing.T) {
	t.Parallel()

	rec := serve(t, "/some/client/route")
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), `<div id="root">`)
}
