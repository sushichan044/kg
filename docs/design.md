# sushichan044/kg

- k1low/mo というシンプルな markdown viewer がある
- これを参考に `.txt` で書いた小説 / SS を縦書きで仮組みしてプレビューするためのツールを作りたい

## Tips

- javascript の setup は `sushichan044/template-ts-lib-polyrepo` から必要なファイルだけ引っこ抜いてきて

## Product boundary

`kg` is a local browser previewer for checking the approximate density and appearance of prose.
It helps a writer change characters per line, lines per stage, and stage count while reading the result as pages.

`kg` is not a production typesetting engine.
Its pagination does not predict an InDesign document, and its output is not suitable as print-ready artwork.
Final composition, font selection, spacing, and export belong in InDesign or another DTP application.

The first preview mode is **manuscript grid**.
Later versions may add modes such as a paperback page preview, but those modes should remain rough visual checks rather than print specifications.

## Relationship to mo

The implementation agent should study `/Users/sushichan044/workspace/github.com/k1low/mo` and reuse its architectural shape with respect:

- a Go binary named `kg`;
- a Go HTTP server that owns filesystem access and watching;
- a React frontend embedded in the binary for release builds;
- a Vite proxy to the Go server during frontend development;
- server-sent events for live updates;
- stable file IDs derived from absolute paths; and
- graceful shutdown when the foreground process receives an interrupt.

The initial implementation does not need mo's groups, Markdown rendering, search, or uploads.
It does adopt a background (daemon) process model, server restart, and a minimal session backup of the watched paths, because these materially improve the writing workflow: start once and keep editing, forward new paths to the running instance, and reload the browser after a rebuild.
Beyond listing watched text files, reading one file, and notifying the browser when the file catalog or file content changes, the server also exposes status, shutdown, restart, and add-watched-path endpoints under the `/_/api/` namespace to support that process model.

Use mo's event semantics where practical:

- `update` tells the client to refresh the file list after a file is added, removed, or renamed;
- `file-changed` carries a file ID and tells the client to refetch that file when it is selected; and
- `started` identifies the server process so the browser can reload after a server replacement.

The server is the only filesystem watcher.
Vite must not watch paths outside the frontend root, because that behavior differs across platforms and Vite versions.

## Command line and discovery

`kg [PATH ...]` watches the given files and directories; a directory is scanned recursively for `.txt` files, and with no path the current directory is watched.

By default `kg` starts a detached background server, opens the browser, and returns the shell prompt; `--foreground` runs the server in the current process instead. When a server already listens on the port, a second `kg <path>` forwards the new paths to it rather than starting another server.

- `-p, --port` selects the port (default 6280); `--no-open` suppresses opening the browser.
- `--shutdown`, `--restart`, and `--status` control a running server. `--restart` re-execs the server so connected browsers reload via the `started` event.
- The server binds to localhost only. Background logs and the watched-path backup live under the XDG state directory (`%LOCALAPPDATA%` on Windows, `$XDG_STATE_HOME` or `~/.local/state` otherwise).

Discovery excludes what the writer keeps out of view: files matched by the enclosing repository's `.gitignore` and `.git/info/exclude`, the `.git` directory, and any dot-prefixed directory.

## Manuscript grid model

The default manuscript grid uses these settings:

| Setting             | Default | Allowed range |
| ------------------- | ------: | ------------: |
| Characters per line |      27 |         10–60 |
| Lines per stage     |      23 |         10–60 |
| Stages per page     |       2 |           1–3 |

A **line** is one vertical column of cells.
Characters fill a line from top to bottom.
Lines fill a stage from right to left.
Stages fill a page from top to bottom, and overflow continues on the next page.

The layout algorithm must follow these rules:

1. Normalize CRLF and CR line endings to LF.
2. Remove one terminal LF so a conventional terminal newline does not create an extra blank line.
3. Split each source line into Unicode grapheme clusters with `Intl.Segmenter` using the `ja` locale.
4. Place one grapheme cluster in one cell.
5. Wrap a source line after the configured character count.
6. Start every source line in a new manuscript line.
7. Preserve an empty source line as one empty manuscript line.
8. Fill each stage with the configured line count, then fill the next stage.
9. Return one blank page for an empty file.

Character statistics count grapheme clusters and exclude newline characters.
Source-line statistics count lines after line-ending normalization and terminal-LF removal.

