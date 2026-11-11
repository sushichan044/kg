import { defineConfig, defineProject } from "vite-plus";

export const coreTestProjects = [
  defineProject({
    root: import.meta.dirname,
    test: {
      name: "core-unit",
      include: ["src/**/*.test.ts"],
    },
  }),
];

export default defineConfig({
  pack: [
    {
      attw: { level: "error", profile: "esm-only" },
      clean: true,
      // private な worker-rpc とその依存 comlink だけを意図してバンドルする
      deps: { onlyBundle: ["@sushichan044/kg-worker-rpc", "comlink"] },
      dts: {
        generator: "tsgo",
      },
      entry: ["src/index.ts", "src/lint.ts", "src/worker-proofread.ts", "src/plugin.ts"],
      fixedExtension: true,
      format: "esm",
      fromVite: true,
      minify: "dce-only",
      nodeProtocol: true,
      publint: true,
      sourcemap: false,
      treeshake: true,
    },
  ],
  run: {
    tasks: {
      build: "vp pack",
      check: "vp check",
      "check:fix": {
        command: "vp check --fix",
        cache: false,
      },
      dev: {
        command: "vp pack --watch",
        cache: false,
      },
      test: "vp test",
    },
  },
  test: {
    projects: coreTestProjects,
  },
});
