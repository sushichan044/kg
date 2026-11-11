import * as v from "valibot";

/**
 * このパッケージの DTO はすべて、閉じたフリーズ済みのオブジェクトである。未知のキーは拒否し、
 * 出力は読み取り専用にする。
 */
export const readonlyObject = <const TEntries extends v.ObjectEntries>(entries: TEntries) =>
  v.pipe(v.strictObject(entries), v.readonly());

export const readonlyArray = <const TItem extends v.GenericSchema>(item: TItem) =>
  v.pipe(v.array(item), v.readonly());

export const nonNegativeInteger = (maximum = Number.POSITIVE_INFINITY) =>
  v.pipe(v.number(), v.finite(), v.integer(), v.minValue(0), v.maxValue(maximum));

export const positiveInteger = () => v.pipe(v.number(), v.finite(), v.integer(), v.minValue(1));