These rules intentionally omit Japanese line-breaking corrections.
The preview does not move opening or closing punctuation between lines, combine digits, synthesize tate-chu-yoko, render ruby, hang punctuation, or apply optical spacing.

## DOM structure

Render the preview as a DOM grid rather than Canvas.
DOM cells keep the grid inspectable, make CSS vertical glyph substitution available, and allow browser tests to measure every cell.

Each occupied cell needs two elements with separate responsibilities:

```html
<span class="manuscript-cell">
  <span class="manuscript-glyph">あ</span>
</span>
```

The outer cell owns geometry and borders.
The inner glyph owns text orientation.
Empty cells retain the outer element and omit the glyph content.

Use physical dimensions on the cell:

```css
.manuscript-page {
  --cell-size: 1.55rem;
}

.manuscript-cell {
  box-sizing: border-box;
  width: var(--cell-size);
  height: var(--cell-size);
  border-top: 1px solid var(--grid-color);
}

.manuscript-glyph {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
```

The same `--cell-size` must control the horizontal and vertical dimensions.
Using independent line-width and cell-height values produces rectangular cells and misrepresents page density.

Do not put `writing-mode` on `.manuscript-cell`.
Writing mode changes the meaning of logical dimensions and logical borders, which can rotate or remove parts of the grid.
Use physical `width`, `height`, `border-top`, and `border-bottom` for cell geometry.

Draw the complete grid before placing text.
Every empty cell must remain visible, including unused cells at the end of a line, stage, page, or empty document.

## Vertical text behavior

The first grapheme appears in the top-right cell.
The next grapheme appears directly below it.
After a line fills, the next grapheme starts at the top of the adjacent line on the left.

Use a Japanese Mincho system-font stack for manuscript text:

```css
font-family: "Yu Mincho", "Hiragino Mincho ProN", "Hiragino Mincho Pro", serif;
```

`writing-mode: vertical-rl` allows the font and browser to select vertical Japanese punctuation glyphs.
`text-orientation: mixed` delegates each grapheme to Unicode's vertical-orientation property and enables vertical font substitutions.
Graphemes that begin with a Latin-script character or an ASCII digit use `text-orientation: upright` so they remain upright in their own cells.

One grapheme always consumes one cell, even when it contains a variation selector, combining mark, or emoji sequence.
Latin letters and ASCII digits stand upright in their own cells; sequences such as two digits or `!?` are not combined into tate-chu-yoko in the initial mode.

## Page geometry

A stage has this physical grid size:

```text
width  = lines per stage × cell size
height = characters per line × cell size
```

A page stacks the configured stages vertically.
Use a stage gap of two cell sizes and page padding of at least two cell sizes.
The paper grows from the selected grid instead of scaling cells to fit the viewport.

Center pages when space permits.
Allow horizontal and vertical scrolling when pages exceed the viewport.
Never shrink cells automatically, because a changing cell size makes comparisons between settings misleading.

Show pages as one continuous vertical stack with a restrained shadow and visible separation.
Use `content-visibility: auto` on offscreen pages when browser support permits it, while preserving the measured intrinsic page size.

## Visual language

The interface should resemble a quiet writing desk rather than a DTP application.
Use a warm gray work surface, cream paper, dark brown-black manuscript text, and a subdued tan grid.
The grid must remain visible at normal display brightness without competing with the text.

Suggested tokens:

| Role          | Color     |
| ------------- | --------- |
| Work surface  | `#d8d0c2` |
| Sidebar       | `#eee8dc` |
| Paper         | `#f7efd8` |
| Text          | `#2f2a24` |
| Grid          | `#d8c7a6` |
| Active accent | `#9b3f32` |

Use system fonts and avoid remote font downloads.
The sidebar UI may use a Japanese Gothic system stack, while the manuscript and numeric statistics use Mincho.

Keep decoration sparse.
A faint paper texture is acceptable when it does not reduce grid contrast or create false marks inside empty cells.

## Application layout

Use a fixed desktop sidebar and a separately scrolling preview area.
The sidebar contains, in order:

1. the `kg` product label and active preview-mode name;
2. the watched text-file list;
3. manuscript-grid controls;
4. preset controls;
5. character, source-line, and page statistics; and
6. a live status message.

The preview header shows the selected relative path and the current settings in the form `27字 × 23行 × 2段`.
The paper stack begins below that header.

Use the relative path as the stable file label when duplicate basenames exist.
The selected file is marked with `aria-current="page"` and a visible accent that does not rely on color alone.

