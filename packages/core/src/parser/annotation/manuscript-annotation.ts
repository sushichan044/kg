import * as v from "valibot";

import { BoldAnnotation } from "./bold-annotation";
import { EmphasisAnnotation } from "./emphasis-annotation";
import { ItalicAnnotation } from "./italic-annotation";
import { RubyAnnotation } from "./ruby-annotation";

const ManuscriptAnnotationSchema = v.variant("kind", [
  RubyAnnotation.schema,
  BoldAnnotation.schema,
  ItalicAnnotation.schema,
  EmphasisAnnotation.schema,
]);

/**
 * 閉じた集合。パーサーは、サービス固有の記法をちょうどこの 4 つのバリアントへ正規化する。
 */
export type ManuscriptAnnotation = v.InferOutput<typeof ManuscriptAnnotationSchema>;

export const ManuscriptAnnotation = {
  schema: ManuscriptAnnotationSchema,

  /**
   * 描画用の安定した順序。外側の範囲を先に、次にバリアント名の順に並べる。
   */
  compare: (left: ManuscriptAnnotation, right: ManuscriptAnnotation): number =>
    left.range.source.start - right.range.source.start ||
    left.range.source.end - right.range.source.end ||
    left.kind.localeCompare(right.kind),
} as const;
