import { defineConfig, defineProject } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export const viewerTestProjects = [
  defineProject({
    root: import.meta.dirname,
    test: {
      name: "viewer-unit",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      exclude: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
    },
  }),
  defineProject({
    root: import.meta.dirname,
    test: {
      name: "viewer-browser",
      include: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
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
  pack: [
    {
      attw: { level: "error", profile: "esm-only" },
      clean: true,
      dts: {
        tsgo: true,
      },
      entry: ["src/index.ts", "src/styles.css"],
      fixedExtension: true,
      format: "esm",
      fromVite: true,
      minify: "dce-only",
      nodeProtocol: true,
      publint: true,
      sourcemap: false,
      treeshake: true,
      unused: {
        ignore: ["react-dom"],
      },
    },
  ],
  run: {
    tasks: {
      build: {
        command: "node scripts/generate-style-content.mjs && vp pack",
        dependsOn: [{ task: "build", from: "dependencies" }],
      },
      check: {
        command: "vp check",
        dependsOn: [{ task: "build", from: "dependencies" }],
      },
      "check:fix": {
        command: "vp check --fix",
        dependsOn: [{ task: "build", from: "dependencies" }],
        cache: false,
      },
      dev: {
        command: "vp pack --watch",
        dependsOn: [{ task: "build", from: "dependencies" }],
        cache: false,
      },
      test: {
        command: "vp test",
        dependsOn: [{ task: "build", from: "dependencies" }],
      },
    },
  },
  test: {
    // viewer-unit currently has no plain *.test.ts(x) files — everything here is
    // browser-mode only — so an empty project shouldn't fail a filtered `--project` run.
    passWithNoTests: true,
    projects: viewerTestProjects,
  },
});