On viewports narrower than 52rem, place the sidebar above the preview instead of reducing the manuscript cells.
The preview remains scrollable in both axes.

## State and controls

Apply a valid setting as soon as the numeric input changes.
Keep an invalid draft value in the field, show the allowed range, and retain the last valid layout until the value becomes valid.

Persist this state under a versioned localStorage key such as `kg.viewer.state.v1`:

- selected file path;
- current preview mode;
- current mode settings; and
- named custom presets.

The stored payload carries a top-level `version` field. On load, an incompatible version is discarded (falling back to defaults) or migrated, so fast-moving changes to the display requirements never load settings the current UI cannot honor.

The built-in `27字 × 23行 × 2段` preset cannot be overwritten or deleted.
Saving an existing custom-preset name requires confirmation.
Deleting a custom preset requires confirmation.

Store the last visible page per file in sessionStorage.
Restore the nearest valid page after content or settings change the page count.

An SSE update must not clear settings, presets, or scroll state.
When the selected file changes, refetch its content and repaginate it.
When the selected file is deleted, select the next file in sorted order, then the previous file if no next file exists.
Show the empty state when no watched text files remain.

## Accessibility

Associate every input and select with a visible label.
Expose validation errors with `aria-invalid` and `aria-describedby`.
Use an `aria-live` status region for saved presets, storage failures, and file-update notices.

The visual cell grid should not add thousands of empty elements to the accessibility tree.
Mark decorative grid elements as hidden from assistive technology and expose the page's source text through one screen-reader-only element in logical reading order.
Give each page an accessible label such as `1ページ目、全3ページ`.

Provide a skip link from the sidebar to the preview.
All interactive elements need visible keyboard focus, and the interface must remain understandable in forced-colors mode.

## Preview-mode extension boundary

Keep file loading, selection, SSE handling, persistence, and the application shell independent from the manuscript-grid renderer.
A preview mode owns only these concerns:

- its stable ID and display label;
- its validated settings and defaults;
- its pagination function;
- its page renderer; and
- its statistics derived from the source text.

Do not implement a generic plugin system in the first release.
A small discriminated union or explicit mode registry is sufficient when the second mode is introduced.
The first release contains only `manuscript-grid`.

## Non-goals

The initial `kg` release does not provide:

- print, PDF, image, or InDesign export;
- page sizes expressed in millimeters or points;
- user-installed fonts or font embedding;
- professional kinsoku shori;
- tate-chu-yoko, ruby, warichu, or emphasis marks;
- glyph-level kerning or optical alignment;
- print-accurate color management;
- document editing;
- Markdown parsing; or
- a promise that page breaks match another application.

The UI should describe its result as a preview or visual check, not as final typesetting.

## Acceptance checks

Automated layout tests must cover:

- exact wrapping, stage boundaries, and page boundaries;
- CRLF and CR normalization;
- one removed terminal newline;
- preserved internal blank lines;
- an empty document producing one blank page;
- variation selectors, combining marks, and emoji sequences occupying one cell each;
- punctuation at a line boundary without kinsoku correction; and
- invalid persisted settings falling back to defaults.

Browser tests must verify:

- the first character occupies the top-right cell;
- characters advance top-to-bottom and lines advance right-to-left;
- every measured cell has equal width and height within 0.5 CSS pixels;
- empty cells retain all four grid edges when combined with adjacent cells;
- Japanese brackets and punctuation use vertical glyph orientation;
- changing each setting immediately repaginates the selected file;
- settings and presets survive a browser reload;
- the visible page is restored for each file;
- adding, editing, renaming, and deleting a watched `.txt` file updates the browser;
- deleting the selected file chooses a valid fallback; and
- no browser-console errors occur in a fresh session.

Use a visual fixture containing Japanese brackets, commas, periods, long vowel marks, paired dashes, ellipses, `⁉︎`, Latin text, emoji, blank lines, and an overlong source line.
Capture the default view at 1440 × 1000 for regression review, but assert geometry and behavior in tests rather than relying only on screenshot comparison.

## Completion criterion

The first release is complete when a writer can run `kg` against text files, switch between them, edit the manuscript-grid settings, and see filesystem changes without restarting the browser.
The square grid and vertical reading order must remain stable across those interactions.
The interface must state that the result is an approximate visual preview and that final composition belongs in a DTP application.
