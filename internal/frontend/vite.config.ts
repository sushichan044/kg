import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, defineProject } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

// The Go server owns the port; during frontend development Vite proxies the API
// and SSE stream (everything under /_/) to it. Vite must not watch paths outside
// this frontend root.
const GO_SERVER = "http://localhost:6280";

export const frontendTestProjects = [
  defineProject({
    root: import.meta.dirname,
    test: {
      name: "frontend-unit",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      exclude: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
    },
  }),
  defineProject({
    root: import.meta.dirname,
    test: {
      name: "frontend-browser",
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
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client"],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  run: {
    tasks: {
      build: {
        command: "vp build",
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
        command: "vp dev",
        dependsOn: [{ task: "build", from: "dependencies" }],
        cache: false,
      },
      preview: {
        command: "vp preview",
        dependsOn: ["build"],
        cache: false,
      },
      test: {
        command: "vp test",
        dependsOn: [{ task: "build", from: "dependencies" }],
      },
    },
  },
  test: {
    // frontend-unit currently has no plain *.test.ts(x) files — everything here is
    // browser-mode only — so an empty project shouldn't fail a filtered `--project` run.
    passWithNoTests: true,
    projects: frontendTestProjects,
  },

  plugins: [
    react(),
    babel({
      presets: [reactCompilerPreset()],
    }),
  ],
  build: {
    // Build straight into the Go embed.FS source directory.
    outDir: "../static/dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/_/": {
        target: GO_SERVER,
        changeOrigin: true,
      },
    },
  },
});
