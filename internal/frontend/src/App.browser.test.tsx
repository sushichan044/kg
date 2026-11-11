import { resetFontMeasurers } from "@sushichan044/kg-viewer";
import { RouterProvider } from "react-router/dom";
import { expect, test as base, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";
import type { RenderResult } from "vitest-browser-react";

import { createAppRouter } from "./router";

import "@sushichan044/kg-viewer/styles.css";
import "./styles/index.css";

const nativeFetch = window.fetch.bind(window);

const waitFor = (assertion: () => void) => vi.waitFor(assertion, { timeout: 10000 });

const source = [
  "　静かな机に、原稿用紙を広げた。",
  "「これでいいのかな？」",
  "直すべき段落はここにある。",
  "「三点リーダーが奇数………。」",
  "　数字は2026年のままになっている。",
].join("\n");
const pixivSource = "[[rb:漢字 > かんじ]][b:太字][i:斜体][[emphasismark:強調>・]]";
const kakuyomuSource = "漢字《かんじ》";

const files = [
  { id: "novel", path: "testdata/novel.txt" },
  { id: "shared", path: "共有 原稿.txt" },
];

class FakeEventSource {
  static latest: FakeEventSource | undefined;
  readonly #listeners = new Map<string, EventListenerOrEventListenerObject>();

  constructor() {
    FakeEventSource.latest = this;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.#listeners.set(type, listener);
  }

  emit(type: string, data: string) {
    const listener = this.#listeners.get(type);
    if (typeof listener === "function") {
      listener(new MessageEvent(type, { data }));
    } else {
      listener?.handleEvent(new MessageEvent(type, { data }));
    }
  }

  close() {}
}

type FileEntry = (typeof files)[number];

type Fixtures = {
  novelSource: { current: string };
  api: { files: readonly FileEntry[]; catalogFails: boolean; failingContent: Set<string> };
  fontRequest: { failure: boolean; gate: Promise<void> | null };
  browserEnvironment: undefined;
  renderApp: () => Promise<RenderResult>;
  gateRequest: (pattern: string) => () => void;
  watchLoadingText: (target: Node) => { readonly seen: boolean };
};

const test = base.extend<Fixtures>({
  novelSource: async ({}, use) => {
    await use({ current: source });
  },
  fontRequest: async ({}, use) => {
    await use({ failure: false, gate: null });
  },
  api: async ({}, use) => {
    await use({ files, catalogFails: false, failingContent: new Set() });
  },
  browserEnvironment: [
    async ({ novelSource, fontRequest, api }, use) => {
      window.history.replaceState(null, "", "/");
      localStorage.clear();
      sessionStorage.clear();
      FakeEventSource.latest = undefined;
      resetFontMeasurers();
      vi.stubGlobal("EventSource", FakeEventSource);
      const originalFetch = window.fetch.bind(window);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
          const url = input instanceof Request ? input.url : input.toString();
          if (url.includes("RinMincho-Regular")) {
            if (fontRequest.gate !== null) await fontRequest.gate;
            if (fontRequest.failure) return new Response("unavailable", { status: 503 });
          }
          if (url.endsWith("/_/api/files")) {
            if (api.catalogFails) throw new Error("catalog unavailable");
            return new Response(JSON.stringify(api.files), {
              headers: { "content-type": "application/json" },
            });
          }

          if (url.includes("/_/api/files/")) {
            if ([...api.failingContent].some((id) => url.includes(`/_/api/files/${id}/`)))
              return new Response("unavailable", { status: 503 });
            return new Response(url.includes("/shared/") ? "共有本文" : novelSource.current);
          }
          return originalFetch(input);
        }),
      );

      await use(undefined);

      vi.unstubAllGlobals();
    },
    { auto: true },
  ],
  renderApp: async ({}, use) => {
    const routers: Array<ReturnType<typeof createAppRouter>> = [];
    await use(async () => {
      const router = createAppRouter();
      routers.push(router);
      return render(<RouterProvider router={router} useTransitions />);
    });
    for (const router of routers) router.dispose();
  },
  gateRequest: async ({}, use) => {
    await use((pattern) => {
      let resolve = () => {};
      const promise = new Promise<void>((done) => {
        resolve = done;
      });
      const forward = window.fetch;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          const url = input instanceof Request ? input.url : input.toString();
          if (url.includes(pattern)) await promise;
          return forward(input, init);
        }),
      );
      return () => {
        resolve();
      };
    });
  },
  watchLoadingText: async ({}, use) => {
    const observers: MutationObserver[] = [];
    await use((target) => {
      const watch = { seen: false };
      const observer = new MutationObserver(() => {
        if (target.textContent?.includes("書体を読み込んでいます…")) watch.seen = true;
      });
      observer.observe(target, { childList: true, subtree: true, characterData: true });
      observers.push(observer);
      return watch;
    });
    for (const observer of observers) observer.disconnect();
  },
});

test("renders composer-owned combined units without duplicating the accessible manuscript", async ({
  novelSource,
  renderApp,
}) => {
  novelSource.current = "あ12い";

  const screen = await renderApp();

  await waitFor(() => {
    const cells = Array.from(screen.container.querySelectorAll(".kgv-cell"));
    expect(cells.map((cell) => cell.textContent)).toEqual(["あ", "12", "い"]);
    const text = screen.container.querySelector(".kgv-visually-hidden");
    expect.assert(text !== null);
    expect(text.textContent.trim()).toBe("あ12い");
  });
});

