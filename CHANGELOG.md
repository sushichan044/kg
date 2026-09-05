# Changelog

## [0.7.0](https://github.com/sushichan044/kg/compare/v0.6.0...v0.7.0) (2026-09-05)


### ⚠ BREAKING CHANGES

* **core:** a western word space is a third em instead of a half, nothing at a line head or line end, and resized before any other space. It also leaves the composer as a `kind: "glue"` item with `origin: "source"` rather than as a `kind: "glyph"`, so a manuscript containing Latin text wraps differently and consumers reading `NovelLine.items` see the space on the glue arm.
* **core:** a line whose overflow is smaller than the アキ at its line end no longer takes part of it. Such lines now squeeze visible space instead, or break elsewhere, so both the widths and the line breaks change.
* **core:** a line that falls short or overflows spreads the difference over every space of the stage that pays for it, so glue widths inside such a line change even though the line breaks in the same place.
* **core:** a turned-over line beginning with an opening bracket is set flush against the line head instead of a half em in, so the same manuscript breaks differently wherever such a line occurs.

### Features

* **core:** give a turned-over line head its own opening-bracket space ([fffec2a](https://github.com/sushichan044/kg/commit/fffec2ab94feea78e3b5fa34e2e9b4251f654f8a))
* **core:** set the western word space as a third em the line adjustment resizes ([5a8c5d2](https://github.com/sushichan044/kg/commit/5a8c5d208474433e7c0d8d47c55276f7e86f5b64))
* **core:** spend one stage of line adjustment across all its spaces at once ([df4c96a](https://github.com/sushichan044/kg/commit/df4c96a239d3a217f480ae58304c725148418f8d))
* **core:** take a line-end アキ whole or leave it, never a width in between ([0958b57](https://github.com/sushichan044/kg/commit/0958b5741bcee1aff471649af17e08e024f561e0))


### Bug Fixes

* **core:** keep a character's own アキ to glue, and say the stages right ([905f741](https://github.com/sushichan044/kg/commit/905f741043bf2529de3f0a510f0c6b90c2f0df8d))


### Performance Improvements

* **core:** build the adjustment units of one direction only ([e3d85d3](https://github.com/sushichan044/kg/commit/e3d85d318ac9c21ee3d5014a6b0cc4b01347e373))

## [0.6.0](https://github.com/sushichan044/kg/compare/v0.5.0...v0.6.0) (2026-09-03)


### ⚠ BREAKING CHANGES

* **core:** 括弧・句読点・中点類・ハイフン類・和字間隔のまわりのアキが伸びなくなり、 和文と欧文/連数字/単位記号の間は二分アキまで伸びるようになったため、行が不足するときの glue の分配と、それに伴う行分割が変わる。

### Features

* **core:** expand inter-character space only where JLReq 表6 admits it ([ee59eb3](https://github.com/sushichan044/kg/commit/ee59eb399a6bd0e98b642dce6fd45a4c477fc388))


### Bug Fixes

* **viewer:** put a ruby reading and an emphasis mark beside the line, not on it ([bc157b1](https://github.com/sushichan044/kg/commit/bc157b1722ab7ea5aa2d9e594c4cfed7a4c41376))

## [0.5.0](https://github.com/sushichan044/kg/compare/v0.4.5...v0.5.0) (2026-09-02)


### ⚠ BREAKING CHANGES

* **core:** 中点類の前後・和文と欧文/連数字/単位記号の間に四分アキが入り、句読点や 括弧が連続する箇所の余分な二分アキが消えるため、同じ原稿でも行分割と glue の幅が変わる。 行中の句点類の後ろのアキと行頭の始め括弧類のアキは詰められなくなった。
* **core:** the proofreading API moved from `@sushichan044/kg-core` to `@sushichan044/kg-core/lint`: proofreadManuscript, ProofreadError, ProofreadOptions, ProofreadingReport, ProofreadingRule, ProofreadingRuleMeta, ProofreadingRuleMessages, ProofreadingRuleContext, ParsedProofreadingRule, ComposedProofreadingRule, InvalidRuleOptions, createDefaultProofreadingRules, and every built-in rule with its option types.

### Features

* **core:** set inter-character space from the JLReq spacing tables ([ed6e9de](https://github.com/sushichan044/kg/commit/ed6e9deacc895f1f598d8b1a84e36b898fa463b5))


### Bug Fixes

* **core:** centre a base character in the box a longer ruby widens ([1767226](https://github.com/sushichan044/kg/commit/1767226d0e192bee5edb63f7aeb27141d927d95c))
* place a ruby reading longer than its base over the character it annotates ([5f529eb](https://github.com/sushichan044/kg/commit/5f529eb3fe1caa7f5bc81b43c3b1dc182a546311))
* **viewer:** run a ruby reading down its line instead of across the page ([ab07be5](https://github.com/sushichan044/kg/commit/ab07be58f4da7778eda950ffcbb902ecf89f429e))


### Miscellaneous Chores

* **core:** split by audience into ., /lint and /plugin ([#99](https://github.com/sushichan044/kg/issues/99)) ([4a562a0](https://github.com/sushichan044/kg/commit/4a562a0d80c16fb031cbd52173dab0b32cc8eb48))

## [0.4.5](https://github.com/sushichan044/kg/compare/v0.4.4...v0.4.5) (2026-09-01)


### Bug Fixes

* **core:** spend the invisible line-end half-em before visible space ([#95](https://github.com/sushichan044/kg/issues/95)) ([277d627](https://github.com/sushichan044/kg/commit/277d627287e12e118a0778cf5be5346d9071c5f5))

## [0.4.4](https://github.com/sushichan044/kg/compare/v0.4.3...v0.4.4) (2026-09-01)


### Features

* implement JLReq paragraph composition with box-glue adjustment ([#92](https://github.com/sushichan044/kg/issues/92)) ([33fff2c](https://github.com/sushichan044/kg/commit/33fff2cd91916dd52cdf07205da2e3fa53e3e6f2))

## [0.4.3](https://github.com/sushichan044/kg/compare/v0.4.2...v0.4.3) (2026-08-30)


### Features

* **composer:** model vertical novel typesetting ([#82](https://github.com/sushichan044/kg/issues/82)) ([1c69c7a](https://github.com/sushichan044/kg/commit/1c69c7aadd3e9c67dc60e7942eb3ffaa421c3e63))


### Bug Fixes

* **composer:** preserve ruby readings across line fragments ([#83](https://github.com/sushichan044/kg/issues/83)) ([e3e1e07](https://github.com/sushichan044/kg/commit/e3e1e07f7e26136f632f4170a29c50b5cdf5110d))
* **viewer:** split line-spanning ruby readings ([#77](https://github.com/sushichan044/kg/issues/77)) ([543e0ac](https://github.com/sushichan044/kg/commit/543e0ac2629c4581a4227bd7cf9c2461737fa32e))

## [0.4.2](https://github.com/sushichan044/kg/compare/v0.4.1...v0.4.2) (2026-08-23)


### Features

* **composer:** hang punctuation gaps at wrap boundaries ([#74](https://github.com/sushichan044/kg/issues/74)) ([ab45fff](https://github.com/sushichan044/kg/commit/ab45fff41a98ef4b55ba3cbec1872ed0c70ca87f))

## [0.4.1](https://github.com/sushichan044/kg/compare/v0.4.0...v0.4.1) (2026-08-05)


### Bug Fixes

* **proofreading:** suggest a plain form for variant-character findings ([#67](https://github.com/sushichan044/kg/issues/67)) ([6f2135b](https://github.com/sushichan044/kg/commit/6f2135b9b5fcddb55d06b2a9c2377726c39c5bbc))

## [0.4.0](https://github.com/sushichan044/kg/compare/v0.3.0...v0.4.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* **core:** make the preferred dash configurable ([#62](https://github.com/sushichan044/kg/issues/62))

### Features

* **core:** make the preferred dash configurable ([#62](https://github.com/sushichan044/kg/issues/62)) ([52626d2](https://github.com/sushichan044/kg/commit/52626d2e8c7f893da947b602ec6136d79e5e4938))

## [0.3.0](https://github.com/sushichan044/kg/compare/v0.2.1...v0.3.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* **viewer:** draw the ruling, the text, and the diagnostics as layers ([#59](https://github.com/sushichan044/kg/issues/59))
* kg/paragraph-leading-character is replaced by kg/paragraph-opening, and ParagraphLeadingCharacterOptions.allowedCharacters becomes ParagraphOpeningOptions.openingBrackets.

### Features

* expand the built-in proofreading rules to cover Japanese novel style ([#56](https://github.com/sushichan044/kg/issues/56)) ([9e74604](https://github.com/sushichan044/kg/commit/9e74604503a84aa848398d518bb20c88d7d30ae6))
* **viewer:** draw the ruling, the text, and the diagnostics as layers ([#59](https://github.com/sushichan044/kg/issues/59)) ([a03440d](https://github.com/sushichan044/kg/commit/a03440da2e9315744cc2cdf610772536466a9e4c))


### Bug Fixes

* **release:** create tags for draft package releases ([#54](https://github.com/sushichan044/kg/issues/54)) ([4b44f15](https://github.com/sushichan044/kg/commit/4b44f1597d1ada98d9344cb3239bc12b2d4311ad))

## [0.2.1](https://github.com/sushichan044/kg/compare/v0.2.0...v0.2.1) (2026-08-04)


### Features

* add Kakuyomu notation support ([#51](https://github.com/sushichan044/kg/issues/51)) ([acd3384](https://github.com/sushichan044/kg/commit/acd33841454b5d4634a56d13b380761c98801897))

## [0.2.0](https://github.com/sushichan044/kg/compare/v0.1.1...v0.2.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* **viewer:** styles.css no longer carries the only stylesheet export, IframeIsolation replaces styleOverrides with a styles injection, and the kgv-annotation-{bold,italic,ruby,emphasis} modifier classes are gone.
* separate manuscript processing stages behind typed contracts ([#43](https://github.com/sushichan044/kg/issues/43))

### Features

* **viewer:** make styling and zoom consumer-controlled ([#44](https://github.com/sushichan044/kg/issues/44)) ([38f3492](https://github.com/sushichan044/kg/commit/38f3492ff414bb8cfb527bf0072e7e3052464e29))


### Code Refactoring

* separate manuscript processing stages behind typed contracts ([#43](https://github.com/sushichan044/kg/issues/43)) ([4ca2eda](https://github.com/sushichan044/kg/commit/4ca2eda5eaac323c591995dc98f57a1d4b620f5c))

## [0.1.1](https://github.com/sushichan044/kg/compare/v0.1.0...v0.1.1) (2026-08-03)


### Features

* improve manuscript preview fidelity and sharing ([#39](https://github.com/sushichan044/kg/issues/39)) ([2822c3d](https://github.com/sushichan044/kg/commit/2822c3d33599d37da3cceaf71ddeb8942e60b069))

## [0.1.0](https://github.com/sushichan044/kg/compare/v0.0.5...v0.1.0) (2026-08-01)


### ⚠ BREAKING CHANGES

* **core:** `ManuscriptAppearanceSettings.marginMm` (and `MARGIN_OPTIONS`/`MarginMm`/`isMarginMm`) removed in favor of `fontSizePt`; `ManuscriptGeometry` gains `gridWidthMm`/`gridHeightMm`/`marginInlineMm`/`marginBlockMm`/`fitsPaper`. `paginateManuscript` gains an optional `ManuscriptOffsets` third parameter for document/page/stage line reservations. localStorage schema bumped to v3.

### Features

* **core:** replace minimum-margin appearance with point-based font size and line offsets ([#29](https://github.com/sushichan044/kg/issues/29)) ([21000cb](https://github.com/sushichan044/kg/commit/21000cbd448cbe6c72ce0ff02be223d148354bc0))
* extract reusable manuscript viewer packages ([#24](https://github.com/sushichan044/kg/issues/24)) ([af4647e](https://github.com/sushichan044/kg/commit/af4647e87fb42e618c1ef80a7d22f893cb89a99e))
* **viewer:** isolate viewer styles in iframe via React portal ([#34](https://github.com/sushichan044/kg/issues/34)) ([5585998](https://github.com/sushichan044/kg/commit/5585998d5020ffc092d66928c4d55edac86159ff))
* **viewer:** share manuscript state via a context provider ([#31](https://github.com/sushichan044/kg/issues/31)) ([5bfefdb](https://github.com/sushichan044/kg/commit/5bfefdb2fde53578a25f8e4f4ba64d2f08e8fee2))


### Bug Fixes

* use spf13/pflag to parse args ([#33](https://github.com/sushichan044/kg/issues/33)) ([5ded85b](https://github.com/sushichan044/kg/commit/5ded85ba52576165b78cff431629626d05b4de25))

## [0.0.5](https://github.com/sushichan044/kg/compare/v0.0.4...v0.0.5) (2026-07-29)


### Bug Fixes

* **daemon:** replace outdated background process ([#18](https://github.com/sushichan044/kg/issues/18)) ([2c1488c](https://github.com/sushichan044/kg/commit/2c1488c376b083d0dda62e9d51d72177460643db))

## [0.0.4](https://github.com/sushichan044/kg/compare/v0.0.3...v0.0.4) (2026-07-28)


### Features

* **frontend:** enrich manuscript preview ([#15](https://github.com/sushichan044/kg/issues/15)) ([1fc2eb9](https://github.com/sushichan044/kg/commit/1fc2eb9822572819c750720edcb8d0894c9dab4a))


### Bug Fixes

* **frontend:** delegate vertical symbols to Unicode ([#13](https://github.com/sushichan044/kg/issues/13)) ([f467ea0](https://github.com/sushichan044/kg/commit/f467ea03a2e011046aac9a2e84be62dd2703f014))
* ハイフン系を全部倒す ([#11](https://github.com/sushichan044/kg/issues/11)) ([44816e0](https://github.com/sushichan044/kg/commit/44816e00ed5443585d94cea486ff94f574e09e1b))

## [0.0.3](https://github.com/sushichan044/kg/compare/v0.0.2...v0.0.3) (2026-07-19)


### Bug Fixes

* **frontend:** stand Latin characters upright in vertical preview ([#6](https://github.com/sushichan044/kg/issues/6)) ([d607f75](https://github.com/sushichan044/kg/commit/d607f75df78444b3bc4586fe904ef54710e89f5f))

## [0.0.2](https://github.com/sushichan044/kg/compare/v0.0.1...v0.0.2) (2026-07-18)


### Features

* impl core features ([#2](https://github.com/sushichan044/kg/issues/2)) ([6ff8d00](https://github.com/sushichan044/kg/commit/6ff8d00894504a62a272350a3dec798961da4e68))
