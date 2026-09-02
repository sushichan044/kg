// What an author needs to supply an implementation to core: a parser, a composer, or a measurer
// for the built-in novel composer. Proofreading rules are authored against
// `@sushichan044/kg-core/lint`, which already carries their contract.

export { NamespacedId } from "./namespaced-id";
export { ManuscriptResult } from "./result/manuscript-result";
export { ValidationIssue } from "./result/validation-issue";
export type { Rejection } from "./result/rejection";

export { ParsedManuscript } from "./parser/parsed-manuscript";
export type { ManuscriptParser } from "./parser/manuscript-parser";

export type { ManuscriptComposer } from "./composer/manuscript-composer";

export { createNovelComposer } from "./composer/novel-composer";
export { logicalInlineMeasurer } from "./composer/inline-measurer";
export type {
  InlineMeasureRequest,
  InlineMeasurement,
  InlineMeasurer,
} from "./composer/inline-measurer";
