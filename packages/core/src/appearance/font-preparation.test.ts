import { describe, expect, test } from "vite-plus/test";

import { composeManuscript } from "../composer/compose-manuscript";
import { NovelCompositionSettings } from "../composer/composition-settings";
import { novelComposer } from "../composer/novel-composer";
import { kakuyomuParser } from "../parser/kakuyomu-parser";
import { parseManuscript } from "../parser/parse-manuscript";
import { pixivParser } from "../parser/pixiv-parser";
import { ManuscriptRange } from "../range/manuscript-range";
import { prepareTextForFont, prepareManuscriptForFont } from "./font-preparation";

describe("font preparation", () => {
  test("keeps combined kana together at a page boundary and preserves small-kana kinsoku", () => {
    const parsed = parseManuscript("あ゛".repeat(9) + "ん゛ぁ゛ア゜ㇷ゜");
    expect.assert(parsed.ok);
    const prepared = prepareManuscriptForFont(parsed.value, "mincho");
    const settings = NovelCompositionSettings.forPaper("a4", {
      ...NovelCompositionSettings.defaults,
      flow: { lineLengthEm: 10, linesPerStage: 10, stagesPerPage: 1 },
      offsets: { ...NovelCompositionSettings.defaults.offsets, page: { leading: 9, trailing: 0 } },
    });

    const composed = composeManuscript(prepared.parsed, { composer: novelComposer, settings });

    expect.assert(composed.ok);
    const lines = composed.value.layout.pages.flatMap(({ stages }) =>
      stages.flatMap(({ lines }) => lines.filter(({ range }) => range !== null)),
    );
    expect(composed.value.layout.pages).toHaveLength(2);
    expect(lines).toHaveLength(2);
    const values = lines.map(({ items }) =>
      items.flatMap((item) => (item.kind === "glyph" ? [item.value] : [])),
    );
    expect(values).toEqual([Array.from({ length: 9 }, () => "あ゙"), ["ん゙", "ぁ゙", "ア゚", "ㇷ゚"]]);
    expect(composed.value.layout.stats.chars).toBe(13);
  });

  test("preserves mono-ruby base associations instead of merging across them", () => {
    const parsed = parseManuscript("あ゛");
    expect.assert(parsed.ok);
    const range = ManuscriptRange.merge(parsed.value.graphemes.map(({ range }) => range));
    expect.assert(range !== null);
    const manuscript = {
      ...parsed.value,
      annotations: [{ kind: "ruby", range, reading: { kind: "mono", segments: ["あ゛", "てん"] } }],
    } as const;

    const prepared = prepareManuscriptForFont(manuscript, "mincho");

    expect(prepared.parsed.displayText).toBe("あ゛");
    expect(prepared.parsed.graphemes).toHaveLength(2);
    expect(prepared.parsed.annotations[0]).toMatchObject({ reading: { segments: ["あ゙", "てん"] } });
  });
  test("combines spacing voicing marks only for fonts that request it", () => {
    const text = "あ゛ん゛ぁ゛ア゜ㇷ゜ がぱ あ゙ ゛゜ ｱﾞ 😀\nあ゛゛";

    expect(prepareTextForFont(text, "mincho")).toBe("あ゙ん゙ぁ゙ア゚ㇷ゚ がぱ あ゙ ゛゜ ｱﾞ 😀\nあ゙゛");
    expect(prepareTextForFont(text, "genei-koburi")).toBe(text);
    expect(prepareTextForFont(text, "gothic")).toBe(text);
  });

  test("preserves the source and maps either original member to the combined grapheme", () => {
    const parsed = parseManuscript("😀あ゛次");
    expect.assert(parsed.ok);

    const prepared = prepareManuscriptForFont(parsed.value, "mincho");

    expect(prepared.parsed.source).toBe("😀あ゛次");
    expect(prepared.parsed.displayText).toBe("😀あ゙次");
    expect(prepared.parsed.graphemes.map(({ value }) => value)).toEqual(["😀", "あ゙", "次"]);
    const originalMark = parsed.value.graphemes[2];
    expect.assert(originalMark !== undefined);
    expect(prepared.mapRange(originalMark.range)).toMatchObject({
      source: { start: 3, end: 4 },
      display: { start: 3, end: 4 },
      graphemes: { start: 1, end: 2 },
    });
    expect(parsed.value.displayText).toBe("😀あ゛次");
    expect(prepareManuscriptForFont(prepared.parsed, "mincho").parsed).toEqual(prepared.parsed);
  });

  test.each([pixivParser, kakuyomuParser])(
    "prepares body and ruby while preserving annotations with $id",
    (parser) => {
      const text = parser === pixivParser ? "[[rb:あ゛>あ゛]]" : "｜あ゛《あ゛》";
      const parsed = parseManuscript(text, { parser });
      expect.assert(parsed.ok);

      const prepared = prepareManuscriptForFont(parsed.value, "mincho");

      expect(prepared.parsed.graphemes).toHaveLength(1);
      expect(prepared.parsed.annotations[0]).toMatchObject({
        reading: { kind: "group", text: "あ゙" },
        range: { graphemes: { start: 0, end: 1 } },
      });
      expect(prepared.parsed.source).toBe(text);
    },
  );

  test("keeps spacing marks separate across notation and style boundaries", () => {
    const parsed = parseManuscript("[b:あ]゛あ[b:゛]", { parser: pixivParser });
    expect.assert(parsed.ok);

    const prepared = prepareManuscriptForFont(parsed.value, "mincho");

    expect(prepared.parsed.displayText).toBe("あ゛あ゛");
    expect(prepared.parsed.graphemes).toHaveLength(4);
    expect(prepared.parsed.annotations.map(({ range }) => range.graphemes)).toEqual([
      { start: 0, end: 1 },
      { start: 3, end: 4 },
    ]);
  });
});
