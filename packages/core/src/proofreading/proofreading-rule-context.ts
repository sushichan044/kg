import type { ProofreadingReport } from "./proofreading-report";

/**
 * Handed to a rule for the duration of one check; the only way a rule emits findings.
 */
export type ProofreadingRuleContext = Readonly<{
  report: (report: ProofreadingReport) => void;
}>;
