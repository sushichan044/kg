import * as v from "valibot";

import { NamespacedId } from "../namespaced-id";
import { ManuscriptResult } from "../result/manuscript-result";
import { Rejection } from "../result/rejection";
import { ValidationIssue } from "../result/validation-issue";
import type { ManuscriptParser } from "./manuscript-parser";
import type { ParseError } from "./parse-error";
import { ParsedManuscript } from "./parsed-manuscript";
import { plainTextParser } from "./plain-text-parser";

export type ParseManuscriptOptions = Readonly<{ parser?: ManuscriptParser }>;

type ParseOutcome = ManuscriptResult<ParsedManuscript, ParseError>;

export function parseManuscript(
  source: string,
  options: ParseManuscriptOptions = {},
): ParseOutcome {
  const parser = options.parser ?? plainTextParser;
  const parserId = NamespacedId.parse(parser.id);
  if (parserId === undefined) {
    return ManuscriptResult.fail({ kind: "InvalidParserId", parserId: parser.id });
  }

  // A third-party parser may throw; that must surface as a typed error, not escape the stage.
  let raw: unknown;
  try {
    raw = parser.parse(source);
  } catch (cause) {
    return ManuscriptResult.fail({ kind: "ParserThrew", parserId, cause });
  }

  const envelope = v.safeParse(
    ManuscriptResult.schema(ParsedManuscript.contractFor(source), Rejection.schema),
    raw,
  );
  if (!envelope.success) {
    return ManuscriptResult.fail({
      kind: "InvalidParserOutput",
      parserId,
      issues: ValidationIssue.from(envelope.issues),
    });
  }

  const result = envelope.output;
  return result.ok
    ? result
    : ManuscriptResult.fail({ kind: "ParserRejected", parserId, reason: result.error.reason });
}
