import { describe, expect, test } from "vite-plus/test";

import { defaultJapaneseTypesettingProfile } from "./japanese-typesetting-profile";
import { japaneseCharacterClasses } from "./japanese-typesetting-rules";
import type { JapaneseCharacterClass } from "./japanese-typesetting-rules";

/**
 * 附属書 表1（文字間の空き量）のうち、このプロファイルが区別するクラスの分を、
 * w3c/jlreq の 04837cd 時点の `tables/table_ja2.pdf` から書き写したもの。行は前に置くクラス、
 * 列は後ろに置くクラスで、`LE` は行末を表す。
 *
 * 各小間は空き量を全角単位で持つ。`.` は無印（ベタ組）、`x` は×印を表す。
 * ×印は JLReq がそもそも禁止する配置で、このプロファイルは代わりに分割禁止で応える。
 * 表1 は `1/2 be` や `1/2 af` と書いて、二分をどちらの文字サイズで測るかを示すが、
 * コンポーザーが文字サイズを一つしか使わない間は違いが出ないので、ここでは量だけを残す。
 * `hang` と `ruby hang` の添え書きはルビの掛かりに関するもので、同じ理由で省く。
 *
 * 注のある小間は、その注が示す量を持つ。注3（四分と四分）、注5（二分と四分）、注12（四分）、
 * 注2 と注6（行末で二分）、注4（行末で四分）、注13（行末の欧文間隔は幅を持たない）。
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
 * 附属書 表3（行の調整処理で詰める処理が可能な箇所）の同じクラスの分を、
 * 同じリビジョンの `tables/table_ja4.pdf` から書き写し、各小間が詰められる空き量として読んだもの。
 * `1/2-0` は二分、`1/4-0` は四分、`1/4-1/8` は八分、`1/2=0` は行末の二分になる。
 * 単独の `1/2` や `1/4` は `.` とする。そのアキは存在するが、詰める処理が可能な箇所ではないからだ。
 *
 * 注のある小間も、その注が示す量を持つ。注1（隣り合う二つの中点の四分の両方）、
 * 注2（中点の四分だけ。句点の二分は残るため）、注3（読点の二分と中点の四分）、
 * 注4（行末の欧文間隔は幅を持たない）。注5 は、行末の中点の前の四分と後ろの四分を一緒に
 * ベタ組にすることを認める。行末の小間は後ろの四分だけを持ち、
 * 前の四分はプロファイルが `absorbsPrecedingEm` で別に示す。
 *
 * Cl-26 の行と列はすべて空欄なので、表1 でアキがある箇所でも、欧文間隔の隣は詰められない。
 * 欧文間隔自体を詰めるのは JLReq の第1段階で、このプロファイルはまだそれを行わない。
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
 * 附属書 表6（行の調整処理で空ける処理が可能な箇所）の同じクラスの分を、
 * 同じリビジョンの `tables/table_ja7.pdf` から書き写し、各小間が空けられる空き量として読んだもの。
 * `1/4-1/2` は和欧間の四分に加える四分、`1/4` はベタ組の組合せに加える四分になる。
 * JLReq は行頭も行末も空けないので、表6 には行頭も行末もない。
 *
 * 空欄の小間は、上限のある空ける処理がないことを表す。
 * PDF で空欄がそれを意味するのは地色が白い小間だけで、
 * 色付きの地色の空欄は JLReq の第4段階に当たり、許されるすべての字間に残りを配る。
 * 小間の記号にはその地色が記録されないので、`FINAL_EXPANSION_OPPORTUNITIES` で別に書き写す。
 *
 * 注のある小間。注4（種類の異なる分離禁止文字が隣り合う場合は空けてよい。
 * 分割不可の文字の連続は境界の解決処理が除外する）、
 * 注8（後置省略記号の前の数字は空けてはならない）、
 * 注9 と注11（欧字の前の数字、および欧字同士は、別の方式でだけ空ける）、
 * 注10（欧字の後ろの後置省略記号は空けてよい。ただし、その欧字が量記号かアラビア数字の場合は除く。
 * このプロファイルはそれをいずれにせよ cl-24 に分類する）、注12（縦中横中の文字同士は空けてよいが、
 * グループの境界をまたぐ場合だけで、コンポーザーが問い合わせるのもそこだけだ）。
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
   08    .    .    .    .    .    .    .  1/4  1/4  1/4  1/4  1/4  1/4    .  1/4  1/4  1/4    .    .    .  1/4  1/4
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

/**
 * 表6 のうち、対応するクラスの色付きとグレーの地色。
 * `y` はその組合せが空ける処理の第4段階に加わることを、`.` は白い小間で、決して空けないことを表す。
 * JLReq 3.8.4 d は最後の残りを第1段階から第4段階までまとめて配るので、
 * それより前の段階の小間も `y` とする。
 *
 * 表6 注4 は、cl-08 同士の小間を、種類の異なる記号の場合に限って色付きにしている。
 * BoundaryRule は元の文字の値を使って、分割不可の文字の連続を除外する。
 */
