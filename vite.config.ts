import { defineConfig } from "vite-plus";

export default defineConfig({
  fmt: {
    ignorePatterns: ["pnpm-lock.yaml", "CHANGELOG.md"],
    jsdoc: {
      commentLineStrategy: "multiline",
    },
    sortImports: true,
  },
  lint: {
    jsPlugins: ["vite-plus/oxlint-plugin"],

    options: {
      typeAware: true,
      typeCheck: true,
    },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        files: ["**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        rules: {
          // Vitest fixtures require an object-destructuring first parameter; allow `({}, use) => {}`.
          "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
        },
      },
    ],
  },
});
