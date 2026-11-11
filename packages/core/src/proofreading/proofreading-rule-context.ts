import type { ProofreadingReport } from "./proofreading-report";

/**
 * 1 回のチェックの間だけルールに渡される。ルールが指摘を出す唯一の手段である。
 */
export type ProofreadingRuleContext = Readonly<{
  report: (report: ProofreadingReport) => void;
}>;
