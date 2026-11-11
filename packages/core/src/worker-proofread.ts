import { connectApi, exposeApi, onAbort } from "@sushichan044/kg-worker-rpc";

import type { ComposedManuscript } from "./composer/composed-manuscript";
import type { ManuscriptDiagnostic } from "./diagnostic/manuscript-diagnostic";
import type { ParsedManuscript } from "./parser/parsed-manuscript";
import type { ProofreadError } from "./proofreading/proofread-error";
import { proofreadManuscript } from "./proofreading/proofread-manuscript";
import type {
  ComposedProofreadingRule,
  ParsedProofreadingRule,
} from "./proofreading/proofreading-rule";
import { createDefaultProofreadingRules } from "./proofreading/rules/default-rules";
import { ManuscriptResult } from "./result/manuscript-result";

/**
 * 校正の結果。`proofreadManuscript` の戻り値と同じ形で、Worker の境界を越えて届く。
 */
export type ProofreadingOutcome = ManuscriptResult<readonly ManuscriptDiagnostic[], ProofreadError>;

export type ProofreadingInput<TComposed extends ComposedManuscript = ComposedManuscript> =
  | ParsedManuscript
  | TComposed;

export type ProofreadingWorkerOptions<TComposed extends ComposedManuscript = ComposedManuscript> =
  Readonly<{
    /**
     * Worker の中で 1 回だけ呼ばれる。ルールは関数を含み Worker へ転送できないので、
     * Worker のコードの側で組み立てる。省略すると `createDefaultProofreadingRules()`。
     */
    rules?: () => ReadonlyArray<ParsedProofreadingRule | ComposedProofreadingRule<TComposed>>;
  }>;

/**
 * Worker に渡したり Worker から受け取ったりできる端点。
 */
export type ProofreadingWorkerEndpoint = Worker | MessagePort;

export type ProofreadingRequestOptions = Readonly<{
  /**
   * Abort されると返り値の Promise は reject される。実行中の校正そのものは止まらない。
   * 止めたいときは `terminate()` で Worker ごと終わらせる。
   */
  signal?: AbortSignal;
}>;

/**
 * `using` で束縛すると、スコープを抜けるときに `terminate` を呼ぶ。
 */
export interface ProofreadingClient<
  TInput extends ProofreadingInput = ProofreadingInput,
> extends Disposable {
  proofread(manuscript: TInput, options?: ProofreadingRequestOptions): Promise<ProofreadingOutcome>;
  /**
   * Worker を止める。実行中の呼び出しは reject される。
   */
  terminate(): void;
}

function isComposed<TComposed extends ComposedManuscript>(
  input: ProofreadingInput<TComposed>,
): input is TComposed {
  return "composerId" in input;
}

/**
 * ルールの cause は任意の値なので、structured clone できないものは文字列にしてから返す。
 */
function toCloneable(outcome: ProofreadingOutcome): ProofreadingOutcome {
  if (outcome.ok || outcome.error.kind !== "RuleThrew") return outcome;
  try {
    structuredClone(outcome.error.cause);
    return outcome;
  } catch {
    return ManuscriptResult.fail({ ...outcome.error, cause: String(outcome.error.cause) });
  }
}

/**
 * Worker のコード側で呼ぶ。`proofread` を公開し、`createProofreadingClient` から呼べるようにする。
 */
export function defineProofreadingWorker<TComposed extends ComposedManuscript = ComposedManuscript>(
  options: ProofreadingWorkerOptions<TComposed> = {},
  endpoint?: ProofreadingWorkerEndpoint,
): void {
  const rules = (options.rules ?? createDefaultProofreadingRules)();
  exposeApi(
    {
      proofread: (manuscript: ProofreadingInput<TComposed>): ProofreadingOutcome =>
        toCloneable(
          isComposed(manuscript)
            ? proofreadManuscript(manuscript, { rules })
            : // 実装は、パース済みの原稿に対しては組版済み専用のルールをスキップする
              proofreadManuscript(manuscript, {
                rules: rules as readonly ParsedProofreadingRule[],
              }),
        ),
    },
    endpoint,
  );
}

/**
 * Main 側で、`defineProofreadingWorker` を呼んだ Worker を型付きで呼ぶ。
 * 渡した Worker の所有権はクライアントに移る。不要になったら `terminate()` するか、`using` で束縛する。
 */
export function createProofreadingClient<TInput extends ProofreadingInput = ProofreadingInput>(
  worker: ProofreadingWorkerEndpoint,
): ProofreadingClient<TInput> {
  const connection = connectApi<{
    proofread: (manuscript: ProofreadingInput) => ProofreadingOutcome;
  }>(worker);
  const pending = new Set<(reason: Error) => void>();

  const terminate = () => {
    connection.close();
    const reason = new Error("Proofreading worker was terminated");
    for (const interrupt of pending) interrupt(reason);
    pending.clear();
  };

  return {
    proofread: async (manuscript, { signal } = {}) => {
      signal?.throwIfAborted();
      let interrupt: (reason: unknown) => void = () => {};
      const interrupted = new Promise<never>((_resolve, reject) => {
        interrupt = reject;
      });
      pending.add(interrupt);
      using _abortListener =
        signal === undefined
          ? undefined
          : onAbort(signal, () => {
              interrupt(signal.reason);
            });
      try {
        return await Promise.race([connection.api.proofread(manuscript), interrupted]);
      } finally {
        pending.delete(interrupt);
      }
    },
    terminate,
    [Symbol.dispose]: terminate,
  };
}
