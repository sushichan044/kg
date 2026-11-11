import * as v from "valibot";

import { readonlyObject } from "../internal/schema";

const LineBreakResultSchema = v.variant("kind", [
  readonlyObject({ kind: v.literal("natural") }),
  readonlyObject({ kind: v.literal("shrunk") }),
  readonlyObject({ kind: v.literal("stretched") }),
  readonlyObject({ kind: v.literal("hanging") }),
  readonlyObject({ kind: v.literal("forced") }),
  readonlyObject({ kind: v.literal("paragraph-end") }),
]);

/**
 * 行長に収めるために、行の調整処理がこの行に何をしたか。
 *
 * `natural` は組んだままで収まった。`shrunk` ははみ出し、約物まわりのアキが超過分を吸収した。
 * `hanging` ははみ出し、行末の文字である句点または読点を版面の外に出した（ぶら下げ組）。
 * `stretched` は足りず、空けられるアキが不足分を埋めた。`forced` はそのどれもできなかった。
 * `paragraph-end` は調整ではなく、単に段落が終わっただけだ。
 *
 * つまり `shrunk` と `hanging` ははみ出した行への対応で、`stretched` は足りない行への対応だ。
 * 同じ行に順に試す代替手段ではない。どの行がどの状態になるかは、行ごとではなく段落全体で決まる。
 * コンポーザーは、`forced` の行数、次に `stretched`、次に `hanging`、
 * 最後に読者に見えるアキを使った `shrunk` の行数を、この順に最小化する。
 * 見えないアキだけを詰めた行は、段落のコストを増やさない。
 */
export type LineBreakResult = v.InferOutput<typeof LineBreakResultSchema>;

export const LineBreakResult = { schema: LineBreakResultSchema } as const;
