import { expect, test } from "vite-plus/test";

import { questionOrExclamationSpacings } from "./question-or-exclamation-spacing";

function present<T>(value: T | undefined): T {
  expect.assert(value !== undefined, "expected a value");

  return value;
}

test.each(["♡", "♪", "☆", "！♡♪"])("checks spacing after %s", (mark) => {
  expect(present(questionOrExclamationSpacings(`${mark}続き`)[0]).kind).toBe("missing");
  expect(present(questionOrExclamationSpacings(`${mark}　続き`)[0]).kind).toBe("valid");
  expect(present(questionOrExclamationSpacings(`${mark} 続き`)[0]).kind).toBe("invalid-space");
  expect(questionOrExclamationSpacings(`${mark}」`)).toEqual([]);
  expect(questionOrExclamationSpacings(mark)).toEqual([]);
});
test("adds custom marks without removing defaults", () => {
  expect(present(questionOrExclamationSpacings("★続き", "★")[0]).kind).toBe("missing");
  expect(present(questionOrExclamationSpacings("♡続き", "★")[0]).kind).toBe("missing");
});

test.each(["❤️", "❤︎", "❤️♡"])("checks complete grapheme ranges after %s", (mark) => {
  expect(questionOrExclamationSpacings(`${mark}　次`, "❤")).toEqual([
    {
      kind: "valid",
      marks: { start: 0, end: mark.length },
      gap: { start: mark.length, end: mark.length + 1 },
    },
  ]);
  expect(questionOrExclamationSpacings(`${mark}次`, "❤")[0]).toEqual({
    kind: "missing",
    marks: { start: 0, end: mark.length },
  });
  expect(questionOrExclamationSpacings(`${mark}」`, "❤")).toEqual([]);
});
