// core に実装を渡す作者向けの公開面。パーサー、コンポーザー、
// 組み込みの小説用コンポーザーが使う測定器を扱う。
// 校正ルールは `@sushichan044/kg-core/lint` に対して書く。その契約はあちらにすでに含まれている。

export { NamespacedId } from "./namespaced-id";

export type { ManuscriptParser } from "./parser/manuscript-parser";

export type { ManuscriptComposer } from "./composer/manuscript-composer";

export { createNovelComposer } from "./composer/novel-composer";
export { logicalRunMeasurer } from "./composer/run-measurer";
export type { RunMeasurer } from "./composer/run-measurer";
export { MeasurementRequest } from "./composer/measurement-request";
export { MeasurementTextRange } from "./composer/measurement-text-range";
export { RunMeasurement } from "./composer/run-measurement";
