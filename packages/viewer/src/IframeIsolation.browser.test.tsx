import { createManuscript } from "@sushichan044/kg-core";
import type { GridSettings } from "@sushichan044/kg-core";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { IframeIsolation } from "./IframeIsolation";
import { ManuscriptViewer } from "./ManuscriptViewer";
import { ManuscriptProvider } from "./Provider";

import "./styles.css";

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
  const manuscript = createManuscript({ text: "あ" });

  const screen = await render(
    <ManuscriptProvider controller={manuscript}>
      <IframeIsolation>
        <ManuscriptViewer />
      </IframeIsolation>
    </ManuscriptProvider>,
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

test("preserves provider context through the portal", async () => {
  const manuscript = createManuscript({ text: "段落" });

  const screen = await render(
    <ManuscriptProvider controller={manuscript}>
      <IframeIsolation>
        <ManuscriptViewer />
      </IframeIsolation>
    </ManuscriptProvider>,
  );

  await expect
    .poll(() => {
      const iframe = screen.container.querySelector<HTMLIFrameElement>("iframe");
      return iframe?.contentDocument?.querySelector(".kgv-page")?.textContent;
    })
    .toContain("段落");
});

test("forwards styleOverrides into the iframe", async () => {
  const manuscript = createManuscript({ text: "あ" });

  const screen = await render(
    <ManuscriptProvider controller={manuscript}>
      <IframeIsolation styleOverrides=".kgv-viewer { --kgv-padding: 0.5rem; }">
        <ManuscriptViewer />
      </IframeIsolation>
    </ManuscriptProvider>,
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
  const settings: GridSettings = { charsPerLine: 10, linesPerStage: 10, stagesPerPage: 2 };
  const manuscript = createManuscript({ text: "あ".repeat(10), settings });
  let viewHandle: { getVisiblePage: () => number } | null = null;

  await render(
    <ManuscriptProvider controller={manuscript}>
      <IframeIsolation>
        <ManuscriptViewer
          ref={(handle) => {
            viewHandle = handle;
          }}
        />
      </IframeIsolation>
    </ManuscriptProvider>,
  );

  await expect.poll(() => viewHandle?.getVisiblePage()).toBe(0);
});
