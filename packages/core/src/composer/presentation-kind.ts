import * as v from "valibot";

const PresentationKindSchema = v.picklist(["mixed", "upright", "sideways", "tate-chu-yoko"]);

/**
 * 縦組での文字の向き。ソース上の所属やシェーピングのクラスタとは独立している。
 */
export type PresentationKind = v.InferOutput<typeof PresentationKindSchema>;

export const PresentationKind = { schema: PresentationKindSchema } as const;
