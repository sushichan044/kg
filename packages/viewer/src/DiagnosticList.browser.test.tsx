import {
  createDefaultProofreadingRules,
  parseManuscript,
  proofreadManuscript,
} from "@sushichan044/kg-core";
import { expect, test } from "vite-plus/test";
import { render } from "vitest-browser-react";

import { DiagnosticList } from "./DiagnosticList";

function diagnostics() {
  const parsed = parseManuscript("問題");
  if (!parsed.ok) throw new Error("fixture setup failed");
  const result = proofreadManuscript(parsed.value, { rules: createDefaultProofreadingRules() });
  if (!result.ok) throw new Error("fixture did not proofread");
  return result.value;
}

test("renders controlled diagnostics and reports selection", async () => {
  const items = diagnostics();
  let selected = "";
  const screen = await render(
    <DiagnosticList
      diagnostics={items}
      activeDiagnosticId={items[0]?.id}
      onSelect={(item) => {
        selected = item.id;
      }}
    />,
  );

  const button = screen.getByRole("list").getByRole("button").first();
  await expect.element(button).toHaveAttribute("aria-current", "true");
  await button.click();
  expect(selected).toBe(items[0]?.id);
});
