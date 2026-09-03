import { describe, expect, test } from "vite-plus/test";

import type { JapaneseCharacterClass } from "./japanese-typesetting-profile";
import {
  defaultJapaneseTypesettingProfile,
  japaneseCharacterClasses,
} from "./japanese-typesetting-profile";

/**
 * 附属書 表1（文字間の空き量）for the classes this profile distinguishes, transcribed from
 * `tables/table_ja2.pdf` of w3c/jlreq at 04837cd. Rows are the class placed before, columns the
 * class placed after, and `LE` the line end.
 *
 * A cell holds the amount of space in em, where `.` is 無印 (set solid) and `x` is ×印, a placement
 * JLReq prohibits outright and this profile answers with a break prohibition instead. 表1 writes
 * `1/2 be` and `1/2 af` to say whose character size the half is measured against, which cannot
 * differ while the composer sets one size, so only the amount is kept here; the `hang` and `ruby
 * hang` suffixes concern ruby overhang and are dropped for the same reason.
 *
 * Cells carrying a note hold the amount that note states: 注3 (a quarter plus a quarter), 注5 (a half
 * plus a quarter), 注12 (a quarter), 注2 and 注6 (a half at the line end), 注4 (a quarter at the line
 * end) and 注13 (a word space at the line end has no width).
 *
 * Copyright © 2008 W3C® (MIT, ERCIM, Keio), All Rights Reserved.
 *
 * @see https://www.w3.org/TR/jlreq/#spacing_between_characters
 */
const SPACING_AMOUNTS = `
        01   02   03   04   05   06   07   08   09   10   11   12   13   14   15   16   19   24   25   26   27   30   LE
   01    .    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    x
   02  1/2    .  1/2  1/2  1/4    .    .  1/2  1/2  1/2  1/2  1/2  1/2    .  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2
   03  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   04  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/4  1/4    .  1/4    .    .
   05  1/4  1/4  1/4  1/4  1/2  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4
   06  1/2    .  1/2  1/2  3/4    .    .  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2
   07  1/2    .  1/2  1/2  3/4    .    .  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2
   08  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   09  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/4  1/4    .  1/4    .    .
   10  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/4  1/4    .  1/4    .    .
   11  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/4  1/4    .  1/4    .    .
   12  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    x
   13  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   14    .    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   15  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/4  1/4    .  1/4    .    .
   16  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/4  1/4    .  1/4    .    .
   19  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/4  1/4    .  1/4    .    .
   24  1/2    .    .    .  1/4    .    .    .  1/4  1/4  1/4    .    .    .  1/4  1/4  1/4    .  1/4    .    .  1/4    .
   25  1/2    .    .    .  1/4    .    .    .  1/4  1/4  1/4    .    .    .  1/4  1/4  1/4  1/4    .    .    .  1/4    .
   26  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   27  1/2    .    .    .  1/4    .    .    .  1/4  1/4  1/4    .    .    .  1/4  1/4  1/4    .  1/4    .    .  1/4    .
   30  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/4  1/4    .  1/4    .    .
`;

/**
 * 附属書 表3（行の調整処理で詰める処理が可能な箇所）for the same classes, transcribed from `tables/table_ja4.pdf` of the
 * same revision, and read as the amount of space each cell may give up. `1/2-0` becomes a half,
 * `1/4-0` a quarter, `1/4-1/8` an eighth and `1/2=0` a half at the line end; a bare `1/2` or `1/4`
 * becomes `.`, since that space exists but is no reduction opportunity.
 *
 * Note-bearing cells again hold what the note states: 注1 (both quarters of two adjacent middle
 * dots), 注2 (only the middle dot's quarter, because a full stop's half em stays), 注3 (the comma's
 * half and the middle dot's quarter) and 注4 (a word space has no width at the line end). 注5 lets
 * the quarter before and the quarter after a line-end middle dot go solid together; the line-end
 * cell still holds only the trailing quarter, and the profile names the leading one separately
 * through `absorbsPrecedingEm`.
 *
 * The whole cl-26 row and column are blank, so nothing beside a western word space is reducible
 * even where 表1 gives it space. Reducing the word space itself is JLReq's own first stage and this
 * profile does not do it yet.
 *
 * Copyright © 2008 W3C® (MIT, ERCIM, Keio), All Rights Reserved.
 *
 * @see https://www.w3.org/TR/jlreq/#opportunities_for_intercharacter_space_reduction_during_line_adjustment
 */
