# @sushichan044/kg-core

Parse, compose, and proofread Japanese manuscripts without a browser or React.

```sh
pnpm add @sushichan044/kg-core
```

## Parse, compose, and proofread

```ts
import {
  ComposeError,
  composeManuscript,
  NovelCompositionSettings,
  novelComposer,
  ParseError,
  parseManuscript,
  kakuyomuParser,
} from "@sushichan044/kg-core";
import {
  createDefaultProofreadingRules,
  ProofreadError,
  proofreadManuscript,
} from "@sushichan044/kg-core/lint";

const source = "吾輩は猫である。";
const parsed = parseManuscript(source, { parser: kakuyomuParser });
if (!parsed.ok) throw new Error(ParseError.describe(parsed.error));

const composed = composeManuscript(parsed.value, {
  composer: novelComposer,
  settings: NovelCompositionSettings.defaults,
});
if (!composed.ok) throw new Error(ComposeError.describe(composed.error));

const proofread = proofreadManuscript(composed.value, {
  rules: createDefaultProofreadingRules(),
});
if (!proofread.ok) throw new Error(ProofreadError.describe(proofread.error));

const diagnostics = [...parsed.warnings, ...proofread.value];
```

`parseManuscript` defaults to plain text; choose `pixivParser` or
`kakuyomuParser` for platform notation. The resulting layout uses logical font
metrics. For browser font measurements and React previews, use
[`@sushichan044/kg-viewer`](https://github.com/sushichan044/kg/blob/main/packages/viewer/README.md).

## Entry points

- `@sushichan044/kg-core`: parsers, composition, settings, and results.
- `@sushichan044/kg-core/lint`: proofreading with built-in rules.
- `@sushichan044/kg-core/plugin`: composition and measurement used by the viewer.

## Other uses

- Read `ParsedManuscript` and its annotations to process text without composing it.
- Use `@sushichan044/kg-core/lint` to run the default proofreading rules.
- Inspect `NovelPage` and `NovelLine` in the composed layout to implement a custom renderer.

## License

MIT
