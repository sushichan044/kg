# ADR 0004: 校正ルールを ID キーの config で設定する

- Status: Accepted
- Date: 2026-08-06
- Issue: [#57](https://github.com/sushichan044/kg/issues/57)

## 文脈

校正ルールの指定は、呼び出し側がルール実例の配列を組み立てる形だった。

```ts
proofreadManuscript(composed.value, {
  rules: [...createDefaultProofreadingRules(), consistentNumeralWidthRule()],
});
```

この形では「このルールだけ止める」「このルールの severity を下げる」「このルールに options を渡す」を宣言的に書けない。
options を持つルールは `createDashRule` のような個別 factory を呼び、返ってきた `ManuscriptResult` をその場で開く必要があった。

[#56](https://github.com/sushichan044/kg/issues/56) で report 単位の severity が入ったため、severity の決定はルール側に閉じていた。
config を導入するなら、config が明示した severity を優先し、report の severity をルール側の既定値として扱う整理が必要になる。

`kg/fullwidth-japanese-punctuation` は、半角カナ記号を error、日本語に隣接する半角記号を warning として報告しており、1 ルールの中に確度の違う 2 つの関心が同居していた。

## 決定

ルールは実例ではなく定義として登録する。

```ts
export type ProofreadingRuleDefinition<TId extends string, TOptionsInput, TOptionsOutput> =
  | Readonly<{ id: TId; create: () => ParsedProofreadingRule }>
  | Readonly<{
      id: TId;
      optionsSchema: v.GenericSchema<TOptionsInput, TOptionsOutput>;
      create: (options: TOptionsOutput) => ParsedProofreadingRule;
    }>;
```

`optionsSchema` を持たない定義は「options を取らないルール」であり、config 側もタプル形を書けない。
`optionsSchema` が既定値を持つため、config は部分的な options を渡せる。
これは `ManuscriptComposer` が settings の schema を自前で持つ形（`docs/design.md` の Runtime validation）と同じ考え方である。

config は ESLint や textlint と同じ、ルール ID をキーにした設定オブジェクトにする。

```ts
const rules = resolveProofreadingRules({
  rules: {
    ...recommendedProofreadingRules,
    "kg/dash": ["error", { preferred: "―" }],
    "kg/consistent-kanji-opening": "warning",
    "kg/max-arabic-numeral-digits": "off",
  },
});
```

1 ルールの設定値は `"off" | "on" | "warning" | "error"`、または options を伴うタプル `[level, options]`。
`"on"` はルール自身の report が選ぶ severity をそのまま使う。
`"warning"` と `"error"` はそのルールが出す全ての report の severity を上書きする。
config が明示した severity が勝ち、明示しなければ report の severity がルール側の既定値として残る。

プリセットは `extends` のような専用機構を持たず、ただの settings オブジェクトとして export する。
呼び出し側のスプレッドで合成でき、TypeScript がその場で型検査する。

```ts
export const recommendedProofreadingRules: ProofreadingRuleSettings = { ... };
export const allProofreadingRules: ProofreadingRuleSettings = {
  ...recommendedProofreadingRules,
  "kg/consistent-kanji-opening": "on",
  ...
};
```

`kg/fullwidth-japanese-punctuation` は 2 ルールに割る。
無条件の半角カナ記号と、日本語に隣接する `!` `?` は error のまま `kg/fullwidth-japanese-punctuation` に残し、日本語に隣接する `,.()[]{}` は warning の `kg/halfwidth-punctuation-near-japanese` に分ける。
分割すれば「1 ルール 1 関心 1 severity」になり、利用者はヒューリスティックな側だけを off にできる。

既存の `createXxxRule` / `xxxRule()` / `createDefaultProofreadingRules` / `InvalidRuleOptions` は廃止し、definition・config・resolver に一本化する。
1.0 未達のパッケージなので、破壊的変更として release note に載せる。

原稿内のインラインディレクティブ（`/* eslint-disable */` に相当するもの）は入れない。
原稿は作品そのものであり、そこに校正ツールへの指示を書かせるわけにはいかない。
設定は必ず原稿の外に置く。

独自ルール定義の登録（`definitions` オプション）は今回入れない。
独自ルールは従来どおり `proofreadManuscript` に配列で渡す。

## 理由

ID をキーにした設定オブジェクトは、ESLint と textlint という利用者が既に知っている形に合わせている。
「このルールだけ触る」という操作が、ルールの生成コードを読まずにキー一つで書ける。

definition と instance を分けると、config の解決（`resolveProofreadingRules`）と実行（`proofreadManuscript`）が別の関心になる。
config の解決は原稿ごとに再実行する必要がなく、composer 固有の `ComposedProofreadingRule<TComposed>` を配列で足す道も残る。

severity を config 側の決定として持つ整理は、ESLint と textlint がどちらも同じ選択をしている。
ルールは message だけを選び、config が最終的な重大度を決める。

プリセットを settings オブジェクトのまま export する選択は、`extends` チェーンや merge 専用ロジックを持たない代わりに、TypeScript の構造的型検査とスプレッドだけで合成を検証できる。

## 影響

`createDefaultProofreadingRules`、個々の `createXxxRule` / `xxxRule()` factory、`InvalidRuleOptions` は削除された。
`createRecommendedProofreadingRules()` がゼロ設定の入口として残る。

`kg/fullwidth-japanese-punctuation` の警告側は `kg/halfwidth-punctuation-near-japanese` という新しいルール ID に分離された。
両方とも `recommendedProofreadingRules` に含まれるため、既定の診断内容自体は変わらない。

## 却下した案

### `proofreadManuscript` に config をそのまま渡す

`proofreadManuscript(composed, { rules: { ... } })` と書けて呼び出しが 1 回で済むが、config のエラーが `ProofreadError` の union に混ざり、composer 固有ルールの型付けが複雑になる。
config の解決と実行を別関数に分けた方が、それぞれの契約が単純になる。

### severity をレベルとオプションを分けたオブジェクト形にする

`{ severity?: ..., options?: ... }` は省略の意図が読み取りやすいが、ESLint/textlint の見た目から離れ、config の記述量が増える。

### 独自ルール定義の登録を今回のスコープに含める

`definitions` を受け取り、独自ルールの ID も config のキーとして型検査させる案は将来の拡張点として有効だが、型と検証の量が増える。
今回は組み込みルールの config 化に絞り、独自ルールは配列のまま渡せることを維持する。

## 参照

- [ESLint: Configure Rules](https://eslint.org/docs/latest/use/configure/rules)
- [textlint: Rule List](https://github.com/textlint/textlint/blob/master/docs/rule-list.md)
