import * as v from "valibot";

const NamespacedIdSchema = v.pipe(
  v.string(),
  v.nonEmpty(),
  v.regex(/^[^/]+\/[^/]+$/u, "ID must use namespace/name"),
  v.brand("NamespacedId"),
);

/**
 * Identifies a plugin (parser, composer, proofreading rule) as `namespace/name`. Branded so an
 * arbitrary string cannot stand in for an ID that the boundary has already accepted.
 */
export type NamespacedId = v.InferOutput<typeof NamespacedIdSchema>;

export const NamespacedId = {
  schema: NamespacedIdSchema,

  /**
   * For IDs written as literals in code. Throws on a malformed literal, at import time.
   */
  of: (literal: string): NamespacedId => v.parse(NamespacedIdSchema, literal),

  /**
   * For IDs supplied by a plugin, where a malformed value is bad input rather than a bug.
   */
  parse: (raw: string): NamespacedId | undefined => {
    const result = v.safeParse(NamespacedIdSchema, raw);
    return result.success ? result.output : undefined;
  },
} as const;
