import {
  DEFAULT_COMPOSITION_SETTINGS,
  composeManuscript,
  manuscriptGridComposer,
  parseManuscript,
} from "@sushichan044/kg-core";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { IframeIsolation } from "./IframeIsolation";
import { ManuscriptViewer } from "./ManuscriptViewer";

import "./styles.css";

function composed(source: string) {
  const parsed = parseManuscript(source);
  if (!parsed.ok) throw new Error("fixture did not parse");
  const result = composeManuscript(parsed.value, {
    composer: manuscriptGridComposer,
    settings: DEFAULT_COMPOSITION_SETTINGS,
  });
  if (!result.ok) throw new Error("fixture did not compose");
  return result.value;
}

test("renders children inside the iframe", async () => {
  const screen = await render(
    <IframeIsolation>
      <p>hello</p>
    </IframeIsolation>,
  );

  await expect
    .poll(() => {
      const iframe = screen.container.querySelector<HTMLIFrameElement>("iframe");
      return iframe?.contentDocument?.getElementById("root")?.textContent;
    })
    .toContain("hello");
});

test("applies viewer CSS inside the iframe", async () => {
  const screen = await render(
    <IframeIsolation>
      <ManuscriptViewer composed={composed("あ")} />
    </IframeIsolation>,
  );

  await expect
    .poll(() => {
      const iframe = screen.container.querySelector<HTMLIFrameElement>("iframe");
      return iframe?.contentDocument?.querySelector(".kgv-cell");
    })
    .toBeTruthy();

  const iframe = screen.container.querySelector<HTMLIFrameElement>("iframe")!;
  const cell = iframe.contentDocument!.querySelector<HTMLElement>(".kgv-cell")!;
  const style = iframe.contentWindow!.getComputedStyle(cell);
  expect(style.borderBlockStartWidth).not.toBe("0px");
});

test("preserves controlled props through the portal", async () => {
  const screen = await render(
    <IframeIsolation>
      <ManuscriptViewer composed={composed("段落")} />
    </IframeIsolation>,
  );

  await expect
    .poll(() => {
      const iframe = screen.container.querySelector<HTMLIFrameElement>("iframe");
      return iframe?.contentDocument?.querySelector(".kgv-page")?.textContent;
    })
    .toContain("段落");
});

test("forwards styleOverrides into the iframe", async () => {
  const screen = await render(
    <IframeIsolation styleOverrides=".kgv-viewer { --kgv-padding: 0.5rem; }">
      <ManuscriptViewer composed={composed("あ")} />
    </IframeIsolation>,
  );

  await expect
    .poll(() => {
      const iframe = screen.container.querySelector<HTMLIFrameElement>("iframe");
      const viewer = iframe?.contentDocument?.querySelector<HTMLElement>(".kgv-viewer");
      if (viewer === null || viewer === undefined) return null;
      const style = iframe!.contentWindow!.getComputedStyle(viewer);
      return style.getPropertyValue("--kgv-padding").trim();
    })
    .toBe("0.5rem");
});

test("exposes imperatives handles through the portal", async () => {
  let viewHandle: { getVisiblePage: () => number } | null = null;

  await render(
    <IframeIsolation>
      <ManuscriptViewer
        composed={composed("あ".repeat(10))}
        ref={(handle) => {
          viewHandle = handle;
        }}
      />
    </IframeIsolation>,
  );

  await expect.poll(() => viewHandle?.getVisiblePage()).toBe(0);
});
