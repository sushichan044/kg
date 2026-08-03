import { createManuscript } from "@sushichan044/kg-core";
import { createRef } from "react";
import { expect, test } from "vite-plus/test";
import { page } from "vite-plus/test/browser";
import { render } from "vitest-browser-react";

import { DiagnosticList } from "./DiagnosticList";
import { ManuscriptViewer } from "./ManuscriptViewer";
import type { ManuscriptViewHandle } from "./ManuscriptViewer";
import { ManuscriptProvider } from "./Provider";
import { SettingsPanel } from "./SettingsPanel";
import { ViewerToolbar } from "./ViewerToolbar";

import "./styles.css";

// The toolbar hides its zoom controls below the 36rem `kgv-toolbar` container
// query breakpoint, so a wide-enough viewport keeps them real, clickable controls.
test("connects toolbar, viewport, and diagnostics through one controller", async () => {
  await page.viewport(1024, 768);
  const manuscript = createManuscript({ text: "段落" });

  const screen = await render(
    <ManuscriptProvider controller={manuscript}>
      <ViewerToolbar documentLabel="draft.txt" onDiagnosticsOpen={() => {}} />
      <ManuscriptViewer />
      <DiagnosticList />
    </ManuscriptProvider>,
  );

  expect(screen.container.querySelector(".kgv-toolbar-summary")?.textContent).toContain("27字");

  await screen.getByRole("button", { name: "拡大" }).click();
  expect(manuscript.state.zoom).toEqual({ mode: "fixed", percent: 125 });

  await screen.getByRole("list").getByRole("button").first().click();
  expect(manuscript.state.activeDiagnosticId).toBe(manuscript.state.diagnostics[0]?.id);

  manuscript.dispatch({ type: "document.replace", text: "　更新" });
  await expect
    .poll(() => screen.container.querySelector(".kgv-page")?.textContent)
    .toContain("更新");
});

test("exposes DOM-only navigation through the view handle", async () => {
  const manuscript = createManuscript({ text: "あ".repeat(1_000) });
  const viewRef = createRef<ManuscriptViewHandle>();

  await render(
    <ManuscriptProvider controller={manuscript}>
      <ManuscriptViewer ref={viewRef} />
    </ManuscriptProvider>,
  );

  viewRef.current?.scrollToPage(999);
  expect(viewRef.current?.getVisiblePage()).toBeLessThan(manuscript.state.pagination.pages.length);
  expect(viewRef.current?.getEffectiveZoomPercent()).toBe(100);
});

test("offers book paper sizes in settings and applies the selection", async () => {
  const manuscript = createManuscript();
  const screen = await render(
    <ManuscriptProvider controller={manuscript}>
      <SettingsPanel />
    </ManuscriptProvider>,
  );

  const paperSize = screen.getByLabelText("用紙");
  await expect.element(paperSize.getByRole("option", { name: "A6（文庫）" })).toBeInTheDocument();
  await paperSize.selectOptions("shinsho");

  expect(manuscript.state.appearance.paperSize).toBe("shinsho");
});