test("opens diagnostics over the manuscript without resizing the preview", async ({
  renderApp,
}) => {
  await page.viewport(1280, 800);
  const screen = await renderApp();

  const diagnosticsTrigger = screen.getByRole("button", { name: "診断 4件" });
  await expect.element(diagnosticsTrigger).toBeVisible();
  const preview = screen.container.querySelector(".kgv-viewport");
  expect.assert(preview !== null);
  const width = preview.getBoundingClientRect().width;

  await diagnosticsTrigger.click();

  const drawer = screen.getByRole("complementary", { name: "診断" });
  await expect.element(drawer).toBeVisible();
  expect(preview.getBoundingClientRect().width).toBe(width);
  expect(screen.container.querySelector('[role="dialog"]')).toBeNull();

  await drawer
    .getByRole("button", { name: /行.*列の本文へ移動/ })
    .nth(3)
    .click();

  await waitFor(() => {
    const active = screen.container.querySelectorAll(".kgv-cell[data-diagnostic-active]");
    expect(active).toHaveLength(1);
    const [cell] = active;
    expect.assert(cell !== undefined);
    expect(cell.textContent).toBe("2026");
    expect(
      screen.container.querySelectorAll(".kgv-diagnostic-band[data-diagnostic-active]"),
    ).toHaveLength(1);
  });
  expect(screen.container.querySelector("iframe")).toBeNull();
});

// モバイル用ツールバーは、52rem（832px）のブレークポイントを下回ったときだけ表示される。
// クリックが画面上に実在するコントロールに当たるよう、これより狭いビューポートが要る。
test("opens compact file, settings, and diagnostics sheets", async ({ renderApp }) => {
  await page.viewport(600, 900);
  const screen = await renderApp();

  await waitFor(() => {
    const label = screen.container.querySelector(".mobile-toolbar strong");
    expect.assert(label !== null, "mobile toolbar label did not render");
    expect(label.textContent).toBe("novel.txt");
  });

  await waitFor(() => {
    expect(
      screen.container.querySelector('.mobile-toolbar [aria-label="診断 4件"]'),
    ).not.toBeNull();
  });
  const buttons = Array.from(
    screen.container.querySelectorAll<HTMLButtonElement>(".mobile-toolbar button"),
  );
  expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
    "ファイル",
    "PNGをZIPで出力",
    "診断 4件",
    "設定",
  ]);

  await screen.getByRole("button", { name: "設定" }).click();
  const settingsDialog = page.getByRole("dialog", { name: "表示設定" });
  await expect.element(settingsDialog).toBeVisible();
  await settingsDialog.getByRole("button", { name: "表示設定を閉じる" }).click();

  await screen.getByRole("button", { name: "診断 4件" }).click();
  const diagnosticsPanel = page.getByRole("complementary", { name: "診断" });
  await expect.element(diagnosticsPanel).toBeVisible();
  expect(screen.container.querySelector('[role="dialog"]')).toBeNull();
});

test("opens the file selected by the URL and preserves unrelated URL state", async ({
  renderApp,
}) => {
  window.history.replaceState(
    null,
    "",
    "/?mode=preview&file=%E5%85%B1%E6%9C%89+%E5%8E%9F%E7%A8%BF.txt#preview",
  );

  const screen = await renderApp();

  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("共有 原稿.txt");
  });
  expect(new URL(window.location.href).searchParams.get("file")).toBe("共有 原稿.txt");
  expect(new URL(window.location.href).searchParams.get("mode")).toBe("preview");
});

test("updates the shared URL when another file is selected", async ({ renderApp }) => {
  window.history.replaceState(
    null,
    "",
    "/?mode=preview&file=%E5%85%B1%E6%9C%89+%E5%8E%9F%E7%A8%BF.txt#preview",
  );
  const screen = await renderApp();

  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("共有 原稿.txt");
  });

  const fileListItem = screen.container.querySelector<HTMLAnchorElement>(
    ".sidebar .file-list__item",
  );
  expect.assert(fileListItem !== null, "sidebar has no file list item");

  fileListItem.click();

  await waitFor(() => {
    expect(new URL(window.location.href).searchParams.get("file")).toBe("testdata/novel.txt");
  });
  expect(new URL(window.location.href).searchParams.get("mode")).toBe("preview");
});

test("moves the sidebar highlight on click and keeps the current preview until the file loads", async ({
  renderApp,
  gateRequest,
}) => {
  await page.viewport(1280, 800);
  const release = gateRequest("/_/api/files/shared/content");
  const screen = await renderApp();
  const sidebar = screen.getByRole("complementary", { name: "ワークスペース" });
  const novelLink = sidebar.getByRole("link", { name: "testdata/novel.txt", exact: true });
  const sharedLink = sidebar.getByRole("link", { name: "共有 原稿.txt", exact: true });
  const preview = screen.getByRole("main");
  const exportButton = screen.getByRole("button", { name: "PNGをZIPで出力" }).first();
  await expect.element(exportButton).toBeEnabled();

  await sharedLink.click();

  await expect.element(sharedLink).toHaveAttribute("aria-current", "page");
  await expect.element(novelLink).not.toHaveAttribute("aria-current");
  await expect.element(preview).toHaveAttribute("aria-busy", "true");
  await expect.element(exportButton).toBeDisabled();
  expect(screen.container.querySelector(".toolbar-label")).toHaveTextContent("testdata/novel.txt");
  expect(screen.container.querySelector(".kgv-viewer")).not.toBeNull();

  release();

  await waitFor(() => {
    expect(screen.container.querySelector(".toolbar-label")).toHaveTextContent("共有 原稿.txt");
  });
  await expect.element(preview).toHaveAttribute("aria-busy", "false");
  await expect.element(exportButton).toBeEnabled();
});

test("normalizes an unknown URL file to the first available file", async ({ renderApp }) => {
  window.history.replaceState(null, "", "/?file=missing.txt");

  const screen = await renderApp();

  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("testdata/novel.txt");
    expect(new URL(window.location.href).searchParams.get("file")).toBe("testdata/novel.txt");
  });
});

