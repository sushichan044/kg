import type { ManuscriptResult } from "../result/manuscript-result";
import type { Rejection } from "../result/rejection";
import type { ParsedManuscript } from "./parsed-manuscript";

/**
 * The contract every parser implements. `id` is plain text here because it arrives from outside;
 * core validates it into a {@link NamespacedId} before using it.
 */
export type ManuscriptParser = Readonly<{
  id: string;
  parse: (source: string) => ManuscriptResult<ParsedManuscript, Rejection>;
}>;
