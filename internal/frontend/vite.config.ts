import react from "@vitejs/plugin-react";
import Icons from "unplugin-icons/vite";
import { defineConfig, defineProject } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

import { mockFrontend } from "./mock/vite-plugin";

// ポートは Go サーバーが持つ。フロントエンドの開発中、
// Vite は API と SSE ストリーム（/_/ 以下のすべて）をそのサーバーへプロキシする。
// Vite はこのフロントエンドのルートの外側にあるパスを監視してはならない。
const GO_SERVER = "http://localhost:6280";

const iconPlugin = () =>
  Icons({ compiler: "jsx", jsx: "react", collectionsNodeResolvePath: import.meta.dirname });

export const frontendTestProjects = [
  defineProject({
    root: import.meta.dirname,
    plugins: [iconPlugin()],
    test: {
      name: "frontend-unit",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx", "mock/**/*.test.ts"],
      exclude: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
    },
  }),
  defineProject({
    root: import.meta.dirname,
    plugins: [iconPlugin()],
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

export default defineConfig(({ mode }) => ({
  cacheDir: mode === "mock" ? "node_modules/.vite-mock" : undefined,
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client"],
    exclude: ["harfbuzzjs"],
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
      "dev:mock": {
        command: "vp dev --mode mock",
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
    passWithNoTests: true,
    projects: frontendTestProjects,
  },

  plugins: [react({ compiler: true }), iconPlugin(), mode === "mock" && mockFrontend()],
  build: {
    // Go の embed.FS の元になるディレクトリへ直接ビルドする。
    outDir: "../static/dist",
    emptyOutDir: true,
  },
  server: {
    port: mode === "mock" ? 5174 : undefined,
    strictPort: mode === "mock",
    proxy:
      mode === "mock"
        ? undefined
        : {
            "/_/": {
              target: GO_SERVER,
              changeOrigin: true,
            },
          },
  },
}));
