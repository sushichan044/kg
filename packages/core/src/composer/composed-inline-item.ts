import * as v from "valibot";

import { readonlyObject } from "../internal/schema";
import { ManuscriptRange } from "../range/manuscript-range";

const signedEm = () => v.pipe(v.number(), v.finite());

const GeneratedGlueItemSchema = readonlyObject({
  kind: v.literal("glue"),
  origin: v.literal("generated"),
  offsetEm: signedEm(),
  widthEm: signedEm(),
  naturalWidthEm: signedEm(),
  adjustment: v.union([v.literal("natural"), v.literal("shrunk"), v.literal("stretched")]),
});

const SourceGlueItemSchema = readonlyObject({
  kind: v.literal("glue"),
  origin: v.literal("source"),
  value: v.string(),
  range: ManuscriptRange.schema,
  offsetEm: signedEm(),
  widthEm: signedEm(),
  naturalWidthEm: signedEm(),
  adjustment: v.union([v.literal("natural"), v.literal("shrunk"), v.literal("stretched")]),
});

const KernItemSchema = readonlyObject({
  kind: v.literal("kern"),
  offsetEm: signedEm(),
  widthEm: signedEm(),
});

const SuppressedItemSchema = readonlyObject({
  kind: v.literal("suppressed"),
  value: v.string(),
  range: ManuscriptRange.schema,
  reason: v.literal("question-or-exclamation-gap"),
});

/**
 * 行の調整処理で幅を変えてよい字間のアキ。`naturalWidthEm` は文字の組合せが求める幅、
 * `widthEm` は選んだ分割位置で決まった幅で、`adjustment` はそのどちらになったかを示す。
 * `origin: "source"` は、文字クラスの組合せから導いたアキではなく、
 * 原稿に書かれていたアキであることを示す。
 */
export type ComposedGlue = v.InferOutput<
  typeof GeneratedGlueItemSchema | typeof SourceGlueItemSchema
>;

/**
 * 行の調整処理が一切変えない固定のアキ（詰め）。
 * 括弧の連続のような二分の文字同士の間では負の値になる。
 * そうしないと、送り幅によって全角1字分の空白が残ってしまう。分離禁止の文字同士の間では0で、
 * 隙間なく密着させる。
 */
export type ComposedKern = v.InferOutput<typeof KernItemSchema>;

/**
 * ソースにはあるが、この行には組まない文字。現在の理由は一つだけで、
 * JLReq 3.1.6 を満たすために原稿が `！` や `？` の後ろに書く和字間隔だ。
 * このアキは記号と後続の文字を離すためのものなので、行の分割ですでに離れている場合は取り除く。
 * 文字は削除せずに報告するので、行は引き続きソース上の範囲全体に対応づく。
 */
export type SuppressedInlineItem = v.InferOutput<typeof SuppressedItemSchema>;

export const ComposedGlue = {
  schema: v.union([GeneratedGlueItemSchema, SourceGlueItemSchema]),
} as const;
export const ComposedKern = { schema: KernItemSchema } as const;
export const SuppressedInlineItem = { schema: SuppressedItemSchema } as const;
