export type AnnotationStyle = Readonly<{
  sizeEm: number;
  areaStartEm: number;
  areaEndEm: number;
}>;

export const defaultAnnotationStyle = {
  sizeEm: 0.5,
  areaStartEm: -0.5,
  areaEndEm: 0,
} as const satisfies AnnotationStyle;