const FINAL_EXPANSION_OPPORTUNITIES = `
        01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 19 24 25 26 27 30
   01    .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .
   02    y  .  .  .  .  .  .  y  .  .  .  y  y  y  y  y  y  y  y  y  y  y
   03    y  .  .  .  .  .  .  y  .  .  .  y  y  y  y  y  y  y  y  y  y  y
   04    y  .  .  .  .  .  .  y  .  .  .  y  y  y  y  y  y  y  y  y  y  y
   05    y  .  .  .  .  .  .  y  .  .  .  y  y  y  y  y  y  y  y  y  y  y
   06    y  .  .  .  .  .  .  y  .  .  .  y  y  y  y  y  y  y  y  y  y  y
   07    y  .  .  .  .  .  .  y  .  .  .  y  y  y  y  y  y  y  y  y  y  y
   08    y  .  .  .  .  .  .  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y
   09    y  .  .  .  .  .  .  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y
   10    y  .  .  .  .  .  .  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y
   11    y  .  .  .  .  .  .  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y
   12    .  .  .  .  .  .  .  y  y  y  y  y  y  .  y  y  y  .  y  y  y  y
   13    y  .  .  .  .  .  .  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y
   14    y  .  .  .  .  .  .  y  .  .  .  y  y  y  y  y  y  y  y  y  y  y
   15    y  .  .  .  .  .  .  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y
   16    y  .  .  .  .  .  .  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y
   19    y  .  .  .  .  .  .  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y
   24    y  .  .  .  .  .  .  y  y  y  y  y  .  y  y  y  y  .  y  y  .  y
   25    y  .  .  .  .  .  .  y  y  y  y  y  y  y  y  y  y  y  .  y  .  y
   26    y  .  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y
   27    y  .  .  .  .  .  .  y  y  y  y  y  y  y  y  y  y  .  .  y  .  y
   30    y  .  .  .  .  .  .  y  y  y  y  y  y  y  y  y  y  y  y  y  y  y
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
   * 表が配置そのものを禁止している箇所（×印）では `null`。
   */
  amountEm: number | null;
}>;

type ExpansionOpportunityCell = Readonly<{
  left: JapaneseCharacterClass;
  right: JapaneseCharacterClass;
  allowed: boolean;
}>;

/**
 * グリッドがクラスとして名付けていないラベルは、
 * そのままだと未知のクラスとして `pairSpacing` に渡り、既定値で答えられてしまう。
 * すると、行や列のラベルを打ち間違えたときに、存在しないクラスに対してベタ組を検証することになる。
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

function parseExpansionOpportunityTable(table: string): ExpansionOpportunityCell[] {
  const [header, ...rows] = table.trim().split("\n");
  if (header === undefined) throw new Error("表6の地色 has no header row");
  const columns = header.trim().split(/\s+/);

  return rows.flatMap((row) => {
    const [label, ...values] = row.trim().split(/\s+/);
    if (label === undefined) throw new Error("表6の地色 has an empty row");
    if (values.length !== columns.length) {
      throw new Error(`表6の地色 row ${label} has ${values.length} of ${columns.length} cells`);
    }

    return values.map((value, index) => {
      const column = columns[index];
      if (column === undefined) throw new Error(`表6の地色 row ${label} has an unlabelled column`);
      if (value !== "." && value !== "y") {
        throw new Error(`表6の地色 cell ${label}/${column} holds an unknown value ${value}`);
      }

      return {
        left: characterClassOf("表6の地色", label),
        right: characterClassOf("表6の地色", column),
        allowed: value === "y",
      };
    });
  });
}

const SPACING_TABLE = parseTable("表1", SPACING_AMOUNTS);
const REDUCTION_TABLE = parseTable("表3", REDUCIBLE_AMOUNTS);

const EXPANSION_TABLE = parseTable("表6", EXPANDABLE_AMOUNTS);
const FINAL_EXPANSION_TABLE = parseExpansionOpportunityTable(FINAL_EXPANSION_OPPORTUNITIES);

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
    ["a", "sideways", "cl-27"],
    // JLReq 3.2.4 は、正立の欧字を横向きの欧文のランではなく漢字と同じクラスに分類する。
    ["A", "upright", "cl-19"],
    ["1", "tate-chu-yoko", "cl-30"],
  ] as const)("classifies %s (%s) as %s", (value, presentation, expected) => {
    expect(defaultJapaneseTypesettingProfile.classify({ value, presentation })).toBe(expected);
  });

  test("covers every class it distinguishes in every appendix table", () => {
    const classes = [...japaneseCharacterClasses].sort();
    // ラベルが一つ重複して別の一つが抜けていても、行と列の集合は欠けずに見えるので、
    // 小間の数も数える。
    const withLineEnd = {
      rows: classes,
      columns: [...classes, LINE_END].sort(),
      cells: classes.length * (classes.length + 1),
    };

    expect(labelsOf(SPACING_TABLE)).toEqual(withLineEnd);
    expect(labelsOf(REDUCTION_TABLE)).toEqual(withLineEnd);
    // JLReq は行末も行頭も空けないので、表6 には行末がない。
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

  test("opens only naturally solid colored and gray cells at the final stage", () => {
    const wrong = FINAL_EXPANSION_TABLE.flatMap(({ left, right, allowed }) => {
      const excluded = new Set(["cl-14", "cl-26", "cl-27"]);
      const expected =
        allowed &&
        !excluded.has(left) &&
        !excluded.has(right) &&
        defaultJapaneseTypesettingProfile.pairSpacing(left, right).naturalWidthEm === 0;
      return defaultJapaneseTypesettingProfile.canExpandAtFinalStage(left, right) === expected
        ? []
        : [`${left}/${right}: ${String(!expected)} instead of ${String(expected)}`];
    });

    expect(wrong).toEqual([]);
  });

  test("keeps intrinsic and explicit spaces out of the unbounded final stage", () => {
    expect(defaultJapaneseTypesettingProfile.canExpandAtFinalStage("cl-19", "cl-27")).toBe(false);
    expect(defaultJapaneseTypesettingProfile.canExpandAtFinalStage("cl-27", "cl-15")).toBe(false);
    expect(defaultJapaneseTypesettingProfile.canExpandAtFinalStage("cl-19", "cl-24")).toBe(false);
    expect(defaultJapaneseTypesettingProfile.canExpandAtFinalStage("cl-02", "cl-19")).toBe(false);
    expect(defaultJapaneseTypesettingProfile.canExpandAtFinalStage("cl-19", "cl-14")).toBe(false);
    expect(defaultJapaneseTypesettingProfile.canExpandAtFinalStage("cl-19", "cl-26")).toBe(false);
    expect(defaultJapaneseTypesettingProfile.canExpandAtFinalStage("cl-19", "cl-19")).toBe(true);
  });

  test("adds space in the order JLReq 3.8.4 lays down", () => {
    const mixedText = defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-27");
    const solid = defaultJapaneseTypesettingProfile.pairSpacing("cl-19", "cl-19");

    expect.assert(mixedText.stretch !== undefined, "mixed-text space has no stretch capacity");
    expect.assert(solid.stretch !== undefined, "solid pair has no stretch capacity");

    expect(mixedText.stretch.stage).toBeLessThan(solid.stretch.stage);
    // 第2段階は四分を二分まで空け、第3段階はベタ組の組合せを四分まで空ける。
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

    expect(lineEnd.spacing.shrink.stage).toBeLessThan(middleDot.shrink.stage);
    expect(middleDot.shrink.stage).toBeLessThan(punctuation.shrink.stage);
    expect(punctuation.shrink.stage).toBeLessThan(mixedText.shrink.stage);
    // コストは、詰める処理を行う段階には依存しない。
    expect(lineEnd.spacing.shrink.stage).toBe(0);
    expect(lineEnd.spacing.shrink.costPerEm).toBe(0);
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
      stage: 0,
      costPerEm: 0,
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

    // 全角の3分の1は2進数で表せないが、JLReq が示す四分アキと二分アキの限界は表せる。
    expect(midLine.naturalWidthEm).toBeCloseTo(1 / 3, 12);
    expect(midLine.naturalWidthEm - midLine.shrink.amountEm).toBe(0.25);
    expect(midLine.naturalWidthEm + midLine.stretch.amountEm).toBe(0.5);
    expect(atEdge).toEqual({ kind: "glue", naturalWidthEm: 0 });
    // ボックスは一切持たない。測定器が何を報告しても、幅全体が上のアキになる。
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
    expect.assert(wordSpace !== null, "a word space sets no アキ of its own");
    expect.assert(wordSpace.shrink !== undefined, "a word space has no shrink capacity");
    expect.assert(wordSpace.stretch !== undefined, "a word space has no stretch capacity");
    expect.assert(middleDot.shrink !== undefined, "middle-dot space has no shrink capacity");
    expect.assert(mixedText.stretch !== undefined, "mixed-text space has no stretch capacity");

    // JLReq 3.8.3 a と 3.8.4 a。欧文間隔は詰める処理でも空ける処理でも第1段階だ。
    // それより先に行うのは、読者からまったく見えない行末の詰めだけだ。
    expect(wordSpace.shrink.stage).toBeLessThan(middleDot.shrink.stage);
    expect(wordSpace.stretch.stage).toBeLessThan(mixedText.stretch.stage);
    expect(wordSpace.shrink.stage).toBeGreaterThan(0);
    expect(wordSpace.stretch.stage).toBeGreaterThan(0);
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

    // 行中に離散的なアキはない。表3 が `1/2=0` と書くのは行末に対してだけだ。
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
    // 表3 注5。前の四分と後ろの四分を一緒にベタ組にするので、
    // プロファイルは自分のものではない方の四分を示す必要がある。
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

  test("leaves inseparable mark identity to the boundary resolver", () => {
    expect(defaultJapaneseTypesettingProfile.breakPenalty("cl-19", "cl-08")).toBe(0);
    expect(defaultJapaneseTypesettingProfile.breakPenalty("cl-08", "cl-08")).toBe(0);
    expect(defaultJapaneseTypesettingProfile.pairSpacing("cl-08", "cl-08")).toMatchObject({
      kind: "glue",
      naturalWidthEm: 0,
      stretch: { amountEm: 0.25 },
    });
  });

  test("only hangs commas and full stops", () => {
    expect(defaultJapaneseTypesettingProfile.canHang("cl-07")).toBe(true);
    expect(defaultJapaneseTypesettingProfile.canHang("cl-06")).toBe(true);
    expect(defaultJapaneseTypesettingProfile.canHang("cl-04")).toBe(false);
  });
});
