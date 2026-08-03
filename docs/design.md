# Architecture

`kg` is a local browser previewer for Japanese plain-text manuscripts.
The repository separates reusable manuscript behavior from the application that
loads files and presents the browser shell.

This document records stable architectural boundaries.
User-facing behavior, supported settings, proofreading rules, and verification
details belong to package documentation and tests so this document does not
need to mirror routine code changes.

## Dependency direction

Dependencies point inward from the application toward reusable packages:

```text
Go server
    │ HTTP + SSE
    ▼
internal/frontend ──▶ packages/viewer ──▶ packages/core
        │                                      ▲
        └──────────────────────────────────────┘
```

- `packages/core` has no React, DOM, filesystem, or browser-storage dependency.
- `packages/viewer` depends on core and React, but not on the `kg` application.
- `internal/frontend` consumes only public package APIs.
- The Go server does not own manuscript layout or proofreading behavior.

The dependency direction must not be reversed to accommodate application-only
features.

## Core

`@sushichan044/kg-core` owns the manuscript domain.
Its primary abstraction is an immutable `ManuscriptState` containing source
text, preferences, selection, and all derived results such as pagination,
geometry, and diagnostics.

State changes are expressed as typed actions.
Applying one or more actions produces a transaction that is either accepted in
full or rejected without changing the previous snapshot.
`ManuscriptController` serializes accepted transactions and notifies subscribers
once per dispatched batch.

This model keeps derived data coherent: consumers never provide pagination or
diagnostics independently from the text and configuration that produced them.
Low-level pure functions remain public for consumers that do not need the state
model.

Unknown data is parsed at public and persistence boundaries with Valibot.
Successful parsing returns typed values; failed parsing does not produce a
partially trusted object.
Internal code trusts values that have already crossed those boundaries.

## Viewer

`@sushichan044/kg-viewer` adapts the core controller to React.
`ManuscriptProvider` subscribes to one controller and supplies connected
viewport, toolbar, diagnostic, zoom, and settings components.

The viewer owns interaction that is meaningful for any manuscript consumer,
including configuration drafts, diagnostic selection, presets, and effective
zoom.
The consuming application does not recalculate or inject derived manuscript
state.

DOM-only behavior is exposed through the `ManuscriptViewer` ref handle.
This includes navigation such as scrolling to a page or diagnostic.
DOM state does not enter the core snapshot.

Viewer CSS is explicitly imported and scoped with the `kgv-` namespace.
The package does not reset or style the surrounding application.
React remains a peer dependency.

## Frontend application

`internal/frontend` is a thin adapter around core and viewer.
It owns only application concerns:

- fetching the file catalog and selected document;
- reacting to server-sent file events;
- selecting a document;
- composing desktop and mobile application shells;
- opening application drawers and dialogs; and
- persisting application and manuscript state.

Fetched text enters the manuscript model through a `document.replace` action.
The frontend reads derived state through viewer hooks and invokes DOM navigation
through the view handle.
It does not call pagination, geometry, or proofreading functions directly.

## Persistence

Application state and manuscript preferences have separate ownership and
storage keys:

- `kg.app.state.v1` stores application selection.
- `kg.manuscript.preferences.v2` stores core-owned manuscript preferences.
- per-document visible-page state is best-effort session storage.

Each durable payload has its own versioned schema.
Only the current complete shape is parsed.
Malformed, incomplete, incompatible, and legacy payloads fall back to defaults;
the application does not retain migration code for old pre-release versions.

The core package owns encoding and decoding manuscript preferences.
The frontend owns encoding and decoding application selection.

## Server boundary

The Go server is the only filesystem owner and watcher.
It exposes file discovery and content through HTTP, and reports catalog, file,
and process changes through server-sent events.
The browser never reads watched paths directly.

Release builds embed the frontend in the Go binary.
Development uses the same HTTP boundary through the frontend development
server's proxy.

## Extension boundary

New manuscript behavior belongs in core when it is framework-independent, and
in viewer when it is reusable React or DOM interaction.
Application-specific file or shell behavior stays in `internal/frontend`.

A second preview mode may introduce an explicit mode registry or discriminated
union.
Do not introduce a generic plugin system before more than one concrete mode
establishes the required abstraction.

## Architectural non-goals

The architecture does not make `kg` a production typesetting engine, browser
editor, or automatic correction system.
Print-accurate composition, source mutation, and editor ownership remain outside
the package boundaries described here.
