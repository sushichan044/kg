import type { ManuscriptResult } from "../result/manuscript-result";
import type { Rejection } from "../result/rejection";
import type { ParsedManuscript } from "./parsed-manuscript";

/**
 * すべてのパーサーが実装する契約。`id` は外部から渡されるのでここでは単なる文字列であり、
 * core が使う前に {@link NamespacedId} へ検証して変換する。
 */
export type ManuscriptParser = Readonly<{
  id: string;
  parse: (source: string) => ManuscriptResult<ParsedManuscript, Rejection>;
}>;
