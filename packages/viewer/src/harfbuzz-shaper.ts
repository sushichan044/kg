import type { ShapedCluster, Shaper, ShapeRequest } from "@sushichan044/kg-core/plugin";
import type * as HarfBuzz from "harfbuzzjs";

export type HarfBuzzFontFace = Readonly<{
  weight: 400 | 700;
  data: ArrayBuffer | Uint8Array;
}>;

type LoadedFace = Readonly<{
  face: HarfBuzz.Face;
  font: HarfBuzz.Font;
  upem: number;
  unicodes: ReadonlySet<number>;
  verticalAdvance: (glyphId: number) => number | undefined;
}>;

const VHEA_NUM_LONG_VER_METRICS_OFFSET = 34;

// harfbuzzjs 1.6.3 は縦の送り幅に vmtx を使わず、常に upem を返す
// そのため vhea / vmtx を自前で読んで補う
function readVerticalAdvances(face: HarfBuzz.Face): LoadedFace["verticalAdvance"] {
  // referenceTable の戻り値は wasm のメモリ上のビューで、メモリが伸びると無効になる
  const vhea = face.referenceTable("vhea")?.slice();
  const vmtx = face.referenceTable("vmtx")?.slice();
  if (vhea === undefined || vmtx === undefined) return () => undefined;
  const numLongMetrics = new DataView(vhea.buffer, vhea.byteOffset, vhea.byteLength).getUint16(
    VHEA_NUM_LONG_VER_METRICS_OFFSET,
  );
  const view = new DataView(vmtx.buffer, vmtx.byteOffset, vmtx.byteLength);
  return (glyphId) =>
    numLongMetrics === 0 ? undefined : view.getUint16(Math.min(glyphId, numLongMetrics - 1) * 4);
}

export type HarfBuzzShaper = Shaper & Readonly<{ dispose: () => void }>;

// document も FontFace も使わないので Worker と Node でも動く
export async function createHarfBuzzShaper(
  fonts: readonly HarfBuzzFontFace[],
): Promise<HarfBuzzShaper> {
  const hb = await import("harfbuzzjs");
  const faces = new Map<400 | 700, LoadedFace>(
    fonts.map(({ weight, data }) => {
      const face = new hb.Face(new hb.Blob(data));
      return [
        weight,
        {
          face,
          font: new hb.Font(face),
          upem: face.upem,
          unicodes: new Set(Array.from(face.collectUnicodes())),
          verticalAdvance: readVerticalAdvances(face),
        },
      ] as const;
    }),
  );
  const fallbackFace = faces.values().next().value;
  if (fallbackFace === undefined) throw new Error("At least one font face is required");
  const buffer = new hb.Buffer();
  const features = new Map<string, HarfBuzz.Feature[]>();
  const featuresFor = (request: ShapeRequest): HarfBuzz.Feature[] => {
    const key = JSON.stringify(Object.entries(request.features));
    const found = features.get(key);
    if (found !== undefined) return found;
    const created = Object.entries(request.features).map(
      ([tag, value]) => new hb.Feature(tag, value),
    );
    features.set(key, created);
    return created;
  };
  let disposed = false;

  return {
    hasGlyph: (codePoint, weight) => (faces.get(weight) ?? fallbackFace).unicodes.has(codePoint),
    shape: (request) => {
      if (disposed) throw new Error("Shaper has been disposed");
      const loaded = faces.get(request.weight) ?? fallbackFace;
      const horizontal = request.direction === "horizontal";
      buffer.reset();
      buffer.addText(request.text);
      buffer.guessSegmentProperties();
      buffer.setDirection(horizontal ? hb.Direction.LTR : hb.Direction.TTB);
      // 縦を ja にしないと GSUB の vert が効かない
      buffer.setLanguage(horizontal ? "en" : "ja");
      buffer.setClusterLevel(hb.ClusterLevel.MONOTONE_GRAPHEMES);
      hb.shape(loaded.font, buffer, featuresFor(request));
      const infos = buffer.getGlyphInfos();
      const positions = buffer.getGlyphPositions();
      const advances = new Map<number, number>();
      for (const [index, info] of infos.entries()) {
        const position = positions[index];
        const units = horizontal
          ? (position?.xAdvance ?? 0)
          : // 結合文字などの 0 は、vmtx の値で上書きしない
            position?.yAdvance === 0
            ? 0
            : (loaded.verticalAdvance(info.codepoint) ?? -(position?.yAdvance ?? 0));
        advances.set(info.cluster, (advances.get(info.cluster) ?? 0) + units);
      }
      const starts = [...new Set(infos.map(({ cluster }) => cluster))];
      return starts.map((start, index): ShapedCluster => ({
        start,
        end: starts[index + 1] ?? request.text.length,
        advanceEm: (advances.get(start) ?? 0) / loaded.upem,
      }));
    },
    dispose: () => {
      disposed = true;
      faces.clear();
      features.clear();
    },
  };
}