test("synchronizes the URL after a failed initial catalog load is refreshed", async ({
  api,
  renderApp,
}) => {
  api.catalogFails = true;
  const screen = await renderApp();
  await expect.element(screen.getByText("ファイル一覧を取得できませんでした")).toBeVisible();
  expect.assert(FakeEventSource.latest !== undefined, "event source did not initialize");
  api.catalogFails = false;
  api.files = [files[1]].filter((file) => file !== undefined);

  FakeEventSource.latest.emit("update", "{}");

  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("共有 原稿.txt");
    expect(new URL(window.location.href).searchParams.get("file")).toBe("共有 原稿.txt");
  });
});

test("keeps the newest catalog when an older request finishes last", async ({ renderApp }) => {
  let catalogRequests = 0;
  let resolveInitialCatalog: ((response: Response) => void) | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.endsWith("/_/api/files")) {
        catalogRequests += 1;
        if (catalogRequests === 1) {
          return new Promise<Response>((resolve) => {
            resolveInitialCatalog = resolve;
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify([files[1]]), {
            headers: { "content-type": "application/json" },
          }),
        );
      }

      if (!url.includes("/_/api/")) return nativeFetch(input);
      return Promise.resolve(new Response("共有本文"));
    }),
  );

  const screen = await renderApp();

  await waitFor(() => {
    expect(FakeEventSource.latest).toBeDefined();
  });
  expect.assert(FakeEventSource.latest !== undefined, "event source did not initialize");

  FakeEventSource.latest.emit("update", "{}");

  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("共有 原稿.txt");
  });

  expect.assert(resolveInitialCatalog !== undefined, "initial catalog request was not issued");
  resolveInitialCatalog(
    new Response(JSON.stringify([files[0]]), {
      headers: { "content-type": "application/json" },
    }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  const label = screen.container.querySelector(".toolbar-label");
  expect.assert(label !== null, "toolbar label did not render");
  expect(label.textContent).toBe("共有 原稿.txt");
  expect(new URL(window.location.href).searchParams.get("file")).toBe("共有 原稿.txt");
});

test("shows a content failure instead of an empty manuscript and opens another file", async ({
  api,
  renderApp,
}) => {
  await page.viewport(1280, 800);
  api.failingContent.add("novel");

  const screen = await renderApp();

  await expect
    .element(
      screen
        .getByRole("main")
        .getByRole("alert")
        .getByText("本文を取得できませんでした", { exact: true }),
    )
    .toBeVisible();
  expect(screen.getByRole("button", { name: "PNGをZIPで出力" }).elements()).toHaveLength(0);
  expect(screen.container.querySelector(".kgv-viewer")).toBeNull();
  const sidebar = screen.getByRole("complementary", { name: "ワークスペース" });
  await expect
    .element(sidebar.getByRole("link", { name: "testdata/novel.txt", exact: true }))
    .toHaveAttribute("aria-current", "page");

  await sidebar.getByRole("link", { name: "共有 原稿.txt", exact: true }).click();

  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("共有 原稿.txt");
    const text = screen.container.querySelector(".kgv-visually-hidden");
    expect.assert(text !== null, "accessible viewer text did not render");
    expect(text.textContent.trim()).toBe("共有本文");
  });
});

test("reloads the content from the content failure", async ({ api, renderApp }) => {
  await page.viewport(1280, 800);
  api.failingContent.add("novel");
  const screen = await renderApp();
  const reload = screen.getByRole("main").getByRole("button", { name: "再読み込み", exact: true });
  await expect.element(reload).toBeVisible();
  api.failingContent.clear();

  await reload.click();

  await waitFor(() => {
    expect(screen.container.querySelector(".kgv-viewer")).not.toBeNull();
  });
  expect(screen.getByRole("main").getByRole("alert").elements()).toHaveLength(0);
});

// モバイルではサイドバーもツールバーも出ないので、失敗の表示からファイルを選び直せる必要がある
test("opens another file from the content failure on a compact screen", async ({
  api,
  renderApp,
}) => {
  await page.viewport(600, 900);
  api.failingContent.add("novel");
  const screen = await renderApp();
  const chooseFile = screen.getByRole("button", { name: "ファイルを選ぶ", exact: true });
  await expect.element(chooseFile).toBeVisible();

  await chooseFile.click();
  await page.getByRole("combobox", { name: "ファイル名を検索" }).fill("共有");
  await userEvent.keyboard("{Enter}");

  await waitFor(() => {
    const label = screen.container.querySelector(".mobile-toolbar strong");
    expect.assert(label !== null, "mobile toolbar label did not render");
    expect(label.textContent).toBe("共有 原稿.txt");
  });
});

test("selects the file switched to and refreshes the file list when its content fails", async ({
  api,
  renderApp,
}) => {
  await page.viewport(1280, 800);
  const screen = await renderApp();
  const sidebar = screen.getByRole("complementary", { name: "ワークスペース" });
  await waitFor(() => {
    expect(screen.container.querySelector(".kgv-viewer")).not.toBeNull();
  });
  api.files = [...files, { id: "added", path: "追加.txt" }];
  api.failingContent.add("shared");

  await sidebar.getByRole("link", { name: "共有 原稿.txt", exact: true }).click();

  await expect
    .element(screen.getByRole("main").getByText("本文を取得できませんでした", { exact: true }))
    .toBeVisible();
  await expect
    .element(sidebar.getByRole("link", { name: "共有 原稿.txt", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await expect.element(sidebar.getByRole("link", { name: "追加.txt", exact: true })).toBeVisible();
  expect(screen.container.querySelector(".kgv-viewer")).toBeNull();
});

test("shows the catalog failure when a refresh fails and recovers on reload", async ({
  api,
  renderApp,
}) => {
  const screen = await renderApp();
  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("testdata/novel.txt");
  });
  expect.assert(FakeEventSource.latest !== undefined, "event source did not initialize");
  api.catalogFails = true;

  FakeEventSource.latest.emit("update", "{}");

  await expect.element(screen.getByText("ファイル一覧を取得できませんでした")).toBeVisible();
  expect(screen.container.querySelector(".kgv-viewer")).toBeNull();
  api.catalogFails = false;

  await screen.getByRole("button", { name: "再読み込み", exact: true }).click();

  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("testdata/novel.txt");
  });
});

