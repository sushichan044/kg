import { DEFAULT_APPEARANCE, createManuscript } from "@sushichan044/kg-core";
import type {
  GridSettings,
  ManuscriptOffsets,
  ManuscriptStateOptions,
} from "@sushichan044/kg-core";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { ManuscriptViewer } from "./ManuscriptViewer";
import type { ManuscriptViewerProps } from "./ManuscriptViewer";
import { ManuscriptProvider } from "./Provider";

import "./styles.css";

const settings: GridSettings = {
  charsPerLine: 10,
  linesPerStage: 10,
  stagesPerPage: 1,
};

async function renderViewer(options: ManuscriptStateOptions, props: ManuscriptViewerProps = {}) {
  const manuscript = createManuscript(options);
  const screen = await render(
    <ManuscriptProvider controller={manuscript}>
      <ManuscriptViewer {...props} />
    </ManuscriptProvider>,
  );

  return { manuscript, screen };
}

test("renders the first grapheme in the top-right cell with square geometry", async () => {
  const { screen } = await renderViewer({ text: "あいうえ", settings });

  const cells = Array.from(screen.container.querySelectorAll<HTMLElement>(".kgv-cell"));
  const occupied = cells.filter((cell) => cell.textContent !== "");
  expect(occupied[0]?.textContent).toBe("あ");
  expect(occupied[1]?.textContent).toBe("い");
  const firstRect = cells[0]?.getBoundingClientRect();
  expect(firstRect?.width).toBeCloseTo(firstRect?.height ?? 0, 0);
  expect(cells[10]?.getBoundingClientRect().left).toBeLessThan(
    cells[0]?.getBoundingClientRect().left ?? 0,
  );
});

test("marks diagnostics and selects them without changing the manuscript", async () => {
  const text = "「誤り。。。 」";
  let selected = "";
  const { manuscript, screen } = await renderViewer(
    { text, settings },
    {
      onDiagnosticSelect: (diagnostic) => {
        selected = diagnostic.id;
      },
    },
  );

  expect(screen.container.querySelectorAll("[data-diagnostic]")).not.toHaveLength(0);
  await screen.getByRole("button").first().click();
  expect(selected).toBe(manuscript.state.diagnostics[0]?.id);
  expect(screen.container.textContent).toContain(text);
});

test("renders a cell whose size in pixels matches the specified point size at 100% zoom", async () => {
  const { screen } = await renderViewer({
    text: "あ",
    settings,
    appearance: { ...DEFAULT_APPEARANCE, fontSizePt: 10 },
  });

  const cell = screen.container.querySelector<HTMLElement>(".kgv-cell");
  // 10pt = 10 * (96 / 72) CSS px ≈ 13.33px.
  expect(cell?.getBoundingClientRect().width).toBeCloseTo((10 * 96) / 72, 0);
});

test("renders offset-reserved leading cells as empty", async () => {
  const offsets: ManuscriptOffsets = {
    document: { leading: 1, trailing: 0 },
    page: { leading: 0, trailing: 0 },
    stage: { leading: 0, trailing: 0 },
  };

  const { screen } = await renderViewer({ text: "あいうえ", settings, offsets });

  const lines = Array.from(screen.container.querySelectorAll<HTMLElement>(".kgv-line"));
  const firstLineCells = Array.from(lines[0]?.querySelectorAll<HTMLElement>(".kgv-cell") ?? []);
  expect(firstLineCells.every((cell) => cell.textContent === "")).toBe(true);

  const secondLineCells = Array.from(lines[1]?.querySelectorAll<HTMLElement>(".kgv-cell") ?? []);
  expect(secondLineCells.slice(0, 3).map((cell) => cell.textContent)).toEqual(["あ", "い", "う"]);
});