const REDUCIBLE_AMOUNTS = `
        01   02   03   04   05   06   07   08   09   10   11   12   13   14   15   16   19   24   25   26   27   30   LE
   01    .    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    x
   02  1/2    .  1/2  1/2  1/4    .    .  1/2  1/2  1/2  1/2  1/2  1/2    .  1/2  1/2  1/2  1/2  1/2    .  1/2  1/2  1/2
   03  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   04  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/8  1/8    .  1/8    .    .
   05  1/4  1/4  1/4  1/4  1/2  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4
   06    .    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .  1/2
   07  1/2    .  1/2  1/2  3/4    .    .  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2  1/2    .  1/2  1/2  1/2
   08  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   09  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/8  1/8    .  1/8    .    .
   10  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/8  1/8    .  1/8    .    .
   11  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/8  1/8    .  1/8    .    .
   12  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    x
   13  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   14    .    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   15  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/8  1/8    .  1/8    .    .
   16  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/8  1/8    .  1/8    .    .
   19  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/8  1/8    .  1/8    .    .
   24  1/2    .    .    .  1/4    .    .    .  1/8  1/8  1/8    .    .    .  1/8  1/8  1/8    .    .    .    .  1/8    .
   25  1/2    .    .    .  1/4    .    .    .  1/8  1/8  1/8    .    .    .  1/8  1/8  1/8  1/8    .    .    .  1/8    .
   26    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   27  1/2    .    .    .  1/4    .    .    .  1/8  1/8  1/8    .    .    .  1/8  1/8  1/8    .  1/8    .    .  1/8    .
   30  1/2    .    .    .  1/4    .    .    .    .    .    .    .    .    .    .    .    .  1/8  1/8    .  1/8    .    .
`;

/**
 * 附属書 表6（行の調整処理で空ける処理が可能な箇所）for the same classes, transcribed from `tables/table_ja7.pdf` of the
 * same revision, and read as the amount of space each cell may take on. `1/4-1/2` becomes a quarter
 * added to the Japanese-to-western quarter em, and `1/4` a quarter added to a solid pair. 表6 has no
 * line head or line end, because JLReq expands neither.
 *
 * A blank cell means no expansion. In the PDF a blank cell means that only where its background is
 * white; a blank cell on a coloured background is JLReq's fourth stage, which spreads the remainder
 * over every gap that is not unbreakable, and the background is the only thing that says which is
 * which. Reading every blank as no expansion is therefore exactly as far as this profile goes.
 *
 * Note-bearing cells: 注4 (two adjacent 分離禁止文字 of different kinds may be opened up, which this
 * profile cannot tell from the two halves of one 2倍ダッシュ, so it leaves the pair alone), 注8 (a
 * numeral before a postfixed abbreviation may not be opened up), 注9 and 注11 (a numeral before a
 * western character, and two western characters, only in variant schemes), 注10 (a postfixed
 * abbreviation after a western character may be, unless that character is a quantity symbol or an
 * Arabic numeral — which this profile classifies as cl-24 anyway) and 注12 (two tate-chu-yoko
 * characters may be, but only across a group boundary, which is the only place the composer asks).
 *
 * Copyright © 2008 W3C® (MIT, ERCIM, Keio), All Rights Reserved.
 *
 * @see https://www.w3.org/TR/jlreq/#opportunities_for_intercharacter_space_expansion_during_line_adjustment
 */
const EXPANDABLE_AMOUNTS = `
        01   02   03   04   05   06   07   08   09   10   11   12   13   14   15   16   19   24   25   26   27   30
   01    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   02    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   03    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   04    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .  1/4  1/4    .  1/4    .
   05    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   06    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   07    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   08    .    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4    .    .    .  1/4  1/4
   09    .    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4
   10    .    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4
   11    .    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4
   12    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4    .  1/4    .  1/4  1/4
   13    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4
   14    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   15    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4
   16    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4
   19    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4
   24    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4    .    .  1/4  1/4  1/4    .    .    .    .  1/4
   25    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4    .    .    .    .  1/4
   26    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .    .
   27    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4    .    .    .    .  1/4
   30    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4
`;

const LINE_END = "line-end";

const AMOUNTS_EM = new Map([
  [".", 0],
  ["1/8", 0.125],
  ["1/4", 0.25],
  ["1/2", 0.5],
  ["3/4", 0.75],
]);

