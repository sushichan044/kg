# ADR 0004: 小説の組版と任意のマス目表示を分離する

- Status: Accepted
- Date: 2026-08-30
- Supersedes: ADR 0001 と ADR 0003 のセル依存部分

## 文脈

従来の組版モデルは、すべての文字を原稿用紙のセルへ配置していた。
しかし、小説の縦書きでは、禁則処理、約物のぶら下げ、疑問符と感嘆符の後ろの空白、ルビによる字間調整が一字一マスの前提と一致しない。
例外を viewer または個別の pull request に追加すると、組版結果の決定責任が core と viewer に分散し、新しい約物やルビの事例ごとに考慮漏れが生じる。

マス目は執筆者にとって有用な表示である。
ただし、マス目の有無は本文の折り返しや配置を変える理由にはならない。

## 決定

組み込み composer を `novelComposer` に一本化し、一般的な縦書き小説の組版結果を生成する。
旧 `manuscriptGridComposer` とセル中心の公開型は削除し、互換アダプターは残さない。

組版の流量は次の三つで指定する。

- `lineLengthEm`：一行の論理的な長さ
- `linesPerStage`：一段の行数
- `stagesPerPage`：一ページの段数

composer は本文書記素の論理 em 幅を測り、禁則と注釈を考慮して改行位置を決める。
既定の measurer は日本語文脈の East Asian Width を使い、全角文字を 1 em、通常の ASCII を 0.5 em として扱う。
利用側は同期的な measurer を `createNovelComposer` に渡せる。
負数または有限でない測定結果は組版失敗にする。

core は各行について、本文書記素の offset と advance、ぶら下げの disposition、表示を抑止した原文書記素、注釈 fragment を返す。
viewer はこれらの位置を描画するだけで、禁則処理、空白の抑止、ルビの分割を推測しない。

ルビの読みは `group`、`mono`、`jukugo` の discriminated union とする。
`mono` と `jukugo` は基底書記素ごとの読みを保持し、基底書記素数と segment 数の不一致を parser 境界で拒否する。
一行に収まる `group` ルビは途中で分割しない。
一行より長い `group` ルビは分割を許し、本文の実測幅に比例した読みの書記素境界で fragment を作る。

マス目は `NovelViewer` の `showGrid` で切り替える装飾レイヤーとする。
`showGrid` を変えても、composer、組版設定、ページ geometry、本文とルビの位置は変えない。
既定値は `true` とし、従来の見た目を保つ。

frontend の preferences は version 6 とする。
version 3 から version 5 の grid 設定は novel flow 設定へ移行し、移行時の `showGrid` は `true` にする。

## 理由

行分割を core に集約すると、一つの組版結果を HTML 表示、将来の別 renderer、校正規則で共有できる。
文字が表示された理由、ぶら下がった理由、表示されなかった理由が layout に残るため、viewer の DOM を調べずに組版を検証できる。

マス目を装飾に限定すると、表示上の好みと小説の組版規則を独立して変更できる。
同じ原稿と設定から得た位置を両方の表示で使うため、マス目を消したときだけ改行が変わることもない。

ルビの関連を parser で保持すると、composer が読みの長さから `mono` と `group` を推測せずに済む。
文字数が偶然一致する熟語ルビと、一字ごとのモノルビを区別できる。

## 影響

core と viewer の公開 API は破壊的に変わる。
利用側は `NovelCompositionSettings`、`novelComposer`、`NovelViewer` へ移行する必要がある。

layout はセル配列ではなく位置付き書記素を持つ。
診断表示は書記素 range と offset から帯を配置し、マス目の要素を参照しない。

既定 measurer は決定的であり、DOM や font loading に依存しない一方、実フォントの glyph metrics を再現するものではない。
印刷精度が必要な利用側は、その環境で利用可能な font metrics を返す measurer を指定する。

## 却下した案

### 原稿用紙 composer と novel composer を並存させる

二つの composer が禁則、空白、ルビの規則を別々に持つため、同じ小説の表示で再び差が生じる。
マス目の有無だけが違う要件に対して、組版モデルを二重化する必要はない。

### viewer が CSS の禁則処理と ruby layout に任せる

組版結果に改行理由と位置が残らず、browser engine ごとの差を core のテストで検証できない。
診断と source mapping も、実際に表示された位置を再計算する必要が生じる。

### 従来 API の互換層を残す

セルを前提とする型を novel layout から復元すると、削除した二重モデルを互換層の中に維持することになる。
1.0 前の破壊的変更として旧 API を削除し、現在の責務だけを公開する。
