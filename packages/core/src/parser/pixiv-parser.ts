import { NamespacedId } from "../namespaced-id";
import { ManuscriptResult } from "../result/manuscript-result";
import { createManuscriptDraft } from "./internal/manuscript-draft";
import { unrecognizedNotationWarnings } from "./internal/notation-warning";
import type { UnrecognizedSpan } from "./internal/notation-warning";
import { literalEnd, parsePixivTag } from "./internal/pixiv-notation";
import type { ManuscriptParser } from "./manuscript-parser";

const PARSER_ID = NamespacedId.of("kg/pixiv");

/**
 * Pixiv のルビ、太字、斜体、圏点の記法を解釈する。括弧の形をしていても解釈できないものは、
 * 削除せずそのままの文字として残し、警告として報告する。
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
