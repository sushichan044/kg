import * as v from "valibot";

import { ManuscriptDiagnostic } from "../diagnostic/manuscript-diagnostic";
import { readonlyArray, readonlyObject } from "../internal/schema";

/**
 * The outcome of one pipeline stage. Success carries warnings the stage recovered from; failure
 * carries exactly one error so callers can `switch` on its `kind` exhaustively.
 *
 * `ok` rather than a `kind` discriminant: this is a Result, and every Result library in the
 * ecosystem spells the success flag this way.
 */
export type ManuscriptResult<TValue, TError> =
  | Readonly<{ ok: true; value: TValue; warnings: readonly ManuscriptDiagnostic[] }>
  | Readonly<{ ok: false; error: TError }>;

export const ManuscriptResult = {
  succeed: <TValue>(
    value: TValue,
    warnings: readonly ManuscriptDiagnostic[] = [],
  ): ManuscriptResult<TValue, never> => ({ ok: true, value, warnings }),

  fail: <TError>(error: TError): ManuscriptResult<never, TError> => ({ ok: false, error }),

  /**
   * Validates a result that crossed a plugin boundary, including the diagnostics it carries.
   */
  schema: <TValue, TError>(
    value: v.GenericSchema<unknown, TValue>,
    error: v.GenericSchema<unknown, TError>,
  ): v.GenericSchema<unknown, ManuscriptResult<TValue, TError>> =>
    v.variant("ok", [
      readonlyObject({
        ok: v.literal(true),
        value,
        warnings: readonlyArray(ManuscriptDiagnostic.schema),
      }),
      readonlyObject({ ok: v.literal(false), error }),
    ]),
} as const;
