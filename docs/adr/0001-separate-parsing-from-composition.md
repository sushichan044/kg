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
`ParsedManuscript` とその配列は immutable とし、共有した範囲情報が後から無効にならないようにする。

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
`ManuscriptCompositionSettings` は配置または物理寸法を変えるすべての値を含み、zoom や UI の選択状態を含まない。

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
JavaScript の文字列操作、`Intl.Segmenter` の index、DOM の selection API が UTF-16 offset を使うため、この単位を正本にする。
UTF-8 byte offset や Unicode code point offset を採用すると、core と viewer の境界で UTF-16 への変換が必要になる。
書記素範囲は、表示書記素配列に対する 0 始まりかつ終端を含まないインデックスとする。
原文範囲はエディタ選択、表示範囲は記法を除いた校正、書記素範囲は組版要素との対応に使う。
表示範囲が原文記法をまたぐ場合、原文範囲は途中の記法を含む最小の連続被覆区間とする。
診断とエディタ選択を一つの `SourceRange` で表現するため、非連続な原文範囲は導入しない。
パーサーと組版 API は範囲の対応を維持し、校正時に文字列を再探索しない。
`ManuscriptDiagnostic` は原文範囲と、原文から算出した line / column を保持する。
校正 API が診断生成時に line / column を付与し、viewer は再計算せず表示する。

## 校正 API

校正ルールは必要な原稿表現を宣言し、設定済みのインスタンスとして扱う。

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
組み込みルールはルール固有の設定を受け取るファクトリーとして提供し、生成したインスタンスに設定を閉じ込める。
これにより、ランナーを全ルールで共通化し、設定を一つの巨大な object に集約しない。
どちらのルールも `ManuscriptRange` から同じ形式の診断を生成する。
校正 API は viewer、React、DOM に依存しない。

## Viewer API

viewer は `ComposedManuscript` と計算済みの `ManuscriptDiagnostic` を受け取って描画する。
viewer は原文の解析、組版、校正ルールの登録、校正の実行を行わない。
診断が渡された場合は範囲情報を使って強調表示や診断一覧を描画する。

## 移行

`ManuscriptState`、`ManuscriptController`、`ManuscriptAction`、`ManuscriptTransaction` は削除する。
原文を直接受け取るページ分割 API と校正 API も削除し、解析済み原稿または組版済み原稿を受け取る API に置き換える。
組版設定、校正設定、プリセット、その永続化は利用者が責任を持つ。
これらは原稿変換ではなく利用アプリケーション固有の状態だからである。
core の `ManuscriptPreferences` と永続化 API は削除する。
互換オーバーロードやアダプターは残さない。
