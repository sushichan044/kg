# Frontend mock environment

Run the application without a Go server:

```sh
vp run --filter kg-frontend dev:mock
```

Open <http://localhost:5174>. This runs the same application, fonts, composition
engine, and styles as the normal frontend.

Edit or add `.txt` files under `manuscripts/` to change the mock catalog. Nested
directories appear in the file picker. Saving a file reloads its preview through
the regular SSE connection; adding or removing a file updates the catalog.

The examples cover proofreading diagnostics, Pixiv annotations, Japanese file
names, and a manuscript long enough to test scrolling and spreads. Use the
notation setting to test Kakuyomu text.

The Vite plugin serves only the mock catalog, manuscript content, and SSE
endpoints. It is enabled only by `--mode mock` during development. Normal `dev`
continues to proxy to the Go server, and production builds do not include the
mock server or manuscripts.
