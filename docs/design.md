# Architecture

`kg` is a local browser previewer for Japanese plain-text manuscripts. The
repository separates reusable manuscript processing from rendering and from the
application that loads files and presents the browser shell.

## Dependency direction

```text
Go server
    │ HTTP + SSE
    ▼
internal/frontend ──▶ packages/viewer ──▶ packages/core
        │                                      ▲
        └──────────────────────────────────────┘
```

- `packages/core` has no React, DOM, filesystem, or browser-storage dependency.
- `packages/viewer` depends on core and React, but not on the application.
- `internal/frontend` consumes public package APIs and owns orchestration.
- The Go server owns filesystem access, not manuscript processing.

## Core processing

`@sushichan044/kg-core` provides four explicit boundaries:

```text
source ──parse──▶ ParsedManuscript ──compose──▶ ComposedManuscript
                       │                              │
                       └────────proofread─────────────┘──▶ diagnostics
```

The values crossing these boundaries are readonly plain objects. Core does not
own a controller, subscription lifecycle, preferences, selection, or
persistence.

Parsers normalize service-specific source notation into display graphemes and a
closed annotation union. Ruby readings preserve their semantic association as
`group`, `mono`, or `jukugo`. The built-in `novelComposer` applies Japanese line
breaking and paragraph-wide line adjustment, then emits a `glyph | glue | kern |
suppressed` inline-item stream and positioned annotation fragments. Glyphs expose
separate typographic layout and visual render spans. Core pairs that layout with the
manuscript and the settings it already validated. Proofreading rules declare
which manuscript they inspect through a `kind` discriminant on the rule itself.

Source, display, and grapheme ranges share one structural representation but
use distinct branded types. Source and display offsets are zero-based,
end-exclusive UTF-16 offsets. Grapheme offsets index the parsed grapheme array.
Plugin IDs are a branded `NamespacedId` once validated at the boundary.

Each concept is one module holding a type and a companion object of the same
name, which owns that type's schema and operations. `index.ts` only re-exports.

The package has three entry points, split by what the importer is doing rather
than by where the code lives:

- `@sushichan044/kg-core` — running the pipeline and reading its result.
- `@sushichan044/kg-core/lint` — proofreading, including authoring rules.
- `@sushichan044/kg-core/plugin` — supplying an implementation to core: a
  parser, a composer, or a measurer.

A name is exported only when one of those three has to write it. Helpers core
keeps for itself are not exported at all, and a companion object is exported as
a value only when one of the three calls something on it — a companion holding
nothing but a schema, or whose operations only core itself calls, is exported
with `export type`, which keeps its schema out of the API.

Two consequences worth stating. Nothing outside `src/proofreading` imports from
it, so an application that only sets text never pulls the rules in. Diagnostics
stay in the root entry regardless, because parser warnings travel as the same
type.

## Runtime validation

Core exports Valibot schemas for its public DTOs and settings. TypeScript types
are inferred from those schemas. Parser results, composer settings and results,
and proofreading reports are validated at their public boundaries.

Custom composers supply schemas for their settings and layout. This keeps
runtime validation extensible without teaching core the shape of every future
layout. Structural and cross-field failures return `ManuscriptResult` errors;
core does not clamp invalid values or accept partially valid plugin output.

Each stage owns a discriminated error union, and a failed `ManuscriptResult`
carries exactly one of its variants so callers can branch exhaustively. A
plugin reports its own refusal as a `Rejection` carrying a reason, which core
converts into a variant of that stage's union.

Internal code trusts values after they cross a validated boundary. React props
and reducer actions are not repeatedly parsed when their producers are already
typed internal code.

## Viewer

`@sushichan044/kg-viewer` is rendering-only. `NovelViewer` receives a composed
novel snapshot, diagnostics, active diagnostic ID, zoom, and a `showGrid`
presentation option through controlled props. `DiagnosticList` receives the
same diagnostic selection state. The optional ruling is a decoration layer;
turning it off does not recompose or reposition the text.

The viewer does not parse source, compose pages, run rules, register plugins,
manage settings, or persist preferences. DOM-only navigation remains available
through the viewer ref handle. Visible-page and effective-zoom changes are
reported as events.

Viewer CSS is explicitly imported and scoped with the `kgv-` namespace. React
and React DOM remain peer dependencies.

## Frontend application

`internal/frontend` owns the application reducer and derives processing results
with a synchronous parse, compose, and proofread pipeline. It also owns:

- file catalog and content requests;
- server-sent file events;
- selected document and diagnostic state;
- composition settings, grid visibility, zoom, and presets;
- desktop and mobile shells; and
- local and session persistence.

Processing failures replace the preview with an explicit error instead of
showing a stale composed snapshot. The initial implementation recomputes the
full pipeline synchronously; async or incremental processing can be introduced
at the application boundary without changing core or viewer ownership.

## Persistence

Application selection and manuscript preferences use separate keys:

- `kg.app.state.v1` stores the selected path.
- `kg.manuscript.preferences.v6` stores composition settings, grid visibility,
  zoom, and presets.
- per-document visible-page state uses best-effort session storage.

The frontend validates current payloads with Valibot and falls back to defaults
for malformed or incompatible values. Versions 3 through 5 are migrated to the
novel flow settings; version 5's former grid dimensions become line length,
lines per stage, and stages per page. Migrated preferences show the ruling by
default.

## Server boundary

The Go server is the only filesystem owner and watcher. It exposes file
discovery and content through HTTP and reports catalog, file, and process
changes through server-sent events. Release builds embed the frontend in the Go
binary; development uses the same HTTP boundary through the frontend proxy.

The frontend parses HTTP responses and server-sent event payloads with Valibot
schemas rather than asserting their declared shape, since both arrive as text
from outside the type system.

## Non-goals

The architecture does not provide print-accurate typesetting, source editing,
automatic correction, generic annotations, asynchronous processing, or
incremental recomposition. The optional ruling is not a promise that the layout
behaves like manuscript paper. Those capabilities require concrete use cases
before their contracts are added.
