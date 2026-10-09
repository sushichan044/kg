import type { BoundaryRule } from "./boundary-rule";
import type { BoxAdjustment } from "./box-adjustment";
import { CandidateLine } from "./candidate-line";
import { adjustmentUnits } from "./japanese-adjustment-units";
import type { JapaneseSpacingOpportunity } from "./japanese-adjustment-units";
import type { JapaneseTypesettingProfile } from "./japanese-typesetting-profile";
import type { JapaneseCharacterClass } from "./japanese-typesetting-rules";
import type { ParagraphElement } from "./paragraph-layout";

export type JapaneseParagraphCharacter = ParagraphElement &
  Readonly<{ characterClass: JapaneseCharacterClass }>;

export type JapaneseParagraph = Readonly<{
  elements: readonly ParagraphElement[];
  resolveCandidate: (start: number, end: number, metrics?: CandidateMetrics) => CandidateLine;
}>;

export type CandidateMetrics = Readonly<{
  boxAdjustments: readonly BoxAdjustment[];
  extraSpacings: ReadonlyArray<Readonly<{ boundary: number; widthEm: number }>>;
}>;

export const JapaneseParagraph = {
  prefixAdvances: (advancesEm: readonly number[]): number[] => {
    const prefix = [0];
    for (const advance of advancesEm) prefix.push((prefix.at(-1) ?? 0) + advance);
    return prefix;
  },
  of: (
    characters: readonly JapaneseParagraphCharacter[],
    boundaries: ReadonlyArray<BoundaryRule | undefined>,
    profile: JapaneseTypesettingProfile,
    lineLengthEm: number,
  ): JapaneseParagraph => {
    const prefixEm = JapaneseParagraph.prefixAdvances(
      characters.map(({ boxAdvanceEm }) => boxAdvanceEm),
    );
    const nextVisible = Array.from<number>({ length: characters.length + 1 }).fill(
      characters.length,
    );
    const previousVisible: Array<number | undefined> = Array.from({
      length: characters.length + 1,
    });
    for (let index = characters.length - 1; index >= 0; index -= 1) {
      nextVisible[index] =
        characters[index]?.sourceGap === true
          ? (nextVisible[index + 1] ?? characters.length)
          : index;
    }
    for (let end = 1; end <= characters.length; end += 1) {
      previousVisible[end] =
        characters[end - 1]?.sourceGap === true ? previousVisible[end - 1] : end - 1;
    }
    const edges = characters.map(({ characterClass }) => ({
      paragraphHead: profile.lineStartSpacing(characterClass, "paragraph-start"),
      turnedHead: profile.lineStartSpacing(characterClass, "turned-over"),
      end: profile.lineEndSpacing(characterClass),
      sourceMid: profile.spacingCharacter(characterClass, "mid-line"),
      sourceEdge: profile.spacingCharacter(characterClass, "line-edge"),
      canHang: profile.canHang(characterClass),
    }));
    return {
      elements: characters,
      resolveCandidate: (start, end, metrics) => {
        const contentStart = nextVisible[start] ?? characters.length;
        const values: JapaneseSpacingOpportunity[] = [];
        const head = edges[contentStart];
        const headSpacing = (start === 0 ? head?.paragraphHead : head?.turnedHead) ?? null;
        if (headSpacing !== null)
          values.push({
            slot: { kind: "gap", boundary: contentStart },
            spacing: headSpacing,
            absorbsPrecedingEm: 0,
          });
        for (let index = contentStart; index < end; index += 1) {
          if (characters[index]?.sourceGap === true) continue;
          const edge = edges[index];
          const spacing =
            (index === contentStart || index === end - 1 ? edge?.sourceEdge : edge?.sourceMid) ??
            null;
          if (spacing !== null)
            values.push({ slot: { kind: "character", index }, spacing, absorbsPrecedingEm: 0 });
        }
        const finalSlots = [];
        for (let boundary = contentStart + 1; boundary < end; boundary += 1) {
          const rule = boundaries[boundary];
          if (rule?.spacing === undefined || rule.spacing === null) continue;
          const slot = { kind: "gap", boundary } as const;
          values.push({ slot, spacing: rule.spacing, absorbsPrecedingEm: 0 });
          if (rule.finalStretch) finalSlots.push(slot);
        }
        const tail = edges[end - 1]?.end ?? null;
        if (tail !== null)
          values.push({
            slot: { kind: "gap", boundary: end },
            spacing: tail.spacing,
            absorbsPrecedingEm: tail.absorbsPrecedingEm,
          });
        const lastVisible = previousVisible[end];
        for (const extra of metrics?.extraSpacings ?? []) {
          const index = values.findIndex(
            ({ slot }) => slot.kind === "gap" && slot.boundary === extra.boundary,
          );
          const existing = values[index];
          if (existing === undefined)
            values.push({
              slot: { kind: "gap", boundary: extra.boundary },
              spacing: { kind: "glue", naturalWidthEm: extra.widthEm },
              absorbsPrecedingEm: 0,
            });
          else
            values[index] = {
              ...existing,
              spacing: {
                ...existing.spacing,
                naturalWidthEm: existing.spacing.naturalWidthEm + extra.widthEm,
              },
            };
        }
        const extraBoxesEm =
          metrics?.boxAdjustments.reduce(
            (sum, box) => sum + box.advanceEm - (characters[box.index]?.boxAdvanceEm ?? 0),
            0,
          ) ?? 0;
        const line = CandidateLine.resolve(
          {
            start,
            contentStart,
            end,
            suppressedIndexes: Array.from(
              { length: contentStart - start },
              (_, index) => start + index,
            ),
            boxesSizeEm: (prefixEm[end] ?? 0) - (prefixEm[contentStart] ?? 0) + extraBoxesEm,
            terminal: nextVisible[end] === characters.length,
            lastVisible,
            lastAdvance:
              lastVisible === undefined
                ? 0
                : (metrics?.boxAdjustments.find((box) => box.index === lastVisible)?.advanceEm ??
                  characters[lastVisible]?.boxAdvanceEm ??
                  0),
            canHang: lastVisible !== undefined && edges[lastVisible]?.canHang === true,
            pairValues: values,
            unitsFor: (direction) => adjustmentUnits(values, direction),
            finalExpansion: { slots: finalSlots, costPerEm: profile.finalStretchCostPerEm },
          },
          lineLengthEm,
        );
        return metrics === undefined ? line : { ...line, boxAdjustments: metrics.boxAdjustments };
      },
    };
  },
} as const;
