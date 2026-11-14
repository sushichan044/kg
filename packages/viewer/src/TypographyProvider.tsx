import { ManuscriptResult } from "@sushichan044/kg-core";
import type { FontPresetId } from "@sushichan044/kg-core";
import { createContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { loadTypography } from "./typography";
import type { ReadyTypography, TypographyLoadError } from "./typography";

type TypographyResult = ManuscriptResult<ReadyTypography, TypographyLoadError>;

type CacheEntry = {
  readonly promise: Promise<TypographyResult>;
  readonly attempt: number;
  start: () => void;
  failed: boolean;
};

class TypographyCache {
  readonly #entries = new Map<FontPresetId, CacheEntry>();
  #retainers = 0;
  #revision = 0;
  readonly #listeners = new Set<() => void>();

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  getSnapshot = (): number => this.#revision;

  // 描画中には Promise だけを用意し、所有者が Effect を開始してから資源を取得する。
  // これにより、コミットされなかった描画が解放できない資源を作らない。
  // use() は同じ Promise を受け取らないと中断し直すので、書体ごとに 1 つだけ作る
  // attempt は書体ごとの読み込みの通し番号で、失敗した読み込みより新しい回のときだけ読み込み直す
  load(fontPreset: FontPresetId, attempt: number, revision: number): Promise<TypographyResult> {
    // キャッシュの無効化を購読側のレンダー依存に含め、古い Promise の再利用を防ぐ。
    if (revision !== this.#revision) return this.load(fontPreset, attempt, this.#revision);
    const found = this.#entries.get(fontPreset);
    if (found !== undefined && !(found.failed && found.attempt < attempt)) return found.promise;
    let resolveResult: (result: TypographyResult) => void = () => {};
    const promise = new Promise<TypographyResult>((resolve) => {
      resolveResult = resolve;
    });
    const entry: CacheEntry = {
      promise,
      attempt,
      failed: false,
      start: () => {
        entry.start = () => {};
        void loadTypography({ fontPreset })
          .catch(() => ManuscriptResult.fail({ kind: "font-load" as const }))
          .then((result) => {
            if (!result.ok) entry.failed = true;
            resolveResult(result);
          });
      },
    };
    this.#entries.set(fontPreset, entry);
    if (this.#retainers > 0) entry.start();
    return entry.promise;
  }

  // 再試行で load に渡す attempt を返す
  // 失敗した読み込みがあればその次の回、読み込み中か成功済みならいまの回を返すので、別の呼び出し側が先に再試行していても読み込み直せる
  nextAttempt(fontPreset: FontPresetId): number {
    const found = this.#entries.get(fontPreset);
    if (found === undefined) return 0;
    return found.failed ? found.attempt + 1 : found.attempt;
  }

  retain(): void {
    this.#retainers += 1;
    for (const entry of this.#entries.values()) entry.start();
  }

  // StrictMode はアンマウントとマウントを同期的にやり直すので、解放を後に回して再マウントで取り消せるようにする
  release(): void {
    this.#retainers -= 1;
    queueMicrotask(() => {
      if (this.#retainers > 0) return;
      for (const { promise } of this.#entries.values())
        void promise.then((result) => {
          if (result.ok) result.value.dispose();
        });
      this.#entries.clear();
      this.#revision += 1;
      for (const listener of this.#listeners) listener();
    });
  }
}

export const TypographyContext = createContext<TypographyCache | null>(null);

/**
 * 配下の useTypography が読み込んだ書体を、このコンポーネントがアンマウントされるまで保持する
 *
 * Suspense の境界より上に置く。境界の内側に置くと、中断のたびにキャッシュごと作り直される
 */
export function TypographyProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [cache] = useState(() => new TypographyCache());
  useEffect(() => {
    cache.retain();
    return () => {
      cache.release();
    };
  }, [cache]);
  return <TypographyContext value={cache}>{children}</TypographyContext>;
}
