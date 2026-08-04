# Changelog

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
