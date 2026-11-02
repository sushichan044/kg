import { StrictMode } from "react";
import { expect, test as base, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { App } from "./App";

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

type Fixtures = {
  novelSource: { current: string };
  fontRequest: { failure: boolean; gate: Promise<void> | null };
  browserEnvironment: undefined;
};

const test = base.extend<Fixtures>({
  novelSource: async ({}, use) => {
    await use({ current: source });
  },
  fontRequest: async ({}, use) => {
    await use({ failure: false, gate: null });
  },
  browserEnvironment: [
    async ({ novelSource, fontRequest }, use) => {
      window.history.replaceState(null, "", "/");
      localStorage.clear();
      sessionStorage.clear();
      FakeEventSource.latest = undefined;
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
            return new Response(JSON.stringify(files), {
              headers: { "content-type": "application/json" },
            });
          }

          if (url.includes("/_/api/files/"))
            return new Response(url.includes("/shared/") ? "共有本文" : novelSource.current);
          return originalFetch(input);
        }),
      );

      await use(undefined);

      vi.unstubAllGlobals();
    },
    { auto: true },
  ],
});

test("renders composer-owned combined units without duplicating the accessible manuscript", async ({
  novelSource,
}) => {
  novelSource.current = "あ12い";

  const screen = await render(<App />);

  await waitFor(() => {
    const cells = Array.from(screen.container.querySelectorAll(".kgv-cell"));
    expect(cells.map((cell) => cell.textContent)).toEqual(["あ", "12", "い"]);
    const text = screen.container.querySelector(".kgv-visually-hidden");
    expect.assert(text !== null);
    expect(text.textContent.trim()).toBe("あ12い");
  });
});

test("connects proofreading feedback to the drawer and manuscript cells", async () => {
  await page.viewport(1280, 800);
  const screen = await render(<App />);

  const diagnosticsTrigger = screen.getByRole("button", { name: "診断 4件" });
  await expect.element(diagnosticsTrigger).toBeVisible();

  await diagnosticsTrigger.click();

  const drawer = screen.getByRole("complementary", { name: "診断" });
  await expect.element(drawer).toBeVisible();

  await drawer.getByRole("list").getByRole("button").nth(3).click();

  await waitFor(() => {
    const active = screen.container.querySelectorAll(".kgv-cell[data-diagnostic-active]");
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toBe("2026");
    expect(
      screen.container.querySelectorAll(".kgv-diagnostic-band[data-diagnostic-active]"),
    ).toHaveLength(1);
  });
  expect(screen.container.querySelector("iframe")).toBeNull();
});

// The mobile toolbar only becomes visible below the 52rem (832px) breakpoint;
// a narrower viewport is required so the click lands on a real, on-screen control.
test("opens compact file, settings, and diagnostics sheets", async () => {
  await page.viewport(600, 900);
  const screen = await render(<App />);

  await waitFor(() => {
    const label = screen.container.querySelector(".mobile-toolbar strong");
    expect.assert(label !== null, "mobile toolbar label did not render");
    expect(label.textContent).toBe("testdata/novel.txt");
  });

  await waitFor(() => {
    expect(screen.container.querySelector(".mobile-toolbar")?.textContent).toContain("診断 4");
  });
  const buttons = Array.from(
    screen.container.querySelectorAll<HTMLButtonElement>(".mobile-toolbar button"),
  );
  expect(buttons.map((button) => button.textContent.trim())).toEqual([
    "ファイル",
    "診断 4",
    "設定",
  ]);

  await screen.getByRole("button", { name: "設定" }).click();
  const settingsDialog = screen.getByRole("dialog", { name: "表示設定" });
  await expect.element(settingsDialog).toBeVisible();
  await settingsDialog.getByRole("button", { name: "表示設定を閉じる" }).click();

  await screen.getByRole("button", { name: "診断 4件" }).click();
  const diagnosticsDialog = screen.getByRole("dialog", { name: "診断" });
  await expect.element(diagnosticsDialog).toBeVisible();
});

