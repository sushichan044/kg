import * as v from "valibot";

const NamespacedIdSchema = v.pipe(
  v.string(),
  v.nonEmpty(),
  v.regex(/^[^/]+\/[^/]+$/u, "ID must use namespace/name"),
  v.brand("NamespacedId"),
);

/**
 * プラグイン（パーサー、コンポーザー、校正ルール）を `namespace/name` の形式で識別する。
 * ブランド型にしてあるため、境界ですでに受理した ID の代わりに任意の文字列を渡すことはできない。
 */
export type NamespacedId = v.InferOutput<typeof NamespacedIdSchema>;

export const NamespacedId = {
  schema: NamespacedIdSchema,

  /**
   * コード中にリテラルとして書く ID 用。形式が不正なリテラルは、インポート時に例外を投げる。
   */
  of: (literal: string): NamespacedId => v.parse(NamespacedIdSchema, literal),

  /**
   * プラグインが渡す ID 用。不正な値はバグではなく入力の誤りとして扱う。
   */
  parse: (raw: string): NamespacedId | undefined => {
    const result = v.safeParse(NamespacedIdSchema, raw);
    return result.success ? result.output : undefined;
  },
} as const;
