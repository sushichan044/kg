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
export { logicalRunMeasurer } from "./composer/run-measurer";
export type { RunMeasurer } from "./composer/run-measurer";
export { MeasurementRequest } from "./composer/measurement-request";
export { MeasurementTextRange } from "./composer/measurement-text-range";
export { MeasuredCluster } from "./composer/measured-cluster";
export { RunMeasurement } from "./composer/run-measurement";
export type { PresentationKind } from "./composer/presentation-kind";