test("opens the file selected by the URL and preserves unrelated URL state", async () => {
  window.history.replaceState(
    null,
    "",
    "/?mode=preview&file=%E5%85%B1%E6%9C%89+%E5%8E%9F%E7%A8%BF.txt#preview",
  );

  const screen = await render(<App />);

  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("共有 原稿.txt");
  });
  expect(new URL(window.location.href).searchParams.get("file")).toBe("共有 原稿.txt");
  expect(new URL(window.location.href).searchParams.get("mode")).toBe("preview");
  expect(window.location.hash).toBe("#preview");
});

test("updates the shared URL when another file is selected", async () => {
  window.history.replaceState(
    null,
    "",
    "/?mode=preview&file=%E5%85%B1%E6%9C%89+%E5%8E%9F%E7%A8%BF.txt#preview",
  );
  const screen = await render(<App />);

  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("共有 原稿.txt");
  });

  const fileListItem = screen.container.querySelector<HTMLButtonElement>(
    ".sidebar .file-list__item",
  );
  expect.assert(fileListItem !== null, "sidebar has no file list item");

  fileListItem.click();

  await waitFor(() => {
    expect(new URL(window.location.href).searchParams.get("file")).toBe("testdata/novel.txt");
  });
  expect(new URL(window.location.href).searchParams.get("mode")).toBe("preview");
  expect(window.location.hash).toBe("#preview");
});

test("normalizes an unknown URL file to the first available file", async () => {
  window.history.replaceState(null, "", "/?file=missing.txt");

  const screen = await render(<App />);

  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("testdata/novel.txt");
    expect(new URL(window.location.href).searchParams.get("file")).toBe("testdata/novel.txt");
  });
});

test("synchronizes the URL after a failed initial catalog load is refreshed", async () => {
  let catalogRequests = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.endsWith("/_/api/files")) {
        catalogRequests += 1;
        if (catalogRequests === 1) throw new Error("catalog unavailable");
        return new Response(JSON.stringify([files[1]]), {
          headers: { "content-type": "application/json" },
        });
      }

      if (!url.includes("/_/api/")) return nativeFetch(input);
      return new Response("共有本文");
    }),
  );

  const screen = await render(<App />);

  await waitFor(() => {
    expect(FakeEventSource.latest).toBeDefined();
  });
  expect.assert(FakeEventSource.latest !== undefined, "event source did not initialize");

  FakeEventSource.latest.emit("update", "{}");

  await waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("共有 原稿.txt");
    expect(new URL(window.location.href).searchParams.get("file")).toBe("共有 原稿.txt");
  });
});

test("keeps the newest catalog when an older request finishes last", async () => {
  let catalogRequests = 0;
  let resolveInitialCatalog!: (response: Response) => void;
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

  const screen = await render(<App />);

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

test("renders pixiv notation after the initial load and a file reload", async ({ novelSource }) => {
  novelSource.current = pixivSource;

  const screen = await render(<App />);

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
}) => {
  novelSource.current = "あいう";
  await page.viewport(1280, 800);
  const screen = await render(<App />);

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
}) => {
  novelSource.current = kakuyomuSource;
  await page.viewport(1280, 800);
  const screen = await render(<App />);

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

test("shows fixed A5 dimensions and restores them after editing another paper format", async () => {
  await page.viewport(1280, 900);
  const screen = await render(<App />);
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
        topMm: 12,
        bottomMm: 16.55,
        innerMm: 21.825,
        outerMm: 13,
        stageGapMm: 10,
        lineGapMm: 1.825,
      },
    },
  });
});

