import type * as v from "valibot";

import type { ParsedManuscript } from "../parser/parsed-manuscript";
import type { ManuscriptResult } from "../result/manuscript-result";
import type { Rejection } from "../result/rejection";

/**
 * The contract every composer implements. The two schemas let core check a plugin's settings and
 * layout at runtime; core never inspects either shape itself.
 *
 * A composer returns only a layout: the settings it ran under are the ones core already validated,
 * so there is no way for the two to disagree.
 */
export type ManuscriptComposer<TSettings, TLayout> = Readonly<{
  id: string;
  settingsSchema: v.GenericSchema<unknown, TSettings>;
  layoutSchema: v.GenericSchema<unknown, TLayout>;
  compose: (
    manuscript: ParsedManuscript,
    settings: TSettings,
  ) => ManuscriptResult<TLayout, Rejection>;
}>;
