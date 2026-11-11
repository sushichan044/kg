# @sushichan044/kg-viewer

React components for displaying vertical manuscripts composed with
[`@sushichan044/kg-core`](https://github.com/sushichan044/kg/blob/main/packages/core/README.md).

```sh
pnpm add @sushichan044/kg-core @sushichan044/kg-viewer react react-dom
```

## Display a manuscript

Pass a composed manuscript and optional diagnostics to the controlled viewer:

```tsx
import type { NovelComposedManuscript } from "@sushichan044/kg-core";
import { NovelViewer } from "@sushichan044/kg-viewer";

import "@sushichan044/kg-viewer/styles.css";

function Preview({ composed }: { composed: NovelComposedManuscript }) {
  return <NovelViewer composed={composed} />;
}
```

`NovelViewer` loads its font automatically when no `typography` is supplied.
For page counts or image export that must use the same font measurements, use
`TypographyProvider` and `useTypography` in React.

Use `NovelViewerProps` or `DiagnosticListProps` when wrapping the components.
Import `styles.css` for layout and the default theme.

## License

MIT
