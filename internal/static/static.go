// Package static embeds the built frontend and serves it as a single-page
// application. During release builds the Go binary is self-contained; the
// embedded files are produced by the frontend build (see the go:generate
// directive below).
package static

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:generate sh -c "cd ../frontend && pnpm install && pnpm run build"

//go:embed all:dist
var dist embed.FS

// Handler serves the embedded SPA. Requests for existing assets are served
// directly; any other path falls back to index.html so client-side rendering
// can take over.
func Handler() (http.Handler, error) {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		return nil, err
	}

	fileServer := http.FileServer(http.FS(sub))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requested := strings.TrimPrefix(r.URL.Path, "/")
		if requested != "" {
			if _, statErr := fs.Stat(sub, requested); statErr != nil {
				// Unknown path: let the SPA handle routing.
				r.URL.Path = "/"
			}
		}
		fileServer.ServeHTTP(w, r)
	}), nil
}
