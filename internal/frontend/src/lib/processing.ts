import type {
  ManuscriptDiagnostic,
  ManuscriptResult,
  NovelCompositionSettings,
} from "@sushichan044/kg-core";
import type { ProofreadError } from "@sushichan044/kg-core/lint";
import type { ReadyTypography } from "@sushichan044/kg-viewer";

import { composeSource } from "../manuscript";
import type { ComposedSource, ComposeSourceError } from "../manuscript";
import type { ManuscriptNotation } from "./storage";
import { getProofreadingClient } from "./workers";

export type ProofreadingResult =
  | Readonly<{ kind: "done"; diagnostics: readonly ManuscriptDiagnostic[] }>
  | Readonly<{ kind: "rule-failed"; error: ProofreadError }>
  | Readonly<{ kind: "crashed"; message: string }>;

export type ProcessedManuscript = Readonly<{
  /**
   * 組版までの結果。同期で得られる。
   */
  composedSource: ManuscriptResult<ComposedSource, ComposeSourceError>;
  /**
   * Worker での校正。組版に失敗したときは `null`。
   * 失敗しても reject せず `ProofreadingResult` で表すので、`use` で読んでも Error Boundary は要らない。
   */
  proofreading: Promise<ProofreadingResult> | null;
}>;

export type ProcessingInput = Readonly<{
  source: string;
  composition: NovelCompositionSettings;
  notation: ManuscriptNotation;
  typography: ReadyTypography;
}>;

type Entry = Readonly<{ input: ProcessingInput; processed: ProcessedManuscript }>;

// Suspense で読む Promise はレンダーをまたいで同じものでなければならない。
// 中断したレンダーは状態を捨てるので、入力から引けるキャッシュをモジュールに持つ。
// 遅延値の古い描画と新しい描画が交互に走っても作り直さないよう、少数を残す。
const CACHE_SIZE = 4;
const cache: Entry[] = [];

function sameInput(left: ProcessingInput, right: ProcessingInput): boolean {
  return (
    left.source === right.source &&
    left.composition === right.composition &&
    left.notation === right.notation &&
    left.typography === right.typography
  );
}

function proofread(composedSource: ManuscriptResult<ComposedSource, ComposeSourceError>) {
  if (!composedSource.ok) return null;
  return getProofreadingClient()
    .proofread(composedSource.value.composed)
    .then(
      (outcome): ProofreadingResult =>
        outcome.ok
          ? { kind: "done", diagnostics: [...outcome.warnings, ...outcome.value] }
          : { kind: "rule-failed", error: outcome.error },
      (error: unknown): ProofreadingResult => ({
        kind: "crashed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
}

/**
 * 解析と組版を同期で行い、校正を Worker に任せる。同じ入力には同じ結果を返す。
 */
export function processManuscript(input: ProcessingInput): ProcessedManuscript {
  const hit = cache.findIndex((entry) => sameInput(entry.input, input));
  const found = hit === -1 ? undefined : cache.splice(hit, 1)[0];
  if (found !== undefined) {
    cache.unshift(found);
    return found.processed;
  }
  const composedSource = composeSource(
    input.source,
    input.composition,
    input.notation,
    input.typography.composer,
  );
  const processed: ProcessedManuscript = {
    composedSource,
    proofreading: proofread(composedSource),
  };
  cache.unshift({ input, processed });
  cache.length = Math.min(cache.length, CACHE_SIZE);
  return processed;
}
