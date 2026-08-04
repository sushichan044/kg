import { NamespacedId } from "../namespaced-id";
import { ManuscriptResult } from "../result/manuscript-result";
import { createManuscriptDraft } from "./internal/manuscript-draft";
import { unrecognizedNotationWarnings } from "./internal/notation-warning";
import type { UnrecognizedSpan } from "./internal/notation-warning";
import { literalEnd, parsePixivTag } from "./internal/pixiv-notation";
import type { ManuscriptParser } from "./manuscript-parser";

const PARSER_ID = NamespacedId.of("kg/pixiv");

/**
 * Understands Pixiv's ruby, bold, italic and emphasis-mark notation. Anything bracket-shaped that
 * does not parse is kept as literal text and reported as a warning rather than dropped.
 */
export const pixivParser: ManuscriptParser = {
  id: PARSER_ID,

  parse: (source) => {
    const draft = createManuscriptDraft(source);
    const unrecognized: UnrecognizedSpan[] = [];
    let index = 0;

    while (index < source.length) {
      if (source[index] !== "[") {
        const nextTag = source.indexOf("[", index);
        const end = nextTag === -1 ? source.length : nextTag;
        draft.append(source.slice(index, end), index);
        index = end;
        continue;
      }

      const tag = parsePixivTag(source, index);
      if (tag !== undefined) {
        const range = draft.append(tag.content.text, tag.content.sourceStart);
        draft.annotate({
          ...tag.annotation,
          range: { ...range, source: { start: index, end: tag.end } },
        });
        index = tag.end;
        continue;
      }

      const end = literalEnd(source, index);
      draft.append(source.slice(index, end), index);
      unrecognized.push({ start: index, end });
      index = end;
    }

    const manuscript = draft.build();

    return ManuscriptResult.succeed(
      manuscript,
      unrecognizedNotationWarnings(source, PARSER_ID, manuscript, unrecognized),
    );
  },
};
