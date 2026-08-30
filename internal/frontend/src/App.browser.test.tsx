import { expect, test as base, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { App } from "./App";

import "@sushichan044/kg-viewer/styles.css";
import "./styles/index.css";

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
  browserEnvironment: undefined;
};

const test = base.extend<Fixtures>({
  novelSource: async ({}, use) => {
    await use({ current: source });
  },
  browserEnvironment: [
    async ({ novelSource }, use) => {
      window.history.replaceState(null, "", "/");
      localStorage.clear();
      sessionStorage.clear();
      FakeEventSource.latest = undefined;
      vi.stubGlobal("EventSource", FakeEventSource);
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
          const url = input instanceof Request ? input.url : input.toString();
          if (url.endsWith("/_/api/files")) {
            return new Response(JSON.stringify(files), {
              headers: { "content-type": "application/json" },
            });
          }

          return new Response(url.includes("/shared/") ? "共有本文" : novelSource.current);
        }),
      );

      await use(undefined);

      vi.unstubAllGlobals();
    },
    { auto: true },
  ],
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

  await vi.waitFor(() => {
    expect(screen.container.querySelectorAll(".kgv-cell[data-diagnostic-active]")).toHaveLength(4);
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

  await vi.waitFor(() => {
    const label = screen.container.querySelector(".mobile-toolbar strong");
    expect.assert(label !== null, "mobile toolbar label did not render");
    expect(label.textContent).toBe("testdata/novel.txt");
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

  await vi.waitFor(() => {
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

  await vi.waitFor(() => {
    const label = screen.container.querySelector(".toolbar-label");
    expect.assert(label !== null, "toolbar label did not render");
    expect(label.textContent).toBe("共有 原稿.txt");
  });

  const fileListItem = screen.container.querySelector<HTMLButtonElement>(
    ".sidebar .file-list__item",
  );
  expect.assert(fileListItem !== null, "sidebar has no file list item");

  fileListItem.click();

  await vi.waitFor(() => {
    expect(new URL(window.location.href).searchParams.get("file")).toBe("testdata/novel.txt");
  });
  expect(new URL(window.location.href).searchParams.get("mode")).toBe("preview");
  expect(window.location.hash).toBe("#preview");
});

test("normalizes an unknown URL file to the first available file", async () => {
  window.history.replaceState(null, "", "/?file=missing.txt");

  const screen = await render(<App />);

  await vi.waitFor(() => {
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

      return new Response("共有本文");
    }),
  );

  const screen = await render(<App />);

  await vi.waitFor(() => {
    expect(FakeEventSource.latest).toBeDefined();
  });
  expect.assert(FakeEventSource.latest !== undefined, "event source did not initialize");

  FakeEventSource.latest.emit("update", "{}");

  await vi.waitFor(() => {
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

      return Promise.resolve(new Response("共有本文"));
    }),
  );

  const screen = await render(<App />);

  await vi.waitFor(() => {
    expect(FakeEventSource.latest).toBeDefined();
  });
  expect.assert(FakeEventSource.latest !== undefined, "event source did not initialize");

  FakeEventSource.latest.emit("update", "{}");

  await vi.waitFor(() => {
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

  await vi.waitFor(() => {
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

  await vi.waitFor(() => {
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

  await vi.waitFor(() => {
    expect(screen.container.querySelectorAll(".kgv-rule-cell").length).toBeGreaterThan(0);
  });
  const toggle = screen.container.querySelector<HTMLInputElement>("#desktop-show-grid");
  expect.assert(toggle !== null, "grid visibility setting did not render");
  toggle.click();

  await vi.waitFor(() => {
    expect(screen.container.querySelectorAll(".kgv-rule-cell")).toHaveLength(0);
  });
  expect(JSON.parse(localStorage.getItem("kg.manuscript.preferences.v6") ?? "null")).toMatchObject({
    version: 6,
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

  await vi.waitFor(() => {
    expect(screen.container.querySelectorAll("[data-annotation]")).toHaveLength(0);
  });

  const kakuyomu = screen.container.querySelector<HTMLInputElement>("#desktop-notation-kakuyomu");
  expect.assert(kakuyomu !== null, "Kakuyomu notation choice did not render");
  kakuyomu.click();

  await vi.waitFor(() => {
    expect(screen.container.querySelectorAll('[data-annotation="ruby"]')).toHaveLength(1);
  });
  expect(JSON.parse(localStorage.getItem("kg.manuscript.preferences.v6") ?? "null")).toMatchObject({
    version: 6,
    notation: "kakuyomu",
  });
});
