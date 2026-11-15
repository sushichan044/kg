import type { NovelComposedManuscript } from "@sushichan044/kg-core";

type Composed = Pick<NovelComposedManuscript, "parsed" | "settings" | "layout">;

const LINE_BREAKS = new Set(["\n", "\r", "\r\n"]);

/**
 * 原稿の末尾に続く空行の数
 * コンポーザーと同じく、原稿の最後の改行は行を終えるだけで空行を作らない
 */
function trailingBlankLines(graphemes: Composed["parsed"]["graphemes"]): number {
  const lengths = [0];
  let endedWithLineBreak = false;
  for (const { value } of graphemes) {
    endedWithLineBreak = LINE_BREAKS.has(value);
    if (endedWithLineBreak) lengths.push(0);
    else lengths[lengths.length - 1] = (lengths.at(-1) ?? 0) + 1;
  }
  if (lengths.length > 1 && endedWithLineBreak) lengths.pop();
  let count = 0;
  while (count < lengths.length && lengths[lengths.length - 1 - count] === 0) count += 1;
  return count;
}

/**
 * ページ、段、行の順に、組版が空けただけの行かどうかを返す
 *
 * オフセットで空けた行やページの余りも、原稿の空行も、同じ空の行として組まれる
 * コンポーザーと同じ順に行を埋め直し、原稿の行が入る位置を求めて見分ける
 */
export function paddingLines({ parsed, settings, layout }: Composed): boolean[][][] {
  const { linesPerStage } = settings.flow;
  const { document, page, stage } = settings.offsets;
  const usablePerStage = linesPerStage - stage.leading - stage.trailing;
  const usablePerPage = usablePerStage * settings.flow.stagesPerPage;

  // 原稿の行を入れられる位置に、先頭から順に番号を振る
  let next = 0;
  let lastText = document.leading - 1;
  const orders = layout.pages.map(({ stages }) =>
    stages.map(({ lines }, stageIndex) =>
      lines.map((line, position) => {
        const usableIndex = stageIndex * usablePerStage + position - stage.leading;
        const withinStage = position >= stage.leading && position < linesPerStage - stage.trailing;
        const withinPage =
          usableIndex >= page.leading && usableIndex < usablePerPage - page.trailing;
        if (!withinStage || !withinPage) return undefined;
        const order = next;
        next += 1;
        if (line.range !== null) lastText = order;
        return order;
      }),
    ),
  );
  const end = lastText + 1 + trailingBlankLines(parsed.graphemes);

  return orders.map((stages) =>
    stages.map((lines) =>
      lines.map((order) => order === undefined || order < document.leading || order >= end),
    ),
  );
}
