import * as v from "valibot";

import { readonlyObject } from "../internal/schema";

const RejectionSchema = readonlyObject({ reason: v.string() });

/**
 * How a plugin reports that it declined to produce a result. Core turns it into a typed variant of
 * the stage's own error union, so plugins never have to construct core's error types.
 */
export type Rejection = v.InferOutput<typeof RejectionSchema>;

export const Rejection = { schema: RejectionSchema } as const;
