import { expect, test } from "vite-plus/test";

import { logicalRunMeasurer } from "./run-measurer";

test.each(["！", "？", "‼", "⁇", "⁈", "⁉"])(
  "measures dividing punctuation %s on a full em in Japanese text",
  (text) => {
    const context = {
      text,
      fontPreset: "mincho",
      writingMode: "vertical-rl",
      fontSizePt: 12,
      scale: 1,
    } as const;

    const base = logicalRunMeasurer({ ...context, kind: "base", presentation: "mixed" });
    const ruby = logicalRunMeasurer({
      ...context,
      kind: "ruby",
      scale: 0.5,
      presentation: "mixed",
    });

    expect(base.advanceEm).toBe(1);
    expect(ruby.advanceEm).toBe(0.5);
  },
);
