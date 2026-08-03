import type { PaperSizeId } from "./paper-size-id";

export type PaperSize = Readonly<{
  id: PaperSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
}>;

const PAPER_SIZES = {
  a4: { id: "a4", label: "A4", widthMm: 210, heightMm: 297 },
  a5: { id: "a5", label: "A5", widthMm: 148, heightMm: 210 },
  a6: { id: "a6", label: "A6（文庫）", widthMm: 105, heightMm: 148 },
  "jis-b5": { id: "jis-b5", label: "B5（JIS）", widthMm: 182, heightMm: 257 },
  "jis-b6": { id: "jis-b6", label: "B6（JIS）", widthMm: 128, heightMm: 182 },
  shinsho: { id: "shinsho", label: "新書", widthMm: 106, heightMm: 173 },
} as const satisfies Record<PaperSizeId, PaperSize>;

const ALL: readonly PaperSize[] = Object.values(PAPER_SIZES);

export const PaperSize = {
  of: (id: PaperSizeId): PaperSize => PAPER_SIZES[id],
  all: ALL,
} as const;
