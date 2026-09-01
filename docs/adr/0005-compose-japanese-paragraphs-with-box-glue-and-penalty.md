# ADR 0005: box・glue・penalty で日本語段落を組む

- Status: Accepted
- Date: 2026-09-02
- Issues: [#84](https://github.com/sushichan044/kg/issues/84), [#85](https://github.com/sushichan044/kg/issues/85)
- Supersedes: ADR 0004 の inline positioning 部分

## 文脈

ADR 0004 の composer は書記素の advance を順に加算し、行長を超えた位置から禁則に従って戻る greedy な処理だった。
文字間のアキと調整可能量を表現できないため、読点のアキを詰めれば収まる分離禁止文字も次行へ追い出していた。
また、ぶら下げを選んだ後の境界を再検査しないため、その直後の終わり括弧が行頭に露出した。

書記素の advance は、組版上の box と glyph の視覚的な描画範囲を同一視していた。
句読点や括弧は半角の字幅と二分アキを組み合わせて実効全角にするため、この同一視ではアキの縮小優先順位を表現できない。

## 決定

組み込み novel composer は、各改行文字で区切られた表示行を一つの段落として扱い、内部で box・glue・kern・penalty の列へ変換する。
改行候補は active breakpoint を前向きに走査する動的計画法で段落全体から選ぶ。
候補の評価は次の辞書順とする。

1. 禁則違反は候補から除外する。
2. `natural < shrink < hanging < stretch < forced` の順で優先する。
3. JLReq の優先度が高い glue から変形する。
4. 正規化した変形量の三乗と、隣接行で密度が急変する fitness を小さくする。
5. 完全な同点では前の行へ多く入る改行を選ぶ。

内部の `JapaneseTypesettingProfile` が JLReq の文字クラス、box metrics、文字クラス対の glue / kern、禁則 penalty、行端 spacing、ぶら下げ可否を所有する。
今回実装する通常本文の範囲は cl-01〜cl-16、cl-19、cl-24〜cl-27、cl-30 とする。
数式、合印、割注など専用の構造を要するクラスは、対応する原稿モデルを導入するときに追加する。
profile は実利用が複数現れるまで内部契約とし、利用者が任意の規則を注入する公開 API にはしない。

句点・読点・括弧の typographic box は原則 0.5em とし、隣接文字または行端との 0.5em glue を別に保持する。
glyph の視覚範囲は box と分ける。
ぶら下げは cl-06 と cl-07 の一文字だけに許し、ぶら下げ後の次行も禁則を満たす候補に限る。
cl-08 は連続する内部でだけ分割を禁じ、列自体は行頭に置ける。

公開 layout は `NovelLine.graphemes` と `NovelLine.suppressed` を削除し、`NovelLine.items` に次の closed union を返す。

- `glyph`: source range、`layoutSpan`、`renderSpan`、presentation、disposition
- `glue`: 解決済み幅、自然幅、source/generated の由来、調整結果
- `kern`: 固定の符号付き幅
- `suppressed`: source range と抑止理由

行は `inlineSizeEm` と break result を持つ。
`InlineMeasurer` は number ではなく `{ advanceEm }` を返す。
旧型の互換 adapter は置かず、core、viewer、同梱 frontend を同時に移行する。

viewer は glyph の描画に `renderSpan`、ruby と診断帯に `layoutSpan` を使い、glue や禁則を推測しない。

## 理由

box と glue を分けると、同じ自然幅でも「変形できない glyph」と「優先順位付きで詰められるアキ」を区別できる。
penalty を改行候補の性質として扱うため、ぶら下げだけが禁則検査を迂回する分岐もなくなる。
段落全体の評価は、現在行へ最大限入れる局所判断によって後続行だけが極端に疎になる問題を避ける。

出力に組版上の box と視覚範囲の両方を残すことで、HTML 以外の renderer も同じ判断を再現できる。

## 影響

core の inline layout と custom measurer API は破壊的に変わる。
長い段落でも dense な全辺グラフは作らず、最小幅が行長を十分超えた時点で候補展開を打ち切る。
最終行は不足分を伸ばさないが、わずかな超過は通常行と同じ優先順位で詰める。

追加の設定 UI、特殊文字クラス、公開 custom profile は別 Issue とする。

## 参考

- [Requirements for Japanese Text Layout](https://www.w3.org/TR/jlreq/)
- [CSS Text Module Level 4: Expanding and Compressing Text](https://www.w3.org/TR/css-text-4/#expanding-text)
- [LuaTeX-ja manual](https://texdoc.org/serve/luatexja-en.pdf/0)
