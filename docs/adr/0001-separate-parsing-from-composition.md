# ADR 0001: 原稿の解析、組版、校正、表示を分離する

- Status: Accepted
- Date: 2026-08-03
- Issue: [#41](https://github.com/sushichan044/kg/issues/41)

## 決定

原稿処理を次の四つの API に分離する。

```text
source ──parse──▶ ParsedManuscript ──compose──▶ ComposedManuscript
                       │                              │
                       └────────proofread─────────────┘──▶ diagnostics

ComposedManuscript + diagnostics ──▶ viewer
```

- **解析**：サービス固有の原文記法を正規化する。
- **組版**：解析済み原稿をページ、段、行、セルへ配置する。
- **校正**：解析済み原稿または組版済み原稿から診断を生成する。
- **表示**：組版済み原稿と診断を描画する。

利用側がこの四つの API を組み合わせ、各処理を実行する時点を決める。
core は値と純粋な変換だけを提供し、処理全体の状態を所有しない。

## 解析済み原稿

`ParsedManuscript` は次のデータを持つ。

- 変更していない原文
- サービス固有の記法を除いた表示用テキスト
- 表示書記素
- ルビや傍点などの正規化済み注釈
- 原文、表示用テキスト、書記素を対応づける範囲情報

パーサーは公開契約を実装し、`ParsedManuscript` を返す。
core はプレーンテキストと Pixiv のパーサーを同じ契約で提供する。
注釈はルビ、太字、斜体、傍点からなる closed union とし、重複する範囲を許可する。
`ParsedManuscript` とその配列は readonly な plain object とし、class や deep freeze は使わない。

## 組版済み原稿

組版 API は次の形とする。

```ts
composeManuscript(
  parsed: ParsedManuscript,
  options: {
    composer: ManuscriptComposer;
    settings: ManuscriptCompositionSettings;
  },
): ManuscriptResult<ComposedManuscript>;
```

`ComposedManuscript` は `ParsedManuscript` と、ページ、段、行、セルの構造を持つ。
内容を持つ各配置要素から、対応する解析済み原稿の範囲を取得できるようにする。
内容を持たない配置要素の範囲は `null` とする。
`ManuscriptCompositionSettings` は配置または物理寸法を変えるすべての値を含み、zoom や UI の選択状態を含まない。
composer は settings と layout の Valibot schema を公開し、core が plugin の入出力を実行時にも検査できるようにする。
無効な設定や offset は丸めず、`ManuscriptResult` の失敗として返す。

## 範囲と診断

解析済み原稿と組版済み原稿は同じ範囲表現を使う。

```ts
interface ManuscriptRange {
  readonly source: SourceRange;
  readonly display: DisplayRange;
  readonly graphemes: GraphemeRange;
}
```

三つの範囲は構造を共有するが、取り違えをコンパイル時に検出するため、それぞれを Valibot の brand で区別する。

原文と表示用テキストの範囲は UTF-16 の 0 始まりかつ終端を含まない offset とする。
JavaScript の文字列操作、`Intl.Segmenter` の index、DOM の selection API が UTF-16 offset を使うため、この単位を正本にする。
UTF-8 byte offset や Unicode code point offset を採用すると、core と viewer の境界で UTF-16 への変換が必要になる。
書記素範囲は、表示書記素配列に対する 0 始まりかつ終端を含まないインデックスとする。
原文範囲はエディタ選択、表示範囲は記法を除いた校正、書記素範囲は組版要素との対応に使う。
表示範囲が原文記法をまたぐ場合、原文範囲は途中の記法を含む最小の連続被覆区間とする。
診断とエディタ選択を一つの `SourceRange` で表現するため、非連続な原文範囲は導入しない。
パーサーと組版 API は範囲の対応を維持し、校正時に文字列を再探索しない。
`ManuscriptDiagnostic` は原文範囲と、原文から算出した 1 始まりの line / column を保持する。
line は `CRLF`、`CR`、`LF` を改行境界として数え、`CRLF` は一つの改行として扱う。
column は行頭からの UTF-16 code unit 数に 1 を加えた値とする。
校正 API が診断生成時に line / column を付与し、viewer は再計算せずその値を表示する。

## 校正 API

校正ルールは必要な原稿表現を宣言し、設定済みのインスタンスとして扱う。

```ts
interface ProofreadingRule {
  readonly meta: {
    readonly id: `${string}/${string}`;
    readonly requires: "parsed" | "composed";
    readonly messages: Readonly<Record<string, string>>;
  };
  check(manuscript, context: ProofreadingRuleContext): void;
}

interface ProofreadingRuleContext {
  report(report: ProofreadingReport): void;
}
```

組み込みルールと利用者が追加するルールは同じ契約を使う。
組み込みルールはルール固有の設定を受け取るファクトリーとして提供し、生成したインスタンスに設定を閉じ込める。
これにより、ランナーを全ルールで共通化し、設定を一つの巨大な object に集約しない。
`ProofreadingOptions` は削除し、各組み込みルールのファクトリー引数へ分割する。
どちらのルールも `ManuscriptRange` から同じ形式の診断を生成する。
rule ID は namespaced な形式とし、重複を失敗として扱う。
組版済み原稿を校正するときは、解析済み原稿を要求するルールと組版済み原稿を要求するルールの両方を実行する。
校正 API は viewer、React、DOM に依存しない。

## 実行時検査

公開 DTO と設定の Valibot schema を core が提供し、対応する TypeScript 型を `InferOutput` から導出する。
parser の結果、composer の設定と結果、校正 rule の metadata と report を各境界で検査する。
TypeScript によって生成元が保証されている core 内部の中間値や frontend の reducer action は、処理のたびに再検査しない。
これにより、plugin と永続化 payload は実行時に検査しつつ、内部処理に重複した validation を持ち込まない。

## Viewer API

viewer は `ComposedManuscript` と計算済みの `ManuscriptDiagnostic` を受け取って描画する。
viewer は原文の解析、組版、校正ルールの登録、校正の実行を行わない。
診断が渡された場合は範囲情報を使って強調表示や診断一覧を描画する。

## 移行

`ManuscriptState`、`ManuscriptController`、`ManuscriptAction`、`ManuscriptTransaction` は削除する。
原文を直接受け取るページ分割 API と校正 API も削除し、解析済み原稿または組版済み原稿を受け取る API に置き換える。
組版設定、校正設定、プリセット、その永続化は利用アプリケーションが所有し、同梱 application では frontend へ移す。
これらは原稿変換ではなく利用アプリケーション固有の状態だからである。
core の `ManuscriptPreferences` と永続化 API は削除する。
同梱 frontend の永続化形式は version 3 とし、version 2 から移行せず既定値へ戻す。
互換オーバーロードやアダプターは残さない。
