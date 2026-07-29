# kg

`kg` is a local browser previewer for Japanese novels and short stories written
as plain-text files. It watches the source files, lays them out on a vertical
manuscript grid, and refreshes the browser as the files change.

The preview is an approximate visual check rather than print-ready typesetting.
It intentionally leaves line-breaking and novel-style errors in place so the
writer corrects the original manuscript.

## Installation

```sh
go install github.com/sushichan044/kg@latest
```

## Development

```sh
pnpm install
vp run build
vp run test
```

Frontend development uses the Go server on port 6280:

```sh
go run . --foreground --no-open
vp run --filter kg-frontend dev
```

## Packages

Reusable packages are maintained in this repository:

- [`@sushichan044/kg-core`](./packages/core/README.md) provides
  framework-independent layout and proofreading utilities.
- [`@sushichan044/kg-viewer`](./packages/viewer/README.md) provides the React
  viewer and diagnostic feedback components.

## License

MIT
