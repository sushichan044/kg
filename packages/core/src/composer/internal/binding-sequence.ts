export const BindingSequence = {
  // JLReq C.2 note 5 also binds the two different halves of a kana repeat mark.
  contains: (left: string, right: string): boolean =>
    left === right || ((left === "〳" || left === "〴") && right === "〵"),
} as const;
