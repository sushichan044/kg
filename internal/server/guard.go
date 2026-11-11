package server

import (
	"mime"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

// maxRequestBodyBytes caps JSON request bodies. The largest legitimate body is
// a list of root paths, which stays far below this.
const maxRequestBodyBytes = 1 << 20

// loopbackGuard rejects requests that do not address this server by its own
// loopback origin. Listening on 127.0.0.1 does not stop a web page on another
// origin from making the browser send requests here.
//
//   - DNS rebinding: a hostile domain re-resolves to 127.0.0.1.
//     Its pages then become same-origin with kg and could read file contents.
//     The browser still sends the hostile domain in Host, so Host is pinned.
//   - Cross-site POST: a hostile page can send a POST without a CORS preflight
//     if it uses text/plain or a form encoding.
//     Requiring application/json forces a preflight, which kg never answers.
//
// The kg CLI sends no Origin and always sets Content-Type: application/json.
func loopbackGuard(port int, next http.Handler) http.Handler {
	p := strconv.Itoa(port)
	allowedHosts := map[string]bool{
		net.JoinHostPort("127.0.0.1", p): true,
		net.JoinHostPort("localhost", p): true,
		net.JoinHostPort("::1", p):       true,
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowedHosts[strings.ToLower(r.Host)] {
			http.Error(w, "forbidden host", http.StatusForbidden)

			return
		}

		if origin := r.Header.Get("Origin"); origin != "" && !isAllowedOrigin(origin, allowedHosts) {
			http.Error(w, "forbidden origin", http.StatusForbidden)

			return
		}

		if r.Method == http.MethodPost && !isJSONContentType(r.Header.Get("Content-Type")) {
			http.Error(w, "content type must be application/json", http.StatusUnsupportedMediaType)

			return
		}

		next.ServeHTTP(w, r)
	})
}

func isAllowedOrigin(origin string, allowedHosts map[string]bool) bool {
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}

	return u.Scheme == "http" && allowedHosts[strings.ToLower(u.Host)]
}

func isJSONContentType(value string) bool {
	mediaType, _, err := mime.ParseMediaType(value)

	return err == nil && mediaType == "application/json"
}
