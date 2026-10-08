import { expect, test } from "vite-plus/test";

import { logicalInlineMeasurer } from "./inline-measurer";

test.each(["！", "？", "‼", "⁇", "⁈", "⁉"])(
  "measures dividing punctuation %s on a full em in Japanese text",
  (text) => {
    const context = { text, fontPreset: "mincho", writingMode: "vertical-rl" } as const;

    const base = logicalInlineMeasurer({ ...context, role: "base", presentation: "mixed" });
    const ruby = logicalInlineMeasurer({ ...context, role: "ruby" });

    expect(base.advanceEm).toBe(1);
    expect(ruby.advanceEm).toBe(0.5);
  },
);
