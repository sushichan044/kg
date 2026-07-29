import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";

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

let host: HTMLDivElement;
let root: Root;

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
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  root.unmount();
  host.remove();
  vi.unstubAllGlobals();
});

test("connects proofreading feedback to the drawer and manuscript cells", async () => {
  flushSync(() => {
    root.render(<App />);
  });

  await vi.waitFor(() => {
    expect(host.querySelector('[aria-label="校正エラー 4件"]')).not.toBeNull();
  });

  const desktopTrigger = host.querySelector<HTMLButtonElement>(
    ".desktop-viewer-toolbar .kgv-diagnostics-trigger",
  );
  desktopTrigger?.click();
  await vi.waitFor(() => {
    expect(host.querySelector(".diagnostic-drawer")).not.toBeNull();
  });

  const diagnostics = host.querySelectorAll<HTMLButtonElement>(
    ".diagnostic-drawer .kgv-diagnostics button",
  );
  diagnostics[3]?.click();
  await vi.waitFor(() => {
    expect(host.querySelectorAll("[data-diagnostic-active]")).toHaveLength(4);
  });
});

test("opens compact file, settings, and diagnostics sheets", async () => {
  flushSync(() => {
    root.render(<App />);
  });

  await vi.waitFor(() => {
    expect(host.querySelector(".mobile-toolbar strong")?.textContent).toBe("testdata/novel.txt");
  });

  const buttons = Array.from(host.querySelectorAll<HTMLButtonElement>(".mobile-toolbar button"));
  expect(buttons.map((button) => button.textContent.trim())).toEqual([
    "ファイル",
    "校正 4",
    "設定",
  ]);

  buttons[2]?.click();
  await vi.waitFor(() => {
    expect(document.querySelector<HTMLDialogElement>('dialog[aria-label="表示設定"]')?.open).toBe(
      true,
    );
  });
  const settings = document.querySelector<HTMLDialogElement>('dialog[aria-label="表示設定"]');
  settings?.close();

  buttons[1]?.click();
  await vi.waitFor(() => {
    expect(document.querySelector<HTMLDialogElement>('dialog[aria-label="校正エラー"]')?.open).toBe(
      true,
    );
  });
});