type TableCell = Readonly<{
  left: JapaneseCharacterClass;
  right: JapaneseCharacterClass | typeof LINE_END;
  /**
   * `null` where the table prohibits the placement outright (×印).
   */
  amountEm: number | null;
}>;

/**
 * A label the grid does not name a class with would otherwise reach `pairSpacing` as an unknown
 * class and be answered from its default, so a mistyped row or column would assert solid spacing
 * for a class that does not exist.
 */
function characterClassOf(name: string, label: string): JapaneseCharacterClass {
  const characterClass = japaneseCharacterClasses.find((candidate) => candidate === `cl-${label}`);
  if (characterClass === undefined) {
    throw new Error(`${name} names cl-${label}, which is not a class this profile distinguishes`);
  }

  return characterClass;
}

function parseTable(name: string, table: string): TableCell[] {
  const [header, ...rows] = table.trim().split("\n");
  if (header === undefined) throw new Error(`${name} has no header row`);
  const columns = header.trim().split(/\s+/);

  return rows.flatMap((row) => {
    const [label, ...values] = row.trim().split(/\s+/);
    if (label === undefined) throw new Error(`${name} has an empty row`);
    if (values.length !== columns.length) {
      throw new Error(`${name} row ${label} has ${values.length} of ${columns.length} cells`);
    }

    return values.map((value, index) => {
      const column = columns[index];
      const amountEm = AMOUNTS_EM.get(value);
      if (column === undefined) throw new Error(`${name} row ${label} has an unlabelled column`);
      if (value !== "x" && amountEm === undefined) {
        throw new Error(`${name} cell ${label}/${column} holds an unknown amount ${value}`);
      }

      return {
        left: characterClassOf(name, label),
        right: column === "LE" ? LINE_END : characterClassOf(name, column),
        amountEm: amountEm ?? null,
      };
    });
  });
}

const SPACING_TABLE = parseTable("表1", SPACING_AMOUNTS);
const REDUCTION_TABLE = parseTable("表3", REDUCIBLE_AMOUNTS);

const EXPANSION_TABLE = parseTable("表6", EXPANDABLE_AMOUNTS);

function labelsOf(table: readonly TableCell[]) {
  return {
    rows: [...new Set(table.map(({ left }) => left))].sort(),
    columns: [...new Set(table.map(({ right }) => right))].sort(),
    cells: table.length,
  };
}

function resolvedSpacing(cell: TableCell) {
  const { left, right } = cell;
  return right === LINE_END
    ? (defaultJapaneseTypesettingProfile.lineEndSpacing(left)?.spacing ?? null)
    : defaultJapaneseTypesettingProfile.pairSpacing(left, right);
}

