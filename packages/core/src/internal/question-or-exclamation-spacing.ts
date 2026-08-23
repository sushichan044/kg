import { CLOSING_BRACKETS } from "./japanese-brackets";
import { IDEOGRAPHIC_SPACE, leadingSpaces } from "./japanese-spaces";

type TextRange = Readonly<{ start: number; end: number }>;

export type QuestionOrExclamationSpacing =
  | Readonly<{ kind: "valid"; marks: TextRange; gap: TextRange }>
  | Readonly<{ kind: "missing"; marks: TextRange }>
  | Readonly<{ kind: "invalid-space"; marks: TextRange; gap: TextRange }>
  | Readonly<{ kind: "before-closing-bracket"; marks: TextRange; gap: TextRange }>;

/**
 * Runs, not single marks: `！？` is one mark and takes one gap, so the gap belongs after the run.
 */
const MARKS = /[？！]+/gu;

function analyzeMatch(
  line: string,
  marks: RegExpMatchArray,
): QuestionOrExclamationSpacing | undefined {
  const start = marks.index;
  if (start === undefined) return undefined;

  const marksRange = { start, end: start + marks[0].length };
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
 * Classifies the spacing after each run of fullwidth question or exclamation marks in one display
 * line. Runs at the end of the line or immediately before a closing bracket need no gap and are
 * omitted from the result.
 */
export function questionOrExclamationSpacings(line: string): QuestionOrExclamationSpacing[] {
  return [...line.matchAll(MARKS)]
    .map((marks) => analyzeMatch(line, marks))
    .filter((spacing) => spacing !== undefined);
}
