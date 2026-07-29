import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

// The Go server owns the port; during frontend development Vite proxies the API
// and SSE stream (everything under /_/) to it. Vite must not watch paths outside
// this frontend root.
const GO_SERVER = "http://localhost:6280";

export default defineConfig({
  optimizeDeps: {
    include: ["react", "react-dom", "react-dom/client"],
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  lint: {
    categories: {
      correctness: "error",
      nursery: "error",
      perf: "error",
    },
    env: {
      browser: true,
    },
    plugins: [
      // https://oxc.rs/docs/guide/usage/linter/plugins.html#supported-plugins
      // enabled by default
      "eslint",
      "typescript",
      "unicorn",
      "oxc",

      // optional
      "import",
      "node",
      "promise",
      "vitest",
    ],
    rules: {
      "import/consistent-type-specifier-style": "error",

      "typescript/array-type": ["error", { default: "array-simple" }],
      "typescript/ban-ts-comment": "error",
      "typescript/consistent-type-assertions": "error",
      "typescript/consistent-type-imports": "error",
      "typescript/no-misused-promises": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-unnecessary-type-assertion": "error",
      "typescript/no-unnecessary-type-conversion": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/non-nullable-type-assertion-style": "error",
      "typescript/switch-exhaustiveness-check": "error",
      "typescript/no-confusing-void-expression": "error",

      "node/no-path-concat": "error",

      "unicorn/custom-error-definition": "error",
      "unicorn/switch-case-braces": "error",
      "unicorn/prefer-date-now": "error",
      "unicorn/consistent-assert": "error",

      "oxc/branches-sharing-code": "error",
    },
  },

  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
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
