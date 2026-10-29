import { expect, test } from "vite-plus/test";

import { questionOrExclamationSpacings } from "./question-or-exclamation-spacing";

test.each(["♡", "♪", "☆", "！♡♪"])("checks spacing after %s", (mark) => {
  expect(questionOrExclamationSpacings(`${mark}続き`)[0]?.kind).toBe("missing");
  expect(questionOrExclamationSpacings(`${mark}　続き`)[0]?.kind).toBe("valid");
  expect(questionOrExclamationSpacings(`${mark} 続き`)[0]?.kind).toBe("invalid-space");
  expect(questionOrExclamationSpacings(`${mark}」`)).toEqual([]);
  expect(questionOrExclamationSpacings(mark)).toEqual([]);
});
test("adds custom marks without removing defaults", () => {
  expect(questionOrExclamationSpacings("★続き", "★")[0]?.kind).toBe("missing");
  expect(questionOrExclamationSpacings("♡続き", "★")[0]?.kind).toBe("missing");
});
