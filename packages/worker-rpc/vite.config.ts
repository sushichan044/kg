import { defineConfig, defineProject } from "vite-plus";

export const workerRpcTestProjects = [
  defineProject({
    root: import.meta.dirname,
    test: {
      name: "worker-rpc-unit",
      include: ["src/**/*.test.ts"],
    },
  }),
];

export default defineConfig({
  run: {
    tasks: {
      check: "vp check",
      "check:fix": {
        command: "vp check --fix",
        cache: false,
      },
      test: "vp test",
    },
  },
  test: {
    projects: workerRpcTestProjects,
  },
});
