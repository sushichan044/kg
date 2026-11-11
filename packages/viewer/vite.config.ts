import react from "@vitejs/plugin-react";
import { defineConfig, defineProject } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";

export const viewerTestProjects = [
  defineProject({
    root: import.meta.dirname,
    optimizeDeps: { exclude: ["harfbuzzjs"] },
    test: {
      name: "viewer-unit",
      include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
      exclude: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
    },
  }),
  defineProject({
    root: import.meta.dirname,
    optimizeDeps: {
      exclude: ["harfbuzzjs"],
      include: ["vite-plus/test/browser", "@base-ui/react/tooltip"],
    },
    test: {
      name: "viewer-browser",
      include: ["src/**/*.browser.test.ts", "src/**/*.browser.test.tsx"],
      browser: {
        enabled: true,
        provider: playwright(),
        headless: true,
        // Chromium に加えて WebKit も使う。このパッケージは縦組、ルビ、
        // text-emphasis に依存しており、エンジンごとの差が出やすいのがまさにそこだからだ。
        instances: [{ browser: "chromium" }, { browser: "webkit" }],
      },
    },
  }),
];

export default defineConfig({
  optimizeDeps: { exclude: ["harfbuzzjs"] },
  pack: [
    {
      attw: { level: "error", profile: "esm-only" },
      clean: true,
      dts: {
        generator: "tsgo",
      },
      // スタイルシートは src からそのまま素のアセットとして配布する（package.json の exports を
      // 参照）。pack は CSS のエントリーをすべて 1 つのファイルにまとめるので、
      // structural と theme の分割を表せず、これらのシートにはトランスパイルも要らない。
      entry: ["src/index.ts", "src/typography.ts"],
      fixedExtension: true,
      format: "esm",
      fromVite: true,
      minify: "dce-only",
      nodeProtocol: true,
      plugins: [
        react({
          // SEE: https://tsdown.dev/recipes/react-support#native-oxc-support-experimental
          compiler: {
            target: "18",
            panicThreshold: "critical_errors",
          },
          // `dts: true` のときだけ必要。プラグインが生成された .d.ts ファイルを変換しないようにする
          exclude: [/node_modules/, /\.d\.ts$/],
        }),
      ],
      publint: true,
      sourcemap: false,
      treeshake: true,
      unused: {
        ignore: ["react-compiler-runtime", "react-dom"],
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
    // このパッケージの大半はブラウザーでしかテストできない。
    // そのため、`--project` で絞り込んだ実行では、該当するテストが 1 つもなくても正常である。
    passWithNoTests: true,
    projects: viewerTestProjects,
  },
});
