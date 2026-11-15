import { defineConfig, defineProject } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export const workerRpcTestProjects = [
  defineProject({
    root: import.meta.dirname,
    test: {
      name: "worker-rpc-browser",
      include: ["src/**/*.browser.test.ts"],
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        instances: [{ browser: "chromium" }],
      },
    },
  }),
];

export default defineConfig({
  run: {
    tasks: {
      check: "vp check",
      test: "vp test",
    },
  },
  test: {
    projects: workerRpcTestProjects,
  },
});
