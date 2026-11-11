export const BindingSequence = {
  // JLReq C.2 注5 は、くの字点の上と下という異なる二つの部分の連続も分割不可とする。
  contains: (left: string, right: string): boolean =>
    left === right || ((left === "〳" || left === "〴") && right === "〵"),
} as const;