test("lets a user correct an oversized format without saving invalid settings", async () => {
  await page.viewport(1280, 900);
  const screen = await render(<App />);
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

test("selects the fixed A6 composition from the paper control", async () => {
  await page.viewport(1280, 900);
  const screen = await render(<App />);
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
}) => {
  let release = () => {};
  fontRequest.gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const screen = await render(<App />);

  await expect.element(screen.getByRole("status")).toHaveTextContent("書体を読み込んでいます…");
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
}) => {
  fontRequest.failure = true;

  const screen = await render(<App />);

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

test("switches typography profiles without changing manuscript source", async ({ novelSource }) => {
  novelSource.current = "あ゛ん゛";
  const screen = await render(<App />);
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

test("keeps settings available after font loading fails and recovers with Gothic", async ({
  fontRequest,
}) => {
  fontRequest.failure = true;
  const screen = await render(<App />);
  await expect.element(screen.getByRole("alert")).toBeVisible();
  await expect.element(screen.getByRole("combobox", { name: "書体" })).toBeVisible();

  await screen.getByRole("combobox", { name: "書体" }).selectOptions("gothic");

  await waitFor(() => {
    expect(screen.container.querySelector(".kgv-viewer")).not.toBeNull();
  });
  expect(screen.container.querySelector('[role="alert"]')).toBeNull();
  expect(screen.container.querySelectorAll(".kgv-glyph").length).toBeGreaterThan(0);
});

function deferred<T>() {
  let resolve = (_value: T) => {};
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function manuscriptText(container: HTMLElement): string {
  return Array.from(container.querySelectorAll(".kgv-visually-hidden"), (node) => node.textContent)
    .join("")
    .replaceAll("\n", "");
}

test("keeps the current manuscript visible while refreshing and commits the newest response", async () => {
  const screen = await render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await expect.poll(() => manuscriptText(screen.container)).toContain("静かな机");
  const first = deferred<Response>();
  const latest = deferred<Response>();
  let calls = 0;
  const fetchBefore = window.fetch.bind(window);
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    if ((input instanceof Request ? input.url : input.toString()).endsWith("/novel/content")) {
      calls += 1;
      return calls === 1 ? first.promise : latest.promise;
    }
    return fetchBefore(input, init);
  });
  expect.assert(FakeEventSource.latest !== undefined);

  FakeEventSource.latest.emit("file-changed", JSON.stringify({ id: "novel" }));
  await expect.poll(() => calls).toBe(1);

  await expect.element(screen.getByLabelText("小説プレビュー", { exact: true })).toBeVisible();
  expect(manuscriptText(screen.container)).toContain("静かな机");
  expect(screen.container.querySelector(".preview__loading")).toBeNull();
  FakeEventSource.latest.emit("file-changed", JSON.stringify({ id: "novel" }));
  await expect.poll(() => calls).toBe(2);
  latest.resolve(new Response("最新の原稿"));
  await expect.poll(() => manuscriptText(screen.container)).toBe("最新の原稿");
  first.resolve(new Response("古い原稿"));
  await first.promise;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => {
      resolve();
    }),
  );

  expect(manuscriptText(screen.container)).toBe("最新の原稿");
});

test("shows loading for another file and never associates its path with the previous manuscript", async () => {
  const screen = await render(<App />);
  await expect.poll(() => manuscriptText(screen.container)).toContain("静かな机");
  const shared = deferred<Response>();
  const fetchBefore = window.fetch.bind(window);
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    (input instanceof Request ? input.url : input.toString()).endsWith("/shared/content")
      ? shared.promise
      : fetchBefore(input, init),
  );

  await screen.getByRole("button", { name: "共有 原稿.txt", exact: true }).click();

  await expect.element(screen.getByText("読み込み中…", { exact: true })).toBeVisible();
  expect(screen.container.querySelector(".kgv-viewer")).toBeNull();
  expect(new URL(window.location.href).searchParams.get("file")).toBe("共有 原稿.txt");
  shared.resolve(new Response("共有の新しい本文"));
  await expect.poll(() => manuscriptText(screen.container)).toBe("共有の新しい本文");
});

test("retries an initial content failure and retains the manuscript after a failed refresh", async () => {
  let failed = true;
  const fetchBefore = window.fetch.bind(window);
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) =>
    failed && (input instanceof Request ? input.url : input.toString()).endsWith("/novel/content")
      ? Promise.resolve(new Response(null, { status: 503 }))
      : fetchBefore(input, init),
  );
  const screen = await render(<App />);
  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent("本文の取得に失敗しました再試行");
  expect(screen.container.querySelector(".preview__loading")).toBeNull();

  failed = false;
  await screen.getByRole("button", { name: "再試行", exact: true }).click();
  await expect.poll(() => manuscriptText(screen.container)).toContain("静かな机");
  failed = true;
  expect.assert(FakeEventSource.latest !== undefined);
  FakeEventSource.latest.emit("file-changed", JSON.stringify({ id: "novel" }));

  await expect
    .element(screen.getByRole("alert"))
    .toHaveTextContent("本文の取得に失敗しました再試行");
  expect(manuscriptText(screen.container)).toContain("静かな机");
  failed = false;
  await screen.getByRole("button", { name: "再試行", exact: true }).click();
  await expect.poll(() => screen.container.querySelector('[role="alert"]')).toBeNull();
});

