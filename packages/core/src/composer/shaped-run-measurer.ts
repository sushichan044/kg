import { FontPreset } from "../appearance/font-preset";
import { graphemeSegmenter } from "../internal/segmenter";
import { resolveGlyphOrientation } from "./glyph-orientation";
import type { GlyphOrientation } from "./glyph-orientation";
import type { MeasuredCluster } from "./measured-cluster";
import { MeasurementTextRange } from "./measurement-text-range";
import { logicalRunMeasurer } from "./run-measurer";
import type { RunMeasurer } from "./run-measurer";
import type { Shaper } from "./shaper";

type Grapheme = Readonly<{
  start: number;
  end: number;
  orientation: GlyphOrientation;
  covered: boolean;
}>;

// 異体字セレクターと結合制御は cmap に載らない
function needsGlyph(codePoint: number): boolean {
  return !(
    (codePoint >= 0xfe00 && codePoint <= 0xfe0f) ||
    (codePoint >= 0xe0100 && codePoint <= 0xe01ef) ||
    codePoint === 0x200c ||
    codePoint === 0x200d
  );
}

/**
 * フォントファイルから送り幅を引く `RunMeasurer`
 *
 * - Sideways は横、upright とルビは縦でシェーピングする
 * - Mixed は書記素ごとに向きを解決し、同じ向きが続く範囲をまとめてシェーピングする
 * - 縦中横は連なり全体で全角 1 字分
 * - Cmap に無い書記素は論理幅で置き換える
 */
export function createShapedRunMeasurer(shaper: Shaper): RunMeasurer {
  return (request) => {
    const preset = FontPreset.of(request.fontPreset);
    if (preset.measurement === "logical") return logicalRunMeasurer(request);
    const presentation =
      request.kind === "ruby"
        ? "upright"
        : request.presentation === "tate-chu-yoko"
          ? undefined
          : request.presentation;
    if (presentation === undefined) {
      // text-combine-upright は長さにかかわらず全角 1 字分に収めて描く
      return { kind: "advance", advanceEm: request.scale };
    }

    const weight = request.style?.weight ?? 400;
    const { features } = preset.rendering;
    const westernKerning = preset.rendering.westernKerning === "normal" ? 1 : 0;
    const graphemes: Grapheme[] = [...graphemeSegmenter.segment(request.text)].map(
      ({ segment, index }) => ({
        start: index,
        end: index + segment.length,
        orientation: resolveGlyphOrientation(segment, presentation),
        covered: Array.from(segment).every((character) => {
          const codePoint = character.codePointAt(0);
          return (
            codePoint === undefined || !needsGlyph(codePoint) || shaper.hasGlyph(codePoint, weight)
          );
        }),
      }),
    );

    const clusters: MeasuredCluster[] = [];
    let offsetEm = 0;
    const push = (start: number, end: number, advanceEm: number) => {
      const span = { offsetEm, advanceEm };
      clusters.push({
        textRange: MeasurementTextRange.of({ start, end }),
        layoutSpan: span,
        renderSpan: span,
      });
      offsetEm += advanceEm;
    };

    let index = 0;
    while (index < graphemes.length) {
      const first = graphemes[index];
      if (first === undefined) break;
      if (!first.covered) {
        const text = request.text.slice(first.start, first.end);
        // ルビは正立で描かれ、代替フォントの字も全角 1 字分を占めるので、論理幅の半角を使わない
        const advanceEm =
          request.kind === "ruby"
            ? request.scale
            : logicalRunMeasurer({ ...request, text, presentation: first.orientation }).advanceEm;
        push(first.start, first.end, advanceEm);
        index += 1;
        continue;
      }
      let last = index;
      for (;;) {
        const next = graphemes[last + 1];
        if (next === undefined || !next.covered || next.orientation !== first.orientation) break;
        last += 1;
      }
      const runEnd = graphemes[last]?.end ?? first.end;
      const horizontal = first.orientation === "sideways";
      const shaped = shaper.shape({
        text: request.text.slice(first.start, runEnd),
        direction: horizontal ? "horizontal" : "vertical",
        weight,
        features: horizontal ? { ...features, kern: westernKerning } : features,
      });
      // HarfBuzz は ZWNJ などを前の字と別のクラスターにするので、クラスターの境界が書記素の途中に来ることがある
      // 書記素の途中で切れた範囲は RunMeasurement.parseFor が受け付けないので、書記素の境界までまとめる
      const boundaries = new Set(graphemes.slice(index, last + 1).map(({ end }) => end));
      let pendingStart: number | undefined;
      let pendingAdvanceEm = 0;
      for (const cluster of shaped) {
        pendingStart ??= first.start + cluster.start;
        pendingAdvanceEm += cluster.advanceEm * request.scale;
        const end = first.start + cluster.end;
        if (!boundaries.has(end)) continue;
        push(pendingStart, end, pendingAdvanceEm);
        pendingStart = undefined;
        pendingAdvanceEm = 0;
      }
      if (pendingStart !== undefined) push(pendingStart, runEnd, pendingAdvanceEm);
      index = last + 1;
    }

    return clusters.length === 0
      ? { kind: "advance", advanceEm: 0 }
      : { kind: "clustered", advanceEm: offsetEm, clusters };
  };
}
