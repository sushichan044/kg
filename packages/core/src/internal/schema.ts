import * as v from "valibot";

/**
 * Every DTO in this package is a closed, frozen object: unknown keys are rejected, output is
 * readonly.
 */
export const readonlyObject = <const TEntries extends v.ObjectEntries>(entries: TEntries) =>
  v.pipe(v.strictObject(entries), v.readonly());

export const readonlyArray = <const TItem extends v.GenericSchema>(item: TItem) =>
  v.pipe(v.array(item), v.readonly());

export const nonNegativeInteger = (maximum = Number.POSITIVE_INFINITY) =>
  v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0), v.maxValue(maximum));

export const positiveInteger = () => v.pipe(v.number(), v.finite(), v.integer(), v.minValue(1));
