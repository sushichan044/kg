import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
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

class FakeEventSource {
  addEventListener() {}

  close() {}
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal("EventSource", FakeEventSource);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.endsWith("/_/api/files")) {
        return new Response(JSON.stringify([{ id: "novel", path: "testdata/novel.txt" }]), {
          headers: { "content-type": "application/json" },
        });
      }

      return new Response(source);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("connects proofreading feedback to the drawer and manuscript cells", async () => {
  await page.viewport(1280, 800);
  const screen = await render(<App />);

  const diagnosticsTrigger = screen.getByRole("button", { name: "校正エラー 4件" });
  await expect.element(diagnosticsTrigger).toBeVisible();
  await diagnosticsTrigger.click();

  const drawer = screen.getByRole("complementary", { name: "校正エラー" });
  await expect.element(drawer).toBeVisible();

  await drawer.getByRole("list").getByRole("button").nth(3).click();
  await vi.waitFor(() => {
    const iframe = screen.container.querySelector<HTMLIFrameElement>("iframe");
    expect(iframe?.contentDocument?.querySelectorAll("[data-diagnostic-active]")).toHaveLength(4);
  });
});

// The mobile toolbar only becomes visible below the 52rem (832px) breakpoint;
// a narrower viewport is required so the click lands on a real, on-screen control.
test("opens compact file, settings, and diagnostics sheets", async () => {
  await page.viewport(600, 900);
  const screen = await render(<App />);

  await vi.waitFor(() => {
    expect(screen.container.querySelector(".mobile-toolbar strong")?.textContent).toBe(
      "testdata/novel.txt",
    );
  });

  const buttons = Array.from(
    screen.container.querySelectorAll<HTMLButtonElement>(".mobile-toolbar button"),
  );
  expect(buttons.map((button) => button.textContent.trim())).toEqual([
    "ファイル",
    "校正 4",
    "設定",
  ]);

  await screen.getByRole("button", { name: "設定" }).click();
  const settingsDialog = screen.getByRole("dialog", { name: "表示設定" });
  await expect.element(settingsDialog).toBeVisible();
  await settingsDialog.getByRole("button", { name: "表示設定を閉じる" }).click();

  await screen.getByRole("button", { name: "校正エラー 4件" }).click();
  const diagnosticsDialog = screen.getByRole("dialog", { name: "校正エラー" });
  await expect.element(diagnosticsDialog).toBeVisible();
});