test("renders pixiv notation after the initial load and a file reload", async ({
  novelSource,
  renderApp,
}) => {
  novelSource.current = pixivSource;

  const screen = await renderApp();

  await waitFor(() => {
    for (const kind of ["ruby", "bold", "italic", "emphasis"]) {
      expect(screen.container.querySelector(`[data-annotation="${kind}"]`)).not.toBeNull();
    }
    const hiddenText = screen.container.querySelector(".kgv-visually-hidden");
    expect.assert(hiddenText !== null, "accessible viewer text did not render");
    expect(hiddenText.textContent.replace(/\n+$/, "")).toBe("漢字太字斜体強調");
  });
  expect(screen.container.textContent).not.toContain("[[rb:");
  expect(screen.container.querySelector("iframe")).toBeNull();

  novelSource.current = "[b:再読込]";
  expect.assert(FakeEventSource.latest !== undefined, "event source did not initialize");

  FakeEventSource.latest.emit("file-changed", JSON.stringify({ id: "novel" }));

  await waitFor(() => {
    expect(screen.container.querySelectorAll('[data-annotation="bold"]')).toHaveLength(3);
    const hiddenText = screen.container.querySelector(".kgv-visually-hidden");
    expect.assert(hiddenText !== null, "accessible viewer text did not render after reload");
    expect(hiddenText.textContent.replace(/\n+$/, "")).toBe("再読込");
  });
  expect(screen.container.textContent).not.toContain("[b:");
});

test("toggles the decorative grid without changing composition settings", async ({
  novelSource,
  renderApp,
}) => {
  novelSource.current = "あいう";
  await page.viewport(1280, 800);
  const screen = await renderApp();
  await screen
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("表示", { exact: true })
    .first()
    .click();

  await waitFor(() => {
    expect(screen.container.querySelectorAll(".kgv-rule-cell").length).toBeGreaterThan(0);
  });
  const toggle = screen.container.querySelector<HTMLInputElement>("#desktop-show-grid");
  expect.assert(toggle !== null, "grid visibility setting did not render");
  toggle.click();

  await waitFor(() => {
    expect(screen.container.querySelectorAll(".kgv-rule-cell")).toHaveLength(0);
  });
  expect(JSON.parse(localStorage.getItem("kg.manuscript.preferences.v7") ?? "null")).toMatchObject({
    version: 7,
    showGrid: false,
    composition: { flow: { lineLengthEm: 27 } },
  });
});

test("switches the persisted notation parser without auto-detecting source", async ({
  novelSource,
  renderApp,
}) => {
  novelSource.current = kakuyomuSource;
  await page.viewport(1280, 800);
  const screen = await renderApp();
  await screen
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("記法", { exact: true })
    .first()
    .click();

  await waitFor(() => {
    expect(screen.container.querySelector(".kgv-viewer")).not.toBeNull();
    expect(screen.container.querySelectorAll("[data-annotation]")).toHaveLength(0);
  });

  const kakuyomu = screen.container.querySelector<HTMLInputElement>("#desktop-notation-kakuyomu");
  expect.assert(kakuyomu !== null, "Kakuyomu notation choice did not render");
  kakuyomu.click();

  await waitFor(() => {
    expect(screen.container.querySelectorAll('[data-annotation="ruby"]')).toHaveLength(1);
  });
  expect(JSON.parse(localStorage.getItem("kg.manuscript.preferences.v7") ?? "null")).toMatchObject({
    version: 7,
    notation: "kakuyomu",
  });
});

test("shows fixed A5 dimensions and restores them after editing another paper format", async ({
  renderApp,
}) => {
  await page.viewport(1280, 900);
  const screen = await renderApp();
  await screen
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("用紙・組版・書体", { exact: true })
    .first()
    .click();
  const settings = screen.getByRole("complementary");

  await settings.getByText("A5固定組版", { exact: true }).click();
  await expect
    .element(settings.getByText("27字×23行×2段、文字サイズ12.7Q", { exact: true }))
    .toBeVisible();
  expect(screen.container.querySelector('input[id="lineLengthEm"]')).toBeNull();

  await settings.getByRole("combobox", { name: "用紙" }).selectOptions("a4");
  await settings.getByRole("spinbutton", { name: "一行の字数" }).fill("30");
  await settings.getByRole("spinbutton", { name: "文字サイズ（Q）" }).fill("13");

  await settings.getByRole("combobox", { name: "用紙" }).selectOptions("a5");
  await settings.getByText("A5固定組版", { exact: true }).click();

  await expect
    .element(settings.getByText("27字×23行×2段、文字サイズ12.7Q", { exact: true }))
    .toBeVisible();
  const saved = JSON.parse(localStorage.getItem("kg.manuscript.preferences.v7") ?? "null");
  expect(saved).toMatchObject({
    composition: {
      flow: { lineLengthEm: 27, linesPerStage: 23, stagesPerPage: 2 },
      appearance: { paperSize: "a5", fontSizeQ: 12.7 },
      page: {
        topMm: 16.55,
        bottomMm: 12,
        innerMm: 21.825,
        outerMm: 13,
        stageGapMm: 10,
        lineGapMm: 1.825,
      },
    },
  });
});

