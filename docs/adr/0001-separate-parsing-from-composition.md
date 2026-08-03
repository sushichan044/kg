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

## 組版済み原稿

組版 API は次の形とする。

```ts
composeManuscript(
  parsed: ParsedManuscript,
  settings: ManuscriptCompositionSettings,
): ComposedManuscript;
```

`ComposedManuscript` は `ParsedManuscript` と、ページ、段、行、セルの構造を持つ。
内容を持つ各配置要素から、対応する解析済み原稿の範囲を取得できるようにする。
内容を持たない配置要素の範囲は `null` とする。

## 範囲と診断

解析済み原稿と組版済み原稿は同じ範囲表現を使う。

```ts
interface ManuscriptRange {
  readonly source: SourceRange;
  readonly display: DisplayRange;
  readonly graphemes: GraphemeRange;
}
```

原文と表示用テキストの範囲は UTF-16 の 0 始まりかつ終端を含まない offset とする。
パーサーと組版 API は範囲の対応を維持し、校正時に文字列を再探索しない。
`ManuscriptDiagnostic` は原文範囲を正本とする。

## 校正 API

校正ルールは必要な原稿表現を宣言する。

```ts
type ProofreadingRule =
  | {
      readonly id: string;
      readonly requires: "parsed";
      check(manuscript: ParsedManuscript): readonly ManuscriptDiagnostic[];
    }
  | {
      readonly id: string;
      readonly requires: "composed";
      check(manuscript: ComposedManuscript): readonly ManuscriptDiagnostic[];
    };
```

組み込みルールと利用者が追加するルールは同じ契約を使う。
どちらのルールも `ManuscriptRange` から同じ形式の診断を生成する。
校正 API は viewer、React、DOM に依存しない。

## Viewer API

viewer は `ComposedManuscript` と計算済みの `ManuscriptDiagnostic` を受け取って描画する。
viewer は原文の解析、組版、校正ルールの登録、校正の実行を行わない。
診断が渡された場合は範囲情報を使って強調表示や診断一覧を描画する。

## 移行

`ManuscriptState`、`ManuscriptController`、`ManuscriptAction`、`ManuscriptTransaction` は削除する。
原文を直接受け取るページ分割 API と校正 API も削除し、解析済み原稿または組版済み原稿を受け取る API に置き換える。
互換オーバーロードやアダプターは残さない。
