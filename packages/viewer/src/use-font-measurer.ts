import { FontPreset, ManuscriptResult } from "@sushichan044/kg-core";
import type { FontPresetId } from "@sushichan044/kg-core";
import { startTransition, use, useState } from "react";

import { loadFontMeasurer, logicalFontMeasurer } from "./font-measurer";
import type { FontMeasurer, FontMeasurerLoadError } from "./font-measurer";

export type FontMeasurerState =
  | Readonly<{ kind: "ready"; measurer: FontMeasurer }>
  | Readonly<{ kind: "failed"; error: FontMeasurerLoadError; retry: () => void }>;

type MeasurerResult = ManuscriptResult<FontMeasurer, FontMeasurerLoadError>;
type CacheEntry = {
  readonly promise: Promise<MeasurerResult>;
  readonly attempt: number;
  failed: boolean;
};

// use() は同じ Promise を受け取らないと中断し直すので、描画をまたいで書体ごとに 1 つだけ持つ
const entries = new Map<FontPresetId, CacheEntry>();
const logicalMeasurers = new Map<FontPresetId, FontMeasurer>();

// attempt は書体ごとの読み込みの通し番号で、失敗した読み込みより新しい回のときだけ読み込み直す
function load(fontPreset: FontPresetId, attempt: number): Promise<MeasurerResult> {
  const found = entries.get(fontPreset);
  if (found !== undefined && !(found.failed && found.attempt < attempt)) return found.promise;
  const entry: CacheEntry = {
    promise: loadFontMeasurer({ fontPreset })
      .catch(() => ManuscriptResult.fail({ kind: "font-load" as const }))
      .then((result) => {
        if (!result.ok) entry.failed = true;
        return result;
      }),
    attempt,
    failed: false,
  };
  entries.set(fontPreset, entry);
  return entry.promise;
}

// 再試行で load に渡す attempt を返す
// 失敗した読み込みがあればその次の回、読み込み中か成功済みならいまの回を返すので、別の呼び出し側が先に再試行していても読み込み直せる
function nextAttempt(fontPreset: FontPresetId): number {
  const found = entries.get(fontPreset);
  if (found === undefined) return 0;
  return found.failed ? found.attempt + 1 : found.attempt;
}

function logicalMeasurerOf(fontPreset: FontPresetId): FontMeasurer {
  const found = logicalMeasurers.get(fontPreset);
  if (found !== undefined) return found;
  const created = logicalFontMeasurer(fontPreset);
  logicalMeasurers.set(fontPreset, created);
  return created;
}

/**
 * 書体の測定器を読み込み、読み込みが終わるまで中断する
 *
 * 読み込んだ測定器はページを閉じるか `resetFontMeasurers` を呼ぶまで共有する
 */
export function useFontMeasurer(fontPreset: FontPresetId): FontMeasurerState {
  const [attempt, setAttempt] = useState(0);
  if (FontPreset.of(fontPreset).measurement === "logical")
    return { kind: "ready", measurer: logicalMeasurerOf(fontPreset) };
  const result = use(load(fontPreset, attempt));
  if (result.ok) return { kind: "ready", measurer: result.value };
  const { error } = result;
  return {
    kind: "failed",
    error,
    retry: () => {
      // シェーパーの読み込みに失敗した import() はブラウザーに記録され、再読み込みしないとやり直せない
      if (error.kind === "shaper-load") {
        window.location.reload();
        return;
      }
      startTransition(() => {
        setAttempt(nextAttempt(fontPreset));
      });
    },
  };
}

/**
 * 共有している測定器を捨てる
 *
 * 次の `useFontMeasurer` は読み込みからやり直す
 * テストごとに読み込みを独立させるときや、使わなくなった書体のメモリを手放すときに呼ぶ
 */
export function resetFontMeasurers(): void {
  entries.clear();
  logicalMeasurers.clear();
}
