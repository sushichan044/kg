import * as v from "valibot";

const PresentationKindSchema = v.picklist(["mixed", "upright", "sideways", "tate-chu-yoko"]);

/**
 * Vertical orientation, independent of source membership and shaping clusters.
 */
export type PresentationKind = v.InferOutput<typeof PresentationKindSchema>;

export const PresentationKind = { schema: PresentationKindSchema } as const;
