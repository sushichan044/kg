import type { ParsedProofreadingRule } from "../proofreading-rule";
import { defineMatchRule } from "./internal/define-rule";

/**
 * 三点リーダ `…` の代用品。実際の文字だけが全角で組まれ、2 つ並べて 2倍リーダになる。
 * ASCII のピリオドの連なりは、そのどちらでもない。`。` と `・` の連なりは、
 * すでにそれらを数えているルールに任せ、1 つの代用品が二重に報告されないようにする。
 */
export const ellipsisCharacterRule = (): ParsedProofreadingRule =>
  defineMatchRule({
    id: "kg/ellipsis-character",
    pattern: /\.{3,}|⋯+/gu,
    message: "三点リーダーには「…」を使ってください",
  });
