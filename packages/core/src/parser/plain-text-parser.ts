import { ManuscriptResult } from "../result/manuscript-result";
import { createManuscriptDraft } from "./internal/manuscript-draft";
import type { ManuscriptParser } from "./manuscript-parser";

/**
 * ソースをそのまま扱う。記法も注釈もなく、表示用テキストはソースと等しい。
 */
export const plainTextParser: ManuscriptParser = {
  id: "kg/plain-text",

  parse: (source) => {
    const draft = createManuscriptDraft(source);
    draft.append(source, 0);
    return ManuscriptResult.succeed(draft.build());
  },
};