test("lets a user correct an oversized format without saving invalid settings", async ({
  renderApp,
}) => {
  await page.viewport(1280, 900);
  const screen = await renderApp();
  await screen
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("用紙・組版・書体", { exact: true })
    .first()
    .click();
  await expect.element(screen.getByRole("combobox", { name: "用紙" })).toBeVisible();

  await screen.getByRole("combobox", { name: "用紙" }).selectOptions("shinsho");

  await expect.element(screen.getByRole("alert")).toBeVisible();
  await screen.getByRole("spinbutton", { name: "一行の字数" }).fill("20");
  await screen.getByRole("spinbutton", { name: "一段の行数" }).fill("20");

  await expect.poll(() => screen.container.querySelector('[role="alert"]')).toBeNull();
  expect(JSON.parse(localStorage.getItem("kg.manuscript.preferences.v7") ?? "null")).toMatchObject({
    composition: {
      appearance: { paperSize: "shinsho" },
      flow: { lineLengthEm: 20, linesPerStage: 20 },
    },
  });
});

test("selects the fixed A6 composition from the paper control", async ({ renderApp }) => {
  await page.viewport(1280, 900);
  const screen = await renderApp();
  await screen
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("用紙・組版・書体", { exact: true })
    .first()
    .click();
  const settings = screen.getByRole("complementary");

  await settings.getByRole("combobox", { name: "用紙" }).selectOptions("a6");
  await settings.getByText("A6固定組版", { exact: true }).click();

  await expect
    .element(settings.getByText("41字×17行×1段、文字サイズ12Q", { exact: true }))
    .toBeVisible();
  await expect
    .element(settings.getByText("行間7H、行送り19H、段間0mm", { exact: true }))
    .toBeVisible();
  expect(screen.container.querySelector('input[id="lineLengthEm"]')).toBeNull();
  expect(JSON.parse(localStorage.getItem("kg.manuscript.preferences.v7") ?? "null")).toMatchObject({
    composition: {
      flow: { lineLengthEm: 41, linesPerStage: 17, stagesPerPage: 1 },
      appearance: { paperSize: "a6", fontSizeQ: 12 },
      page: {
        lineGapMm: 1.75,
        stageGapMm: 0,
        topMm: 12.5,
        bottomMm: 12.5,
        innerMm: 16,
        outerMm: 10,
      },
    },
  });
});

test("waits for the bundled font and composes the latest source with its real metrics", async ({
  fontRequest,
  novelSource,
  renderApp,
}) => {
  let release = () => {};
  fontRequest.gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const screen = await renderApp();

  await expect.element(screen.getByText("書体を読み込んでいます…", { exact: true })).toBeVisible();
  expect(screen.container.querySelector(".kgv-viewer")).toBeNull();
  novelSource.current = "あofficeい";
  expect.assert(FakeEventSource.latest !== undefined);
  FakeEventSource.latest.emit("file-changed", JSON.stringify({ id: "novel" }));
  release();
  await waitFor(() => {
    const glyph = screen.container.querySelector<HTMLElement>(".kgv-glyph-sideways");
    expect.assert(glyph !== null);
    expect(glyph.textContent).toBe("office");
    expect(getComputedStyle(glyph).fontFamily).toContain("KGRinMincho100");
    const fontPx = Number.parseFloat(getComputedStyle(glyph).fontSize);
    expect(Math.abs(glyph.getBoundingClientRect().height / fontPx - 2482 / 1024)).toBeLessThan(
      0.02,
    );
  });
});

test("retries font loading after a failed request without showing a mismatched preview", async ({
  fontRequest,
  renderApp,
}) => {
  fontRequest.failure = true;

  const screen = await renderApp();

  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent("書体を読み込めませんでした。再試行");
  expect(screen.container.querySelector(".kgv-viewer")).toBeNull();
  fontRequest.failure = false;
  await screen.getByRole("button", { name: "再試行" }).click();
  await waitFor(() => {
    expect(screen.container.querySelector('[data-typography="mincho"]')).not.toBeNull();
  });
});

test("restores the saved page after the font loads on retry", async ({
  fontRequest,
  novelSource,
  renderApp,
}) => {
  novelSource.current = "あ".repeat(27 * 23 * 2 * 2 + 1);
  sessionStorage.setItem("kg.app.page.v1:testdata/novel.txt", "1");
  fontRequest.failure = true;
  await page.viewport(1280, 800);
  const screen = await renderApp();
  await expect.element(screen.getByRole("button", { name: "再試行" })).toBeVisible();
  fontRequest.failure = false;

  await screen.getByRole("button", { name: "再試行" }).click();

  await waitFor(() => {
    const viewport = screen.container.querySelector(".kgv-viewport");
    const target = screen.container.querySelectorAll(".kgv-page")[1];
    expect.assert(viewport !== null, "viewer did not render");
    expect.assert(target !== undefined, "second page did not render");
    const offset = target.getBoundingClientRect().top - viewport.getBoundingClientRect().top;
    expect(Math.abs(offset)).toBeLessThan(2);
  });
});

test("switches typography profiles without changing manuscript source", async ({
  novelSource,
  renderApp,
}) => {
  novelSource.current = "あ゛ん゛";
  const screen = await renderApp();
  await screen
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("用紙・組版・書体", { exact: true })
    .first()
    .click();
  await expect.element(screen.getByRole("combobox", { name: "書体" })).toBeVisible();
  await waitFor(() => {
    expect(screen.container.querySelector('[data-typography="mincho"]')).not.toBeNull();
  });
  expect(
    [...screen.container.querySelectorAll(".kgv-glyph")].map((glyph) => glyph.textContent),
  ).toEqual(["あ゙", "ん゙"]);

  await screen.getByRole("combobox", { name: "書体" }).selectOptions("genei-koburi");

  await waitFor(() => {
    expect(screen.container.querySelector('[data-typography="genei-koburi"]')).not.toBeNull();
  });
  expect(
    [...screen.container.querySelectorAll(".kgv-glyph")].map((glyph) => glyph.textContent),
  ).toEqual(["あ", "゛", "ん", "゛"]);
  expect(novelSource.current).toBe("あ゛ん゛");
  await screen.getByRole("combobox", { name: "書体" }).selectOptions("mincho");
  await waitFor(() => {
    expect(screen.container.querySelector('[data-typography="mincho"]')).not.toBeNull();
  });
  expect(
    [...screen.container.querySelectorAll(".kgv-glyph")].map((glyph) => glyph.textContent),
  ).toEqual(["あ゙", "ん゙"]);
});

