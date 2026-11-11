import * as v from "valibot";

import { ManuscriptDiagnostic } from "../diagnostic/manuscript-diagnostic";
import { readonlyArray, readonlyObject } from "../internal/schema";

/**
 * パイプラインの 1 ステージの結果。成功時は、ステージが回復した警告を持つ。
 * 失敗時はエラーをちょうど 1 つ持つので、呼び出し側は `kind` で網羅的に `switch` できる。
 *
 * `kind` の判別子ではなく `ok` を使う。これは Result 型であり、
 * エコシステムのどの Result ライブラリも成功フラグをこの綴りにしているためである。
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
   * プラグインの境界を越えた結果を、それが持つ診断も含めて検証する。
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
