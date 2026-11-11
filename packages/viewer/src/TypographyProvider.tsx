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
  failed: boolean;
};

class TypographyCache {
  readonly #entries = new Map<FontPresetId, CacheEntry>();
  #retainers = 0;

  // use() は同じ Promise を受け取らないと中断し直すので、書体ごとに 1 つだけ作る
  // attempt は呼び出し側の再試行の回数で、失敗した読み込みより新しい回のときだけ読み込み直す
  load(fontPreset: FontPresetId, attempt: number): Promise<TypographyResult> {
    const found = this.#entries.get(fontPreset);
    if (found !== undefined && !(found.failed && found.attempt < attempt)) return found.promise;
    const entry: CacheEntry = {
      promise: loadTypography({ fontPreset })
        .catch(() => ManuscriptResult.fail({ kind: "font-load" as const }))
        .then((result) => {
          if (!result.ok) entry.failed = true;
          return result;
        }),
      attempt,
      failed: false,
    };
    this.#entries.set(fontPreset, entry);
    return entry.promise;
  }

  retain(): void {
    this.#retainers += 1;
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
