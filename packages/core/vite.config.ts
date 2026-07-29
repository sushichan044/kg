import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: [
    {
      attw: { level: "error", profile: "esm-only" },
      clean: true,
      dts: {
        tsgo: true,
      },
      entry: ["src/index.ts"],
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
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
        },
      },
    ],
  },
});
