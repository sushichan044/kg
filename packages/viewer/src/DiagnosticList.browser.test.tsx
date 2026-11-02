import { parseManuscript } from "@sushichan044/kg-core";
import { createDefaultProofreadingRules, proofreadManuscript } from "@sushichan044/kg-core/lint";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { DiagnosticList } from "./DiagnosticList";

function diagnostics() {
  const parsed = parseManuscript("問題");
  expect.assert(parsed.ok, "fixture setup failed");

  const result = proofreadManuscript(parsed.value, { rules: createDefaultProofreadingRules() });
  expect.assert(result.ok, "fixture did not proofread");

  return result.value;
}

test("renders controlled diagnostics and reports selection", async () => {
  const items = diagnostics();
  const firstItem = items[0];
  expect.assert(firstItem !== undefined, "fixture produced no diagnostics");
  let selected = "";

  const screen = await render(
    <DiagnosticList
      diagnostics={items}
      activeDiagnosticId={firstItem.id}
      onSelect={(item) => {
        selected = item.id;
      }}
    />,
  );
  const button = screen.getByRole("button", { name: /行.*列の本文へ移動/ }).first();
  await expect.element(button).toHaveAttribute("aria-current", "true");

  await button.click();

  expect(selected).toBe(firstItem.id);
});

test("renders diagnostic text outside the navigation button for native selection", async () => {
  const items = diagnostics();
  const first = items[0];
  expect.assert(first !== undefined);
  const screen = await render(<DiagnosticList diagnostics={items} />);
  const description = screen.container.querySelector(".kgv-diagnostic-description");
  expect.assert(description !== null);
  const selection = window.getSelection();
  expect.assert(selection !== null);
  const range = document.createRange();
  range.selectNodeContents(description);

  selection.removeAllRanges();
  selection.addRange(range);

  expect(selection.toString()).toBe(first.message);
  expect(description.closest("button")).toBeNull();
  selection.removeAllRanges();
});
