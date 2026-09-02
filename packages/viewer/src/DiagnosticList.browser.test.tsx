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
  const button = screen.getByRole("list").getByRole("button").first();
  await expect.element(button).toHaveAttribute("aria-current", "true");

  await button.click();

  expect(selected).toBe(firstItem.id);
});