test("preserves settings drafts and focus while font and document loading complete", async ({
  fontRequest,
}) => {
  await page.viewport(1280, 900);
  const font = deferred<void>();
  fontRequest.gate = font.promise;
  const screen = await render(<App />);
  const field = screen.getByRole("textbox", { name: "プリセット名" });
  await field.fill("編集中の設定");

  font.resolve(undefined);

  await expect.poll(() => manuscriptText(screen.container)).toContain("静かな机");
  await expect.element(field).toHaveValue("編集中の設定");
  await expect.element(field).toHaveFocus();
});

test("restores each file's saved page without saving the previous file's page under its new path", async ({
  novelSource,
}) => {
  await page.viewport(1280, 900);
  novelSource.current = "　原稿を読む。".repeat(400);
  sessionStorage.setItem("kg.app.page.v1:testdata/novel.txt", "1");
  const screen = await render(<App />);
  await expect
    .poll(() => screen.container.querySelectorAll(".kgv-page").length, { timeout: 10000 })
    .toBeGreaterThan(1);
  const viewport = screen.container.querySelector<HTMLElement>(".kgv-viewport");
  const restoredPage = screen.container.querySelector<HTMLElement>('[data-page-index="1"]');
  expect.assert(viewport !== null && restoredPage !== null);

  await expect
    .poll(() =>
      Math.abs(restoredPage.getBoundingClientRect().top - viewport.getBoundingClientRect().top),
    )
    .toBeLessThan(2);
  await expect.poll(() => sessionStorage.getItem("kg.app.page.v1:testdata/novel.txt")).toBe("1");
  await screen.getByRole("button", { name: "共有 原稿.txt", exact: true }).click();
  await expect.poll(() => manuscriptText(screen.container)).toBe("共有本文");

  await expect.poll(() => sessionStorage.getItem("kg.app.page.v1:共有 原稿.txt")).toBe("0");
  expect(sessionStorage.getItem("kg.app.page.v1:testdata/novel.txt")).toBe("1");
});

test("disposes the previous file session while preserving settings drafts", async () => {
  await page.viewport(1280, 900);
  const screen = await render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  await expect.poll(() => manuscriptText(screen.container)).toContain("静かな机");
  const field = screen.getByRole("textbox", { name: "プリセット名" });
  await field.fill("保存前の設定");
  const pending = deferred<Response>();
  const originalFetch = window.fetch.bind(window);
  let requestSignal: AbortSignal | null | undefined;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    if ((input instanceof Request ? input.url : input.toString()).endsWith("/novel/content")) {
      requestSignal = init?.signal;
      return pending.promise;
    }
    return originalFetch(input, init);
  });
  expect.assert(FakeEventSource.latest !== undefined);

  FakeEventSource.latest.emit("file-changed", JSON.stringify({ id: "novel" }));
  await expect.poll(() => requestSignal !== undefined).toBe(true);
  await screen.getByRole("button", { name: "共有 原稿.txt", exact: true }).click();
  await expect.poll(() => manuscriptText(screen.container)).toBe("共有本文");
  expect.assert(requestSignal !== null && requestSignal !== undefined);
  expect(requestSignal.aborted).toBe(true);
  pending.resolve(new Response("破棄された原稿"));
  await pending.promise;
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => {
      resolve();
    }),
  );

  expect(manuscriptText(screen.container)).toBe("共有本文");
  await expect.element(field).toHaveValue("保存前の設定");
  await expect
    .poll(() => screen.container.querySelector(".mobile-summary")?.textContent)
    .toBe("4字・1ページ");
});
