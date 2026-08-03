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
closed annotation union. Composers receive a parsed manuscript and produce a
self-contained layout snapshot. Proofreading rules explicitly declare whether
they inspect parsed or composed data.

Source, display, and grapheme ranges share one structural representation but
use distinct branded types. Source and display offsets are zero-based,
end-exclusive UTF-16 offsets. Grapheme offsets index the parsed grapheme array.

## Runtime validation

Core exports Valibot schemas for its public DTOs and settings. TypeScript types
are inferred from those schemas. Parser results, composer settings and results,
and proofreading reports are validated at their public boundaries.

Custom composers supply schemas for their settings and layout. This keeps
runtime validation extensible without teaching core the shape of every future
layout. Structural and cross-field failures return `ManuscriptResult` errors;
core does not clamp invalid values or accept partially valid plugin output.

Internal code trusts values after they cross a validated boundary. React props
and reducer actions are not repeatedly parsed when their producers are already
typed internal code.

## Viewer

`@sushichan044/kg-viewer` is rendering-only. `ManuscriptViewer` receives a
composed grid snapshot, diagnostics, active diagnostic ID, and zoom through
controlled props. `DiagnosticList` receives the same diagnostic selection
state.

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
- composition settings, zoom, and presets;
- desktop and mobile shells; and
- local and session persistence.

Processing failures replace the preview with an explicit error instead of
showing a stale composed snapshot. The initial implementation recomputes the
full pipeline synchronously; async or incremental processing can be introduced
at the application boundary without changing core or viewer ownership.

## Persistence

Application selection and manuscript preferences use separate keys:

- `kg.app.state.v1` stores the selected path.
- `kg.manuscript.preferences.v3` stores composition settings, zoom, and presets.
- per-document visible-page state uses best-effort session storage.

The frontend validates current payloads with Valibot and falls back to defaults
for malformed, incomplete, incompatible, or legacy values. Version 2
preferences are intentionally not migrated.

## Server boundary

The Go server is the only filesystem owner and watcher. It exposes file
discovery and content through HTTP and reports catalog, file, and process
changes through server-sent events. Release builds embed the frontend in the Go
binary; development uses the same HTTP boundary through the frontend proxy.

## Non-goals

The architecture does not provide print-accurate typesetting, source editing,
automatic correction, generic annotations, asynchronous processing, or
incremental recomposition. Those capabilities require concrete use cases before
their contracts are added.
