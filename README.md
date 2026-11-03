# kg

`kg` is a toolkit for programmatically handling Japanese novel texts.
It allows for parsing, normalization of proprietary notation used on web novel platforms, and column formatting with layout settings.
It also provides writing-assist preview tools, a CLI, and more.

> [!TIP]
> `kg` means `karigumi` and `kaguya`.

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

Frontend-only development uses a local mock catalog and update stream:

```sh
vp run --filter kg-frontend dev:mock
```

Open <http://localhost:5174> and edit the sample manuscripts under
[`internal/frontend/mock/manuscripts`](./internal/frontend/mock/manuscripts).
See the [mock environment guide](./internal/frontend/mock/README.md) for details.

Full-stack frontend development uses the Go server on port 6280:

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
