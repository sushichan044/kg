import { ENCODED_VERTICAL_ORIENTATION } from "./vertical-orientation-data";

/**
 * Unicode の Vertical_Orientation（UAX #50）の値
 */
export type VerticalOrientation = "U" | "R" | "Tu" | "Tr";

type Table = Readonly<{ starts: readonly number[]; values: readonly VerticalOrientation[] }>;

function valueOf(code: string): VerticalOrientation {
  switch (code) {
    case "U":
    case "R": {
      return code;
    }
    case "u": {
      return "Tu";
    }
    case "r": {
      return "Tr";
    }
    default: {
      throw new Error(`Malformed Vertical_Orientation table: ${code}`);
    }
  }
}

function decode(encoded: string): Table {
  const starts: number[] = [];
  const values: VerticalOrientation[] = [];
  let start = 0;
  for (const [, delta = "", code = ""] of encoded.matchAll(/([0-9a-f]+)([URur])/gu)) {
    start += Number.parseInt(delta, 16);
    starts.push(start);
    values.push(valueOf(code));
  }
  return { starts, values };
}

// 使わない利用者に展開の手間をかけないよう、最初の参照で展開する
let table: Table | undefined;

export function verticalOrientationOf(codePoint: number): VerticalOrientation {
  table ??= decode(ENCODED_VERTICAL_ORIENTATION);
  const { starts, values } = table;
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >>> 1;
    if ((starts[middle] ?? Number.POSITIVE_INFINITY) <= codePoint) low = middle;
    else high = middle - 1;
  }
  const value = values[low];
  if (value === undefined) throw new Error("Empty Vertical_Orientation table");
  return value;
}
