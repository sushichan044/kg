import { ManuscriptResult } from "@sushichan044/kg-core";
import type { FontPresetId } from "@sushichan044/kg-core";
import type { ProofreadError } from "@sushichan044/kg-core/lint";

import type { ManuscriptEngine } from "./manuscript-engine";
import type {
  ManuscriptFailure,
  ManuscriptInput,
  ProcessedManuscript,
} from "./manuscript-pipeline";
import { loadRenderTypography } from "./typography";
import type { RenderTypography } from "./typography";

export type ManuscriptOutput = Readonly<{
  composed: ProcessedManuscript["composed"];
  diagnostics: ProcessedManuscript["diagnostics"];
  /**
   * 校正だけが失敗したときの理由 組版と診断のうち校正以外は有効
   */
  proofreadFailure: ProofreadError | null;
  typography: RenderTypography;
}>;

export type ManuscriptSnapshot = Readonly<{
  /**
   * 最後に成功した結果 新しい要求を待つあいだも残る
   */
  output: ManuscriptOutput | null;
  /**
   * 最新の入力がまだ output に反映されていない
   */
  pending: boolean;
  /**
   * 最新の要求の失敗 output は直前の成功のまま残る
   */
  failure: ManuscriptFailure | null;
}>;

type RenderFontLoader = (fontPreset: FontPresetId) => ReturnType<typeof loadRenderTypography>;

export type ManuscriptSessionDeps = Readonly<{ loadRenderTypography?: RenderFontLoader }>;

const INITIAL: ManuscriptSnapshot = { output: null, pending: false, failure: null };

function keyOf({ source, notation, settings }: ManuscriptInput): string {
  return JSON.stringify([source, notation, settings]);
}

/**
 * 入力の列を、一度に 1 件だけ処理する
 * 処理中に届いた入力は最新の 1 件だけを待たせ、古いものは計算を始める前に捨てる
 * 結果を待つあいだは直前の output を残す
 */
export class ManuscriptSession {
  readonly #deps: ManuscriptSessionDeps;
  readonly #listeners = new Set<() => void>();
  #snapshot: ManuscriptSnapshot = INITIAL;
  #engine: ManuscriptEngine | null = null;
  #renderFonts = new Map<FontPresetId, ReturnType<RenderFontLoader>>();
  #latest: ManuscriptInput | null = null;
  #latestKey: string | null = null;
  #queued: ManuscriptInput | null = null;
  #running = false;
  // 接続し直すと、前の接続の結果を捨てるために進める
  #epoch = 0;
  #connected = false;

  constructor(deps: ManuscriptSessionDeps = {}) {
    this.#deps = deps;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  readonly getSnapshot = (): ManuscriptSnapshot => this.#snapshot;

  connect(engine: ManuscriptEngine): () => void {
    this.#connected = true;
    this.#epoch += 1;
    this.#running = false;
    this.#engine = engine;
    // 処理済みの入力でも処理し直す
    // 切断で output が使う描画用フォントは破棄済みで、failure も前の engine のものだから
    if (this.#latest !== null) {
      this.#queued = this.#latest;
      if (!this.#snapshot.pending) this.#update({ pending: true });
    }
    this.#pump();
    return () => {
      this.#connected = false;
      this.#epoch += 1;
      this.#queued = null;
      engine.dispose();
      this.#engine = null;
      for (const loading of this.#renderFonts.values())
        void loading.then((result) => {
          if (result.ok) result.value.dispose();
        });
      this.#renderFonts = new Map();
    };
  }

  request(input: ManuscriptInput): void {
    const key = keyOf(input);
    if (key === this.#latestKey) return;
    this.#latest = input;
    this.#latestKey = key;
    this.#queued = input;
    this.#update({ pending: true });
    this.#pump();
  }

  /**
   * 失敗した最新の入力をもう一度処理する Worker を作り直せる場合は作り直す
   */
  retry(): void {
    if (this.#latest === null) return;
    this.#queued = this.#latest;
    this.#update({ pending: true });
    this.#pump();
  }

  #update(patch: Partial<ManuscriptSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...patch };
    for (const listener of this.#listeners) listener();
  }

  #renderFontsFor(fontPreset: FontPresetId) {
    const found = this.#renderFonts.get(fontPreset);
    if (found !== undefined) return found;
    const load =
      this.#deps.loadRenderTypography ?? ((fontPreset) => loadRenderTypography({ fontPreset }));
    const loading = load(fontPreset)
      .catch(() => ManuscriptResult.fail({ kind: "font-load" as const }))
      .then((result) => {
        // 接続し直したあとに古い読み込みが失敗しても、新しい接続の読み込みは消さない
        if (!result.ok && this.#renderFonts.get(fontPreset) === loading)
          this.#renderFonts.delete(fontPreset);
        return result;
      });
    this.#renderFonts.set(fontPreset, loading);
    return loading;
  }

  #pump(): void {
    const engine = this.#engine;
    const input = this.#queued;
    if (!this.#connected || this.#running || engine === null || input === null) return;
    this.#queued = null;
    this.#running = true;
    const epoch = this.#epoch;
    void this.#run(engine, input).then(() => {
      if (epoch !== this.#epoch) return;
      this.#running = false;
      this.#pump();
    });
  }

  async #run(engine: ManuscriptEngine, input: ManuscriptInput): Promise<void> {
    const epoch = this.#epoch;
    const fonts = this.#renderFontsFor(input.settings.appearance.fontPreset);
    const outcome = await engine.process(input);
    if (epoch !== this.#epoch) return;
    const newerQueued = this.#queued !== null;
    if (!outcome.ok) {
      if (!newerQueued) this.#update({ pending: false, failure: outcome.error });
      return;
    }
    const typography = await fonts;
    if (epoch !== this.#epoch) return;
    if (!typography.ok) {
      if (this.#queued === null)
        this.#update({ pending: false, failure: { stage: "typography", error: typography.error } });
      return;
    }
    const { composed, diagnostics, proofreadFailure } = outcome.value;
    // 新しい入力を待たせていても、これは表示中のものより新しいので反映する
    this.#update({
      output: { composed, diagnostics, proofreadFailure, typography: typography.value },
      pending: this.#queued !== null,
      failure: null,
    });
  }
}