test("keeps the previous preview while another font loads", async ({
  renderApp,
  gateRequest,
  watchLoadingText,
}) => {
  await page.viewport(1280, 800);
  const screen = await renderApp();
  await screen
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("用紙・組版・書体", { exact: true })
    .first()
    .click();
  const preview = screen.getByRole("main");
  const exportButton = screen.getByRole("button", { name: "PNGをZIPで出力" }).first();
  await waitFor(() => {
    expect(screen.container.querySelector('[data-typography="mincho"]')).not.toBeNull();
  });
  await expect.element(exportButton).toBeEnabled();
  const release = gateRequest("GenEiKoburiMin6");
  const loadingText = watchLoadingText(screen.container);

  await screen.getByRole("combobox", { name: "書体" }).selectOptions("genei-koburi");

  await expect.element(preview).toHaveAttribute("aria-busy", "true");
  await expect.element(exportButton).toBeDisabled();
  expect(screen.container.querySelector('[data-typography="mincho"]')).not.toBeNull();

  release();

  await waitFor(() => {
    expect(screen.container.querySelector('[data-typography="genei-koburi"]')).not.toBeNull();
  });
  await expect.element(preview).toHaveAttribute("aria-busy", "false");
  await expect.element(exportButton).toBeEnabled();
  expect(loadingText.seen).toBe(false);
});

test("switches back to an already loaded font without showing the loading text", async ({
  renderApp,
  watchLoadingText,
}) => {
  await page.viewport(1280, 800);
  const screen = await renderApp();
  await screen
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("用紙・組版・書体", { exact: true })
    .first()
    .click();
  await waitFor(() => {
    expect(screen.container.querySelector('[data-typography="mincho"]')).not.toBeNull();
  });
  await screen.getByRole("combobox", { name: "書体" }).selectOptions("genei-koburi");
  await waitFor(() => {
    expect(screen.container.querySelector('[data-typography="genei-koburi"]')).not.toBeNull();
  });
  const loadingText = watchLoadingText(screen.container);

  await screen.getByRole("combobox", { name: "書体" }).selectOptions("mincho");

  await waitFor(() => {
    expect(screen.container.querySelector('[data-typography="mincho"]')).not.toBeNull();
  });
  expect(loadingText.seen).toBe(false);
});

test("keeps settings available after font loading fails and recovers with Gothic", async ({
  fontRequest,
  renderApp,
}) => {
  fontRequest.failure = true;
  const screen = await renderApp();
  await screen
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("用紙・組版・書体", { exact: true })
    .first()
    .click();
  await expect.element(screen.getByRole("alert")).toBeVisible();
  await expect.element(screen.getByRole("combobox", { name: "書体" })).toBeVisible();

  await screen.getByRole("combobox", { name: "書体" }).selectOptions("gothic");

  await waitFor(() => {
    expect(screen.container.querySelector(".kgv-viewer")).not.toBeNull();
  });
  expect(screen.container.querySelector('[role="alert"]')).toBeNull();
  expect(screen.container.querySelectorAll(".kgv-glyph").length).toBeGreaterThan(0);
});

test("switches spread layout and chooses the starting page side", async ({
  novelSource,
  renderApp,
}) => {
  novelSource.current = "あ".repeat(27 * 23 * 2 + 1);
  await page.viewport(1280, 800);
  const screen = await renderApp();
  await screen
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("表示", { exact: true })
    .first()
    .click();
  const toggle = screen.getByRole("checkbox", { name: "見開き表示" });
  const side = screen.getByRole("combobox", { name: "開始ページの位置" });
  await expect.element(toggle).not.toBeChecked();
  await expect.element(side).toHaveValue("right");
  await vi.waitFor(() => {
    expect(screen.container.querySelectorAll(".kgv-page")).toHaveLength(2);
  });

  await toggle.click();

  await vi.waitFor(() => {
    expect(screen.container.querySelector(".kgv-stack")).toHaveAttribute("data-spread");
    expect(screen.container.querySelector(".kgv-page")).toHaveAttribute("data-page-side", "right");
  });
  await side.selectOptions("left");

  await vi.waitFor(() => {
    expect(screen.container.querySelector(".kgv-page")).toHaveAttribute("data-page-side", "left");
  });
  await screen.unmount();
  const restored = await renderApp();
  await restored
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("表示", { exact: true })
    .first()
    .click();

  await expect.element(restored.getByRole("checkbox", { name: "見開き表示" })).toBeChecked();
  await expect
    .element(restored.getByRole("combobox", { name: "開始ページの位置" }))
    .toHaveValue("left");
  await vi.waitFor(() => {
    expect(restored.container.querySelector(".kgv-stack")).toHaveAttribute("data-spread");
    expect(restored.container.querySelector(".kgv-page")).toHaveAttribute("data-page-side", "left");
  });
  await restored.getByRole("checkbox", { name: "見開き表示" }).click();

  await vi.waitFor(() => {
    expect(restored.container.querySelector(".kgv-stack")).not.toHaveAttribute("data-spread");
  });
});

