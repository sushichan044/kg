# ADR 0003: 罫線、本文、診断を独立したレイヤーとして描く

- Status: Accepted
- Date: 2026-08-04
- Issue: [#58](https://github.com/sushichan044/kg/issues/58)

## 文脈

viewer は、罫線、本文、診断という三つの関心を同じ箱に同居させていた。
罫線はセルが上と左、行が右と下を描き、診断は同じセルの `background`、`inset box-shadow`、`outline` に載っていた。

この構造から四つの問題が出ていた。

利用側が `.kgv-cell { border: 1px solid … }` のように素直に書くと、どの辺がどの要素の担当かを知らない限り罫線が二重になる。

`.kgv-line` は寸法指定を持たないため、テーマの `border` がそのまま行の外寸を広げていた。
既定の 27 字 23 行 2 段では、描画された grid が core の `geometry.gridWidthMm` より行数ぶん広く、段ごとに 1px 高い。
テーマは見た目だけを担うという前提が崩れており、mm を指定した印刷や `fitsPaper` の判断と実際の描画がずれていた。

border は background より後に塗られ、`inset box-shadow` は border より前に塗られ、`outline-offset: -2px` は罫線に重なる。
そのため診断の下線や枠が罫線に食われ、片方の指定を変えると他方の見た目が動いた。

診断はセル単位に塗られるため、複数文字に渡る指摘が 1 文字ごとの帯に割れていた。
重なった診断は、そのセルで始まる最初の 1 件しか表現できず、同じセルで 2 件が始まる場合は 2 件目が操作対象を持てなかった。

## 決定

行の中に、装飾専用のレイヤーを二つ置く。

```text
div.kgv-line                                position: relative
├── span.kgv-line-rules                     罫線（position: absolute; inset: 0）
│   └── span.kgv-rule-cell                  セル 1 個につき 1 個
├── span.kgv-cell                           本文（border も装飾も持たない）
│   └── span.kgv-glyph
└── span.kgv-line-diagnostics               診断（position: absolute; inset: 0）
    └── button|span.kgv-diagnostic-band     診断 1 件につき 1 個
```

レイヤーは out of flow とし、行の寸法には寄与させない。
テーマが何を描いても、grid は組版が計算した geometry のままになる。

重なりの順序は `z-index` ではなく DOM の順序で決める。
罫線、本文、診断の順に並べ、後のものが前のものを覆う。

罫線は、レイヤーの中にセルと同じ数の空要素を並べ、各要素が自分の上と左右を描き、最後の要素だけが下を描く。
一本の罫線は必ず一つの要素に属するので、隣り合う箱が同じ罫線を二重に描くことがない。

診断は、行に届いた診断 1 件につき band を 1 個置き、セル数で表した開始位置と長さから配置する。
複数文字に渡る指摘は連続した一本の装飾になり、重なった診断はそれぞれ独立した要素になる。
band は開始位置の昇順、同じ開始位置なら長さの降順に並べ、内側の band が上に来るようにする。

診断の操作は band 自身が担う。
診断が始まる行の band を `<button>` とし、`aria-label` と選択を持たせる。
行をまたいだ続きの band は `aria-hidden` の `<span data-diagnostic-continued>` とし、1 件の診断に対する操作対象を一つに保つ。

診断レイヤーは本文より後に置く。
指摘範囲の全体をクリックできることを優先した結果、当たり判定は本文の上に来る。
そのためテーマは band の塗りを半透明にし、傍線はルビが使わない側に置く。

セルの `data-diagnostic` 系属性は公開契約として残すが、既定テーマでは使わない。
セルは自分の文字の見せ方（色など）を担い、範囲の装飾は band が担う、という境界にする。

## 理由

三つの関心を別の要素に分けると、CSS の到達範囲が構造で決まる。
罫線を触っても診断は動かず、診断を触っても罫線は動かず、どちらもレイアウトを動かさない。

装飾を out of flow にすることは、見た目とレイアウトの分離を宣言ではなく構造で保証する。
テーマを読み込むかどうかで grid の寸法が変わらないので、組版の geometry がそのまま表示に対応する。

band を範囲単位にすると、診断の表現力が範囲モデルと一致する。
重なりと行またぎを要素の数で表せるため、severity を取りこぼさず、操作対象も 1 件に対して一つに保てる。

## 影響

DOM contract が変わるので、`.kgv-diagnostic-marker` を使った利用側 CSS は `.kgv-diagnostic-band` へ移す必要がある。
1.0 前のパッケージなので、破壊的変更として release note に載せる。

罫線がセル数と同じ数の空要素を持つため、1 ページの要素数が既定設定で 1242 個増える。
ページ単位の `content-visibility: auto` は維持されるので、描画コストは表示中のページに限られる。

テーマの `--kgv-rule-width` で罫線の太さを変えられる。
罫線は border なので、forced-colors では `border-color` の再宣言だけで足りる。

browser test に、テーマがレイアウトを動かさないこと、罫線が本文と同じ pitch に並ぶこと、band が範囲を覆うことを検証する項目を追加する。

## 却下した案

### 罫線を repeating gradient で 1 要素にまとめる

要素を増やさずに済み、宣言も一つで足りるので最初に実装した。
しかし端数のセル pitch では、engine が repeating gradient を整数 device pixel で並べるため、罫線がおよそ 5 本に 1 本消えた。
実測では、38.67px pitch で 309、347、424、462 に罫線が出て、386 付近の 1 本が完全に欠落した。
箱ごとの border では同じ pitch で全ての罫線が残ったので、要素を増やす側を選んだ。

### `.kgv-line` の background に罫線を描く

重複とレイアウト汚染は解消するが、罫線だけを消す・差し替えるための要素が存在しない。
将来 `.kgv-line` に別の背景を足したくなった時点で、また同じ箱の取り合いになる。

### セルの border を残し、塗り順だけを整える

塗り順は直せても、テーマの border が行の外寸を広げる問題と、素直な CSS で罫線が二重になる問題が残る。

### CSS Custom Highlight API で診断を DOM なしに塗る

`::highlight()` で使えるのは color、background-color、text-decoration 系に限られ、セル幅の塗りと傍線を表現できない。
Baseline widely available でもないため、このパッケージの前提に合わない。

### 診断を装飾レイヤーと操作レイヤーの 2 枚に分ける

文字の上に塗りが乗らない利点はあるが、severity と選択状態を 2 か所に持つことになる。
band の塗りを半透明に保つ方が、公開契約と実装のどちらも小さく済む。

## 参照

- [Painting order (CSS 2.1 Appendix E)](https://www.w3.org/TR/CSS21/zindex.html)
- [CSS Custom Highlight API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Custom_Highlight_API)
- [Styling for Windows high contrast with new standards for forced colors](https://blogs.windows.com/msedgedev/2020/09/17/styling-for-windows-high-contrast-with-new-standards-for-forced-colors/)
