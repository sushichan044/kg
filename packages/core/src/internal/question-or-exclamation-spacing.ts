import { CLOSING_BRACKETS } from "./japanese-brackets";
import { isSentenceEndingMark } from "./japanese-punctuation";
import { IDEOGRAPHIC_SPACE, leadingSpaces } from "./japanese-spaces";
import { graphemeSegmenter } from "./segmenter";

type TextRange = Readonly<{ start: number; end: number }>;

export type QuestionOrExclamationSpacing =
  | Readonly<{ kind: "valid"; marks: TextRange; gap: TextRange }>
  | Readonly<{ kind: "missing"; marks: TextRange }>
  | Readonly<{ kind: "invalid-space"; marks: TextRange; gap: TextRange }>
  | Readonly<{ kind: "before-closing-bracket"; marks: TextRange; gap: TextRange }>;

/**
 * Runs, not single marks: `！？` is one mark and takes one gap, so the gap belongs after the run.
 */

function analyzeMatch(
  line: string,
  marksRange: TextRange,
): QuestionOrExclamationSpacing | undefined {
  const next = line[marksRange.end];
  if (next === undefined || CLOSING_BRACKETS.includes(next)) return undefined;

  const spaces = leadingSpaces(line.slice(marksRange.end));
  if (spaces === "") return { kind: "missing", marks: marksRange };

  const gap = { start: marksRange.end, end: marksRange.end + spaces.length };
  const following = line[gap.end];
  if (following !== undefined && CLOSING_BRACKETS.includes(following)) {
    return { kind: "before-closing-bracket", marks: marksRange, gap };
  }
  if (spaces !== IDEOGRAPHIC_SPACE) {
    return { kind: "invalid-space", marks: marksRange, gap };
  }

  return { kind: "valid", marks: marksRange, gap };
}

/**
 * Classifies the spacing after each run of Japanese question or exclamation marks in one display
 * line. Runs at the end of the line or immediately before a closing bracket need no gap and are
 * omitted from the result.
 */
export function questionOrExclamationSpacings(
  line: string,
  additionalSentenceEndingMarks = "",
): QuestionOrExclamationSpacing[] {
  const result: QuestionOrExclamationSpacing[] = [];
  let marks: TextRange | undefined;
  const flush = () => {
    if (marks === undefined) return;
    const spacing = analyzeMatch(line, marks);
    if (spacing !== undefined) result.push(spacing);
    marks = undefined;
  };
  for (const { segment, index } of graphemeSegmenter.segment(line)) {
    if (isSentenceEndingMark(segment, additionalSentenceEndingMarks)) {
      marks = { start: marks?.start ?? index, end: index + segment.length };
    } else {
      flush();
    }
  }
  flush();
  return result;
}