describe("defaultJapaneseTypesettingProfile", () => {
  test.each([
    ["「", "mixed", "cl-01"],
    ["」", "mixed", "cl-02"],
    ["‐", "mixed", "cl-03"],
    ["？", "mixed", "cl-04"],
    ["・", "mixed", "cl-05"],
    ["。", "mixed", "cl-06"],
    ["、", "mixed", "cl-07"],
    ["…", "mixed", "cl-08"],
    ["々", "mixed", "cl-09"],
    ["ー", "mixed", "cl-10"],
    ["ょ", "mixed", "cl-11"],
    ["￥", "mixed", "cl-12"],
    ["％", "mixed", "cl-13"],
    ["　", "mixed", "cl-14"],
    ["あ", "mixed", "cl-15"],
    ["ア", "mixed", "cl-16"],
    ["漢", "mixed", "cl-19"],
    ["1", "sideways", "cl-24"],
    ["℃", "mixed", "cl-25"],
    [" ", "sideways", "cl-26"],
    ["A", "upright", "cl-27"],
    ["1", "tate-chu-yoko", "cl-30"],
  ] as const)("classifies %s (%s) as %s", (value, presentation, expected) => {
    expect(defaultJapaneseTypesettingProfile.classify({ value, presentation })).toBe(expected);
  });

  test("covers every class it distinguishes in every appendix table", () => {
    const classes = [...japaneseCharacterClasses].sort();
    // A duplicated label with another dropped would keep the row and column sets whole, so count
    // the cells as well.
    const withLineEnd = {
      rows: classes,
      columns: [...classes, LINE_END].sort(),
      cells: classes.length * (classes.length + 1),
    };

    expect(labelsOf(SPACING_TABLE)).toEqual(withLineEnd);
    expect(labelsOf(REDUCTION_TABLE)).toEqual(withLineEnd);
    // 表6 has no line end, because JLReq expands neither line end nor line head.
    expect(labelsOf(EXPANSION_TABLE)).toEqual({
      rows: classes,
      columns: classes,
      cells: classes.length * classes.length,
    });
  });

  test("leaves the space 表1 prescribes between every pair of classes", () => {
    const wrong = SPACING_TABLE.filter(({ amountEm }) => amountEm !== null).flatMap((cell) => {
      const spacing = resolvedSpacing(cell);
      const naturalWidthEm = spacing?.naturalWidthEm ?? 0;

      return naturalWidthEm === cell.amountEm
        ? []
        : [`${cell.left}/${cell.right}: ${naturalWidthEm} instead of ${cell.amountEm ?? 0}`];
    });

    expect(wrong).toEqual([]);
  });

  test("gives up only the space 表3 marks as a reduction opportunity", () => {
    const wrong = REDUCTION_TABLE.filter(({ amountEm }) => amountEm !== null).flatMap((cell) => {
      const spacing = resolvedSpacing(cell);
      const shrinkEm = spacing?.shrink?.amountEm ?? 0;

      return shrinkEm === cell.amountEm
        ? []
        : [`${cell.left}/${cell.right}: ${shrinkEm} instead of ${cell.amountEm ?? 0}`];
    });

    expect(wrong).toEqual([]);
  });

  test("takes on only the space 表6 marks as an expansion opportunity", () => {
    const wrong = EXPANSION_TABLE.filter(({ amountEm }) => amountEm !== null).flatMap((cell) => {
      const spacing = resolvedSpacing(cell);
      const stretchEm = spacing?.stretch?.amountEm ?? 0;

      return stretchEm === cell.amountEm
        ? []
        : [`${cell.left}/${cell.right}: ${stretchEm} instead of ${cell.amountEm ?? 0}`];
    });

    expect(wrong).toEqual([]);
  });

  test("adds space in the order JLReq 3.8.4 lays down", () => {
    const mixedText = defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-27");
    const solid = defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-19");

    expect.assert(mixedText.stretch !== undefined, "mixed-text space has no stretch capacity");
    expect.assert(solid.stretch !== undefined, "solid pair has no stretch capacity");

    expect(mixedText.stretch.priority).toBeLessThan(solid.stretch.priority);
    // Stage 2 opens the quarter em to a half, stage 3 opens a solid pair to a quarter.
    expect(mixedText.naturalWidthEm + mixedText.stretch.amountEm).toBe(0.5);
    expect(solid.naturalWidthEm + solid.stretch.amountEm).toBe(0.25);
  });

  test("never expands a pair JLReq sets around punctuation", () => {
    expect(defaultJapaneseTypesettingProfile.pairSpacing("cl-02", "cl-19").stretch).toBeUndefined();
    expect(defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-01").stretch).toBeUndefined();
    expect(defaultJapaneseTypesettingProfile.pairSpacing("cl-05", "cl-19").stretch).toBeUndefined();
    expect(defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-14").stretch).toBeUndefined();
  });

  test("spends reducible space in the order JLReq 3.8.3 lays down", () => {
    const lineEnd = defaultJapaneseTypesettingProfile.lineEndSpacing("cl-02");
    const middleDot = defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-05");
    const punctuation = defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-01");
    const mixedText = defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-27");

    expect.assert(lineEnd !== null, "a closing bracket takes no space at the line end");
    expect.assert(lineEnd.spacing.shrink !== undefined, "line-end space has no shrink capacity");
    expect.assert(middleDot.shrink !== undefined, "middle-dot space has no shrink capacity");
    expect.assert(punctuation.shrink !== undefined, "bracket space has no shrink capacity");
    expect.assert(mixedText.shrink !== undefined, "mixed-text space has no shrink capacity");

    expect(lineEnd.spacing.shrink.priority).toBeLessThan(middleDot.shrink.priority);
    expect(middleDot.shrink.priority).toBeLessThan(punctuation.shrink.priority);
    expect(punctuation.shrink.priority).toBeLessThan(mixedText.shrink.priority);
    // Priority 0 is what makes a line-end reduction free to the paragraph optimizer.
    expect(lineEnd.spacing.shrink.priority).toBe(0);
  });

  test("reduces the space before an opening bracket and after a closing bracket or comma together", () => {
    const beforeOpening = defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-01");
    const afterClosing = defaultJapaneseTypesettingProfile.pairSpacing("cl-02", "cl-19");
    const afterComma = defaultJapaneseTypesettingProfile.pairSpacing("cl-07", "cl-19");

    expect(afterClosing).toEqual(beforeOpening);
    expect(afterComma).toEqual(beforeOpening);
  });

  test("keeps the half em after a mid-line full stop out of line adjustment", () => {
    const midLine = defaultJapaneseTypesettingProfile.pairSpacing("cl-06", "cl-19");
    const lineEnd = defaultJapaneseTypesettingProfile.lineEndSpacing("cl-06");
    expect.assert(lineEnd !== null, "a full stop takes no space at the line end");

    expect(midLine).toEqual({ kind: "glue", naturalWidthEm: 0.5 });
    expect(lineEnd.spacing.shrink).toEqual({
      priority: 0,
      amountEm: 0.5,
      granularity: "all-or-nothing",
    });
  });

  test("sets a western word space on a third em and takes it to nothing at a line edge", () => {
    const midLine = defaultJapaneseTypesettingProfile.spacingCharacter("cl-26", "mid-line");
    const atEdge = defaultJapaneseTypesettingProfile.spacingCharacter("cl-26", "line-edge");
    expect.assert(midLine !== null, "a word space sets no アキ of its own");
    expect.assert(midLine.shrink !== undefined, "a word space has no shrink capacity");
    expect.assert(midLine.stretch !== undefined, "a word space has no stretch capacity");

    // A third of an em is not representable in binary; the 四分アキ and 二分アキ limits JLReq states are.
    expect(midLine.naturalWidthEm).toBeCloseTo(1 / 3, 12);
    expect(midLine.naturalWidthEm - midLine.shrink.amountEm).toBe(0.25);
    expect(midLine.naturalWidthEm + midLine.stretch.amountEm).toBe(0.5);
    expect(atEdge).toEqual({ kind: "glue", naturalWidthEm: 0 });
    // Its box is nothing at all: the whole width is the アキ above, whatever the measurer reported.
    expect(defaultJapaneseTypesettingProfile.boxMetrics("cl-26", 0.5)).toEqual({
      advanceEm: 0,
      renderOffsetEm: 0,
    });
  });

  test("gives no class but the western word space an アキ of its own", () => {
    const others = japaneseCharacterClasses.filter((characterClass) => characterClass !== "cl-26");

    expect(
      others.flatMap((characterClass) =>
        defaultJapaneseTypesettingProfile.spacingCharacter(characterClass, "mid-line") === null
          ? []
          : [characterClass],
      ),
    ).toEqual([]);
  });

  test("reaches for the western word space before any pair, in either direction", () => {
    const wordSpace = defaultJapaneseTypesettingProfile.spacingCharacter("cl-26", "mid-line");
    const middleDot = defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-05");
    const mixedText = defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-27");
    expect.assert(wordSpace?.shrink !== undefined, "a word space has no shrink capacity");
    expect.assert(wordSpace.stretch !== undefined, "a word space has no stretch capacity");
    expect.assert(middleDot.shrink !== undefined, "middle-dot space has no shrink capacity");
    expect.assert(mixedText.stretch !== undefined, "mixed-text space has no stretch capacity");

    // JLReq 3.8.3 a and 3.8.4 a: the word space is the first stage of both directions. Only the
    // line-end reduction, which the reader cannot see at all, is taken ahead of it.
    expect(wordSpace.shrink.priority).toBeLessThan(middleDot.shrink.priority);
    expect(wordSpace.stretch.priority).toBeLessThan(mixedText.stretch.priority);
    expect(wordSpace.shrink.priority).toBeGreaterThan(0);
    expect(wordSpace.stretch.priority).toBeGreaterThan(0);
  });

  test("admits the whole line-end アキ or none of it, and nothing in between", () => {
    const atLineEnd = ["cl-02", "cl-05", "cl-06", "cl-07"] as const;
    const granularities = atLineEnd.map((characterClass) => {
      const lineEnd = defaultJapaneseTypesettingProfile.lineEndSpacing(characterClass);
      expect.assert(lineEnd !== null, `${characterClass} takes no space at the line end`);
      expect.assert(
        lineEnd.spacing.shrink !== undefined,
        `${characterClass} has no line-end shrink capacity`,
      );
      return lineEnd.spacing.shrink.granularity;
    });

    expect(granularities).toEqual([
      "all-or-nothing",
      "all-or-nothing",
      "all-or-nothing",
      "all-or-nothing",
    ]);

    // Nothing mid-line is discrete: 表3 writes `1/2=0` only against the line end.
    const midLine = japaneseCharacterClasses.flatMap((left) =>
      japaneseCharacterClasses.flatMap((right) => {
        const { shrink, stretch } = defaultJapaneseTypesettingProfile.pairSpacing(left, right);
        return [shrink?.granularity, stretch?.granularity].flatMap((granularity) =>
          granularity === undefined || granularity === "continuous"
            ? []
            : [`${left}/${right}: ${granularity}`],
        );
      }),
    );

    expect(midLine).toEqual([]);
  });

  test("takes the quarter em before a line-end middle dot into the line-end amount", () => {
    // 表3 注5: the quarter before and the quarter after go solid together, so the profile has to name
    // the one that is not its own.
    const middleDot = defaultJapaneseTypesettingProfile.lineEndSpacing("cl-05");
    const fullStop = defaultJapaneseTypesettingProfile.lineEndSpacing("cl-06");
    expect.assert(middleDot !== null, "a middle dot takes no space at the line end");
    expect.assert(fullStop !== null, "a full stop takes no space at the line end");

    expect(middleDot.absorbsPrecedingEm).toBe(0.25);
    expect(fullStop.absorbsPrecedingEm).toBe(0);
  });

  test("keeps a line-head opening bracket at its full half em where a paragraph starts", () => {
    expect(defaultJapaneseTypesettingProfile.lineStartSpacing("cl-01", "paragraph-start")).toEqual({
      kind: "glue",
      naturalWidthEm: 0.5,
    });
    expect(
      defaultJapaneseTypesettingProfile.lineStartSpacing("cl-19", "paragraph-start"),
    ).toBeNull();
  });

  test("sets a turned-over line flush against the edge, as JLReq 3.1.5 ③ does", () => {
    expect(defaultJapaneseTypesettingProfile.lineStartSpacing("cl-01", "turned-over")).toBeNull();
    expect(defaultJapaneseTypesettingProfile.lineStartSpacing("cl-19", "turned-over")).toBeNull();
  });

  test.each([
    ["cl-01", 0.5, -0.5],
    ["cl-02", 0.5, 0],
    ["cl-05", 0.5, -0.25],
    ["cl-06", 0.5, 0],
    ["cl-07", 0.5, 0],
    ["cl-19", 1, 0],
  ] as const)("sets %s on a %s em box", (characterClass, advanceEm, renderOffsetEm) => {
    expect(defaultJapaneseTypesettingProfile.boxMetrics(characterClass, 1)).toEqual({
      advanceEm,
      renderOffsetEm,
    });
  });

  test("separates a punctuation box from its following half-em glue", () => {
    expect(defaultJapaneseTypesettingProfile.boxMetrics("cl-07", 1)).toEqual({
      advanceEm: 0.5,
      renderOffsetEm: 0,
    });
    const afterComma = defaultJapaneseTypesettingProfile.lineEndSpacing("cl-07");
    expect.assert(afterComma !== null, "a comma takes no space at the line end");

    expect(afterComma.spacing).toMatchObject({ naturalWidthEm: 0.5 });
  });

  test("prohibits splitting an inseparable sequence but allows it at line start", () => {
    expect(defaultJapaneseTypesettingProfile.breakPenalty("cl-19", "cl-08")).toBe(0);
    expect(defaultJapaneseTypesettingProfile.breakPenalty("cl-08", "cl-08")).toBeNull();
    expect(defaultJapaneseTypesettingProfile.pairSpacing("cl-08", "cl-08")).toEqual({
      kind: "kern",
      naturalWidthEm: 0,
    });
  });

  test("only hangs commas and full stops", () => {
    expect(defaultJapaneseTypesettingProfile.canHang("cl-07")).toBe(true);
    expect(defaultJapaneseTypesettingProfile.canHang("cl-06")).toBe(true);
    expect(defaultJapaneseTypesettingProfile.canHang("cl-04")).toBe(false);
  });
});
