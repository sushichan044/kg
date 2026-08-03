import {
  ManuscriptCompositionSettings,
  composeManuscript,
  manuscriptGridComposer,
  parseManuscript,
} from "@sushichan044/kg-core";
import type { ReactElement } from "react";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { IframeIsolation } from "./IframeIsolation";
import { ManuscriptViewer } from "./ManuscriptViewer";
import { themeStyles } from "./styleSheets";

function composed(source: string) {
  const parsed = parseManuscript(source);
  if (!parsed.ok) throw new Error("fixture did not parse");
  const result = composeManuscript(parsed.value, {
    composer: manuscriptGridComposer,
    settings: ManuscriptCompositionSettings.defaults,
  });
  if (!result.ok) throw new Error("fixture did not compose");
  return result.value;
}

async function isolated(node: ReactElement) {
  const screen = await render(node);
  await expect
    .poll(() => {
      const iframe = screen.container.querySelector<HTMLIFrameElement>("iframe");
      return iframe?.contentDocument?.querySelector(".kgv-cell");
    })
    .toBeTruthy();

  const iframe = screen.container.querySelector<HTMLIFrameElement>("iframe")!;
  const document = iframe.contentDocument!;
  const view = iframe.contentWindow!;
  return {
    cellStyle: view.getComputedStyle(document.querySelector<HTMLElement>(".kgv-cell")!),
    glyphStyle: view.getComputedStyle(document.querySelector<HTMLElement>(".kgv-glyph")!),
  };
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

test("injects the structural stylesheet but not the theme by default", async () => {
  const { cellStyle, glyphStyle } = await isolated(
    <IframeIsolation>
      <ManuscriptViewer composed={composed("あ")} />
    </IframeIsolation>,
  );

  expect(glyphStyle.writingMode).toBe("vertical-rl");
  expect(cellStyle.borderBlockStartWidth).toBe("0px");
});

test("applies the theme when it is injected alongside the structural stylesheet", async () => {
  const { cellStyle, glyphStyle } = await isolated(
    <IframeIsolation styles={{ kind: "structural", css: themeStyles }}>
      <ManuscriptViewer composed={composed("あ")} />
    </IframeIsolation>,
  );

  expect(glyphStyle.writingMode).toBe("vertical-rl");
  expect(cellStyle.borderBlockStartWidth).not.toBe("0px");
});

test("leaves out the structural stylesheet for a custom injection", async () => {
  const { glyphStyle } = await isolated(
    <IframeIsolation styles={{ kind: "custom", css: [] }}>
      <ManuscriptViewer composed={composed("あ")} />
    </IframeIsolation>,
  );

  expect(glyphStyle.writingMode).toBe("horizontal-tb");
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

test("forwards consumer CSS into the iframe", async () => {
  const screen = await render(
    <IframeIsolation styles={{ kind: "structural", css: ".kgv-viewer { --kgv-padding: 0.5rem; }" }}>
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
