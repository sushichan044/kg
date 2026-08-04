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
        // WebKit as well as Chromium: this package lives on vertical writing, ruby, and
        // text-emphasis, which is exactly where engines diverge.
        instances: [{ browser: "chromium" }, { browser: "webkit" }],
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
      // The stylesheets ship as plain assets straight from src (see package.json
      // exports): pack merges every CSS entry into one file, which cannot express
      // the structural/theme split, and these sheets need no transpiling.
      entry: ["src/index.ts"],
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
        command: "vp pack",
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
    // Most of this package can only be tested in a browser, so a filtered `--project` run may
    // legitimately match nothing.
    passWithNoTests: true,
    projects: viewerTestProjects,
  },
});
