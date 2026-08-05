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
