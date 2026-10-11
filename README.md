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

## Bundled Mincho typography

The application's existing Mincho choice uses GenEi Koburi Mincho 6.1a Regular.
Japanese text keeps fixed pitch; sideways Western words use actual font advances
and ligature clusters. The font and HarfBuzz WASM are embedded in the Go binary,
so runtime font loading requires no upstream connection. The application waits
for font readiness and offers retry on failure. Existing `mincho` preferences and
saved presets continue to work; Gothic keeps its logical layout behavior.

The original font is distributed under SIL OFL 1.1, with its license served at
`/licenses/genei-koburi-OFL.txt`. HarfBuzzJS's MIT notice is served beside it.
See [ADR 0008](docs/adr/0008-bundle-genei-koburi-browser-typography.md) and the
[real-font report](docs/plans/adr-0007-font-proof/report.md).
