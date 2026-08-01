import { defineConfig } from "vite-plus";

import { frontendTestProjects } from "./internal/frontend/vite.config";
import { coreTestProjects } from "./packages/core/vite.config";
import { viewerTestProjects } from "./packages/viewer/vite.config";

export default defineConfig({
  fmt: {
    ignorePatterns: ["pnpm-lock.yaml", "CHANGELOG.md", ".release-please-manifest.json"],
    jsdoc: {
      commentLineStrategy: "multiline",
    },
    sortImports: true,
  },
  lint: {
    jsPlugins: ["vite-plus/oxlint-plugin"],
    categories: {
      correctness: "error",
      nursery: "error",
      perf: "error",
    },
    ignorePatterns: ["**/dist/**", "**/scripts/**"],
    options: {
      typeAware: true,
      typeCheck: true,
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
      "react",
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

      "vite-plus/prefer-vite-plus-imports": "error",
    },
    overrides: [
      {
        files: ["internal/frontend/**", "packages/viewer/src/**"],
        env: {
          browser: true,
        },
      },
      {
        files: ["**/*.test.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        rules: {
          // Vitest fixtures require an object-destructuring first parameter; allow `({}, use) => {}`.
          "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
        },
      },
    ],
  },

  test: {
    projects: [...coreTestProjects, ...viewerTestProjects, ...frontendTestProjects],
  },

  run: {
    tasks: {
      build: {
        command: "go build -o bin/kg .",
        dependsOn: ["kg-frontend#build"],
        output: ["bin/kg"],
      },
      "build:packages": 'vp run --filter "./packages/**" build',
      "check:generated": {
        command: [
          "git diff --exit-code -- internal/static/dist",
          'test -z "$(git ls-files --others --exclude-standard -- internal/static/dist)"',
        ],
        dependsOn: ["kg-frontend#build"],
        cache: false,
      },
      clean: {
        command: ["rm -rf bin/", "go clean"],
        cache: false,
      },
      dev: {
        command: "vp run -r --parallel dev",
        dependsOn: ["kg-frontend#build"],
        cache: false,
      },
      fmt: {
        command: "golangci-lint fmt",
        cache: false,
      },
      lint: {
        command: "golangci-lint run",
        dependsOn: ["kg-frontend#build", "lint:deadcode"],
        cache: false,
      },
      "lint:deadcode": {
        command: `out="$(go run golang.org/x/tools/cmd/deadcode@latest -test ./...)"
if [ -n "$out" ]; then
  echo "$out"
  exit 1
fi`,
        dependsOn: ["kg-frontend#build"],
        cache: false,
      },
      "lint:fix": {
        command: [
          "go fix ./...",
          "golangci-lint run --fix",
          `out="$(go run golang.org/x/tools/cmd/deadcode@latest -test ./...)"
if [ -n "$out" ]; then
  echo "$out"
  exit 1
fi`,
        ],
        dependsOn: ["kg-frontend#build"],
        cache: false,
      },
      "pkg-pr-new": {
        command: "pkg-pr-new publish --compact --comment=update --pnpm",
        cache: false,
      },
      test: {
        command: "bash -o pipefail -c 'go test ./... -cover -json | go tool tparse -all'",
        dependsOn: ["kg-frontend#build"],
        cache: false,
      },
      "test:ci": {
        command:
          "bash -o pipefail -c 'go test ./... -json | tee ./go-test.out | go tool tparse -all'",
        dependsOn: ["kg-frontend#build"],
        cache: false,
      },
    },
  },
});
