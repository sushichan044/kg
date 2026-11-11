import { CLOSING_BRACKETS } from "./japanese-brackets";
import { isSentenceEndingMark } from "./japanese-punctuation";
import { IDEOGRAPHIC_SPACE, leadingSpaces } from "./japanese-spaces";
import { graphemeSegmenter } from "./segmenter";

type TextRange = Readonly<{ start: number; end: number }>;

type QuestionOrExclamationSpacing =
  | Readonly<{ kind: "valid"; marks: TextRange; gap: TextRange }>
  | Readonly<{ kind: "missing"; marks: TextRange }>
  | Readonly<{ kind: "invalid-space"; marks: TextRange; gap: TextRange }>
  | Readonly<{ kind: "before-closing-bracket"; marks: TextRange; gap: TextRange }>;

/**
 * 個々の約物ではなく連なりで扱う。`！？` は 1 つの約物でありアキも 1 つ取るので、
 * アキは連なりの後に置く。
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
 * 表示行 1 行の中で、和文の疑問符・感嘆符の連なりそれぞれの直後のアキを分類する。
 * 行末や終わり括弧類の直前にある連なりはアキが不要なので、結果から除く。
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
