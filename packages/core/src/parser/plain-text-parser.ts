import { ManuscriptResult } from "../result/manuscript-result";
import { createManuscriptDraft } from "./internal/manuscript-draft";
import type { ManuscriptParser } from "./manuscript-parser";

/**
 * Treats the source verbatim: no notation, no annotations, display text equals source.
 */
export const plainTextParser: ManuscriptParser = {
  id: "kg/plain-text",

  parse: (source) => {
    const draft = createManuscriptDraft(source);
    draft.append(source, 0);
    return ManuscriptResult.succeed(draft.build());
  },
};
