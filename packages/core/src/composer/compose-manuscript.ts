import * as v from "valibot";

import { NamespacedId } from "../namespaced-id";
import { ParsedManuscript } from "../parser/parsed-manuscript";
import { ManuscriptResult } from "../result/manuscript-result";
import { Rejection } from "../result/rejection";
import { ValidationIssue } from "../result/validation-issue";
import type { ComposeError } from "./compose-error";
import type { ComposedManuscript } from "./composed-manuscript";
import type { ManuscriptComposer } from "./manuscript-composer";

export type ComposeManuscriptOptions<TSettings, TLayout> = Readonly<{
  composer: ManuscriptComposer<TSettings, TLayout>;
  settings: TSettings;
}>;

export function composeManuscript<TSettings, TLayout>(
  parsed: ParsedManuscript,
  options: ComposeManuscriptOptions<TSettings, TLayout>,
): ManuscriptResult<ComposedManuscript<TSettings, TLayout>, ComposeError> {
  const { composer } = options;

  const manuscript = v.safeParse(ParsedManuscript.schema, parsed);
  if (!manuscript.success) {
    return ManuscriptResult.fail({
      kind: "InvalidManuscript",
      issues: ValidationIssue.from(manuscript.issues),
    });
  }

  const composerId = NamespacedId.parse(composer.id);
  if (composerId === undefined) {
    return ManuscriptResult.fail({ kind: "InvalidComposerId", composerId: composer.id });
  }

  const settings = v.safeParse(composer.settingsSchema, options.settings);
  if (!settings.success) {
    return ManuscriptResult.fail({
      kind: "InvalidSettings",
      composerId,
      issues: ValidationIssue.from(settings.issues),
    });
  }

  // A third-party composer may throw; that must surface as a typed error, not escape the stage.
  let raw: unknown;
  try {
    raw = composer.compose(manuscript.output, settings.output);
  } catch (cause) {
    return ManuscriptResult.fail({ kind: "ComposerThrew", composerId, cause });
  }

  const envelope = v.safeParse(
    ManuscriptResult.schema(composer.layoutSchema, Rejection.schema),
    raw,
  );
  if (!envelope.success) {
    return ManuscriptResult.fail({
      kind: "InvalidComposerOutput",
      composerId,
      issues: ValidationIssue.from(envelope.issues),
    });
  }

  const result = envelope.output;
  if (!result.ok) {
    return ManuscriptResult.fail({
      kind: "ComposerRejected",
      composerId,
      reason: result.error.reason,
    });
  }

  return ManuscriptResult.succeed(
    {
      composerId,
      parsed: manuscript.output,
      settings: settings.output,
      layout: result.value,
    },
    result.warnings,
  );
}