test("keeps settings folded and restores the sidebar after hiding it", async ({ renderApp }) => {
  await page.viewport(1440, 900);
  const screen = await renderApp();
  await expect
    .element(screen.getByRole("button", { name: "サイドバー", exact: true }))
    .toBeVisible();
  expect(screen.container.querySelector(".sidebar .settings-section[open]")).toBeNull();
  const preview = screen.container.querySelector<HTMLElement>(".preview");
  expect.assert(preview !== null);
  const initialWidth = preview.clientWidth;

  await screen.getByRole("button", { name: "サイドバー", exact: true }).click();

  await expect
    .element(screen.getByRole("button", { name: "サイドバー", exact: true }))
    .toHaveAttribute("aria-expanded", "false");
  expect(preview.clientWidth).toBeGreaterThan(initialWidth);
  await screen.getByRole("button", { name: "サイドバー", exact: true }).click();
  await screen
    .getByRole("complementary", { name: "ワークスペース" })
    .getByText("用紙・組版・書体", { exact: true })
    .first()
    .click();
  await expect.element(screen.getByRole("combobox", { name: "用紙" })).toBeVisible();
});

test("switches files with Command K and Ctrl K and restores focus on Escape", async ({
  renderApp,
}) => {
  await page.viewport(1440, 900);
  const screen = await renderApp();
  const search = screen.getByRole("button", { name: "ファイルを検索", exact: true });
  await search.hover();
  await expect.element(page.getByRole("tooltip")).toHaveTextContent("ファイルを検索⌘K / Ctrl K");
  await search.click();
  const input = page.getByRole("combobox", { name: "ファイル名を検索" });
  await input.fill("共有");
  await expect
    .element(page.getByRole("listbox", { name: "ファイルの候補" }).getByRole("option"))
    .toHaveTextContent("共有 原稿.txt");
  await userEvent.keyboard("{Enter}");
  await expect
    .element(screen.getByRole("link", { name: "共有 原稿.txt", exact: true }))
    .toBeVisible();
  await expect
    .poll(() => new URL(window.location.href).searchParams.get("file"))
    .toBe("共有 原稿.txt");

  await userEvent.keyboard("{Meta>}k{/Meta}");
  await input.fill("missing");
  await expect.element(page.getByText("一致するファイルがありません")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect.element(search).toHaveFocus();
  await userEvent.keyboard("{Control>}k{/Control}");
  await input.fill("novel");
  await userEvent.keyboard("{Enter}");
  await expect
    .poll(() => new URL(window.location.href).searchParams.get("file"))
    .toBe("testdata/novel.txt");
});

test("allows zoom from 25 to 400 percent and persists manual zoom", async ({ renderApp }) => {
  await page.viewport(1600, 900);
  const screen = await renderApp();
  const zoom = screen.getByRole("main").getByLabelText("現在のズーム");
  await expect.element(zoom).toHaveTextContent("100%");

  await screen.getByRole("button", { name: "縮小", exact: true }).click({ clickCount: 3 });

  await expect.element(zoom).toHaveTextContent("25%");
  await expect.element(screen.getByRole("button", { name: "縮小", exact: true })).toBeDisabled();
  await screen.getByRole("button", { name: "拡大", exact: true }).click({ clickCount: 15 });
  await expect.element(zoom).toHaveTextContent("400%");
  await expect.element(screen.getByRole("button", { name: "拡大", exact: true })).toBeDisabled();
  expect(JSON.parse(localStorage.getItem("kg.manuscript.preferences.v7") ?? "null")).toMatchObject({
    zoom: 400,
    fit: false,
  });
  await screen.getByRole("button", { name: "ページに合わせる", exact: true }).click();
  await expect
    .element(screen.getByRole("button", { name: "ページに合わせる", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
});

test("closes only the file palette when Escape is pressed over the settings dialog", async ({
  renderApp,
}) => {
  await page.viewport(600, 900);
  const screen = await renderApp();
  const settingsButton = screen.getByRole("button", { name: "設定", exact: true });
  await settingsButton.click();
  const settingsDialog = page.getByRole("dialog", { name: "表示設定" });
  await expect.element(settingsDialog).toBeVisible();
  const closeSettings = settingsDialog.getByRole("button", { name: "表示設定を閉じる" });
  await expect.element(closeSettings).toHaveFocus();

  await userEvent.keyboard("{Control>}k{/Control}");
  await expect.element(page.getByRole("dialog", { name: "ファイルを開く" })).toBeVisible();
  await userEvent.keyboard("{Escape}");

  await expect.element(settingsDialog).toBeVisible();
  await expect.element(closeSettings).toHaveFocus();
  await closeSettings.click();
  await expect.element(settingsButton).toHaveFocus();
});

test("downloads all pages as 600 dpi monochrome PNG files", async ({ novelSource, renderApp }) => {
  novelSource.current = "漢字《かんじ》12".repeat(400);
  await page.viewport(1280, 800);
  const screen = await renderApp();
  await waitFor(() => {
    expect(screen.container.querySelectorAll(".kgv-page").length).toBeGreaterThan(1);
  });
  const pageCount = screen.container.querySelectorAll(".kgv-page").length;
  let archive: Blob | undefined;
  const createObjectURL = URL.createObjectURL.bind(URL);
  const urlSpy = vi.spyOn(URL, "createObjectURL").mockImplementation((value) => {
    if (value instanceof Blob && value.type === "application/zip") archive = value;
    return createObjectURL(value);
  });
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    await screen.getByRole("button", { name: "PNGをZIPで出力" }).first().click();
    await vi.waitFor(
      () => {
        expect(archive).toBeDefined();
      },
      { timeout: 120000, interval: 200 },
    );
    expect.assert(archive !== undefined);
    const { unzipSync, unzlibSync } = await import("fflate");
    const entries = unzipSync(new Uint8Array(await archive.arrayBuffer()));
    expect(Object.keys(entries)).toEqual(
      Array.from({ length: pageCount }, (_, index) => `${String(index + 1).padStart(3, "0")}.png`),
    );
    const first = entries["001.png"];
    expect.assert(first !== undefined);
    const view = new DataView(first.buffer, first.byteOffset, first.byteLength);
    expect(view.getUint32(16)).toBe(Math.round((148 * 600) / 25.4));
    expect(view.getUint32(20)).toBe(Math.round((210 * 600) / 25.4));
    expect(first[24]).toBe(1);
    const imageData = unzlibSync(first.subarray(62, 62 + view.getUint32(54)));
    expect(imageData.filter((byte) => byte !== 255).length).toBeGreaterThan(
      view.getUint32(20) + 1000,
    );
  } finally {
    clickSpy.mockRestore();
    urlSpy.mockRestore();
  }
}, 130000);

test("draws exported pages with the bundled font instead of a fallback", async ({
  novelSource,
  renderApp,
}) => {
  novelSource.current = "あいうえお漢字";
  await page.viewport(1280, 800);
  const screen = await renderApp();
  const exportButton = screen.getByRole("button", { name: "PNGをZIPで出力" }).first();
  await expect.element(exportButton).toBeEnabled();
  const { snapdom } = await import("@zumer/snapdom");
  const capture = snapdom.toCanvas.bind(snapdom);
  const pixels = (canvas: HTMLCanvasElement) => {
    const context = canvas.getContext("2d");
    expect.assert(context !== null);
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  };
  const comparisons: Array<{ embedFonts: unknown; differingBytes: number }> = [];
  const spy = vi.spyOn(snapdom, "toCanvas").mockImplementation(async (element, options) => {
    const embedded = await capture(element, options);
    const fallback = await capture(element, { ...options, embedFonts: false });
    const [withFont, withoutFont] = [pixels(embedded), pixels(fallback)];
    comparisons.push({
      embedFonts: options?.embedFonts,
      differingBytes: withFont.reduce(
        (count, byte, index) => (byte === withoutFont[index] ? count : count + 1),
        0,
      ),
    });
    return embedded;
  });
  const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    await exportButton.click();

    await vi.waitFor(
      () => {
        expect(download).toHaveBeenCalledOnce();
      },
      { timeout: 60000, interval: 200 },
    );
    expect(comparisons).toHaveLength(1);
    const [comparison] = comparisons;
    expect.assert(comparison !== undefined);
    expect(comparison.embedFonts).toBe(true);
    expect(comparison.differingBytes).toBeGreaterThan(1000);
  } finally {
    spy.mockRestore();
    download.mockRestore();
  }
}, 90000);

test("restores the export action and reports an image generation failure", async ({
  renderApp,
}) => {
  await page.viewport(1280, 800);
  const screen = await renderApp();
  const exportButton = screen.getByRole("button", { name: "PNGをZIPで出力" }).first();
  await expect.element(exportButton).toBeEnabled();
  const { snapdom } = await import("@zumer/snapdom");
  let rejectCapture: ((reason: Error) => void) | undefined;
  const capture = vi.spyOn(snapdom, "toCanvas").mockImplementation(
    () =>
      new Promise<HTMLCanvasElement>((_, reject) => {
        rejectCapture = reject;
      }),
  );
  try {
    await exportButton.click();
    await expect.element(exportButton).toBeDisabled();
    await waitFor(() => {
      expect(rejectCapture).toBeDefined();
    });
    expect.assert(rejectCapture !== undefined);
    rejectCapture(new Error("画像の生成に失敗しました"));
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("PNG の出力に失敗しました: 画像の生成に失敗しました");
    await expect.element(exportButton).toBeEnabled();
    expect(screen.container.querySelector(".export-pages")).toBeNull();
  } finally {
    capture.mockRestore();
  }
});

test("does not download an export after the app unmounts", async ({ renderApp }) => {
  await page.viewport(1280, 800);
  const screen = await renderApp();
  const exportButton = screen.getByRole("button", { name: "PNGをZIPで出力" }).first();
  await expect.element(exportButton).toBeEnabled();
  const { snapdom } = await import("@zumer/snapdom");
  let resolveCapture: ((canvas: HTMLCanvasElement) => void) | undefined;
  const capture = vi.spyOn(snapdom, "toCanvas").mockImplementation(
    () =>
      new Promise<HTMLCanvasElement>((resolve) => {
        resolveCapture = resolve;
      }),
  );
  const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    await exportButton.click();
    await waitFor(() => {
      expect(resolveCapture).toBeDefined();
    });
    await screen.unmount();
    expect.assert(resolveCapture !== undefined);
    resolveCapture(document.createElement("canvas"));
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(download).not.toHaveBeenCalled();
    expect(document.querySelector(".export-pages")).toBeNull();
  } finally {
    capture.mockRestore();
    download.mockRestore();
  }
});

test("rejects an export when the browser returns a smaller canvas", async ({ renderApp }) => {
  await page.viewport(1280, 800);
  const screen = await renderApp();
  const button = screen.getByRole("button", { name: "PNGをZIPで出力" }).first();
  await expect.element(button).toBeEnabled();
  const { snapdom } = await import("@zumer/snapdom");
  const capture = vi.spyOn(snapdom, "toCanvas").mockResolvedValue(document.createElement("canvas"));
  const download = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    await button.click();
    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent(
        "PNG の出力に失敗しました: このブラウザでは必要な解像度の画像を生成できませんでした",
      );
    await expect.element(button).toBeEnabled();
    expect(download).not.toHaveBeenCalled();
  } finally {
    capture.mockRestore();
    download.mockRestore();
  }
});
