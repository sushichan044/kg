import { resolve } from "node:path";

import { defineProject } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export const fontProofProject = defineProject({
  root: resolve(import.meta.dirname, ".."),
  optimizeDeps: {
    include: ["vite-plus/test/browser"],
    exclude: ["harfbuzzjs"],
  },
  test: {
    name: "font-proof-browser",
    include: ["font-proof/**/*.browser.test.tsx"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: "chromium" }, { browser: "webkit" }],
    },
  },
});
