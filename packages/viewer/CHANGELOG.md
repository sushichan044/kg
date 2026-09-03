# Changelog

## [0.8.0](https://github.com/sushichan044/kg/compare/kg-viewer-v0.7.0...kg-viewer-v0.8.0) (2026-09-03)


### Bug Fixes

* **viewer:** put a ruby reading and an emphasis mark beside the line, not on it ([bc157b1](https://github.com/sushichan044/kg/commit/bc157b1722ab7ea5aa2d9e594c4cfed7a4c41376))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.8.0

## [0.7.0](https://github.com/sushichan044/kg/compare/kg-viewer-v0.6.5...kg-viewer-v0.7.0) (2026-09-02)


### ⚠ BREAKING CHANGES

* **core:** the proofreading API moved from `@sushichan044/kg-core` to `@sushichan044/kg-core/lint`: proofreadManuscript, ProofreadError, ProofreadOptions, ProofreadingReport, ProofreadingRule, ProofreadingRuleMeta, ProofreadingRuleMessages, ProofreadingRuleContext, ParsedProofreadingRule, ComposedProofreadingRule, InvalidRuleOptions, createDefaultProofreadingRules, and every built-in rule with its option types.

### Bug Fixes

* place a ruby reading longer than its base over the character it annotates ([5f529eb](https://github.com/sushichan044/kg/commit/5f529eb3fe1caa7f5bc81b43c3b1dc182a546311))
* **viewer:** run a ruby reading down its line instead of across the page ([ab07be5](https://github.com/sushichan044/kg/commit/ab07be58f4da7778eda950ffcbb902ecf89f429e))


### Miscellaneous Chores

* **core:** split by audience into ., /lint and /plugin ([#99](https://github.com/sushichan044/kg/issues/99)) ([4a562a0](https://github.com/sushichan044/kg/commit/4a562a0d80c16fb031cbd52173dab0b32cc8eb48))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.7.0

## [0.6.5](https://github.com/sushichan044/kg/compare/kg-viewer-v0.6.4...kg-viewer-v0.6.5) (2026-09-01)


### Miscellaneous Chores

* **kg-viewer:** Synchronize kg versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.6.5

## [0.6.4](https://github.com/sushichan044/kg/compare/kg-viewer-v0.6.3...kg-viewer-v0.6.4) (2026-09-01)


### Features

* implement JLReq paragraph composition with box-glue adjustment ([#92](https://github.com/sushichan044/kg/issues/92)) ([33fff2c](https://github.com/sushichan044/kg/commit/33fff2cd91916dd52cdf07205da2e3fa53e3e6f2))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.6.4

## [0.6.3](https://github.com/sushichan044/kg/compare/kg-viewer-v0.6.2...kg-viewer-v0.6.3) (2026-08-30)


### Features

* **composer:** model vertical novel typesetting ([#82](https://github.com/sushichan044/kg/issues/82)) ([1c69c7a](https://github.com/sushichan044/kg/commit/1c69c7aadd3e9c67dc60e7942eb3ffaa421c3e63))


### Bug Fixes

* **composer:** preserve ruby readings across line fragments ([#83](https://github.com/sushichan044/kg/issues/83)) ([e3e1e07](https://github.com/sushichan044/kg/commit/e3e1e07f7e26136f632f4170a29c50b5cdf5110d))
* **viewer:** split line-spanning ruby readings ([#77](https://github.com/sushichan044/kg/issues/77)) ([543e0ac](https://github.com/sushichan044/kg/commit/543e0ac2629c4581a4227bd7cf9c2461737fa32e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.6.3

## [0.6.2](https://github.com/sushichan044/kg/compare/kg-viewer-v0.6.1...kg-viewer-v0.6.2) (2026-08-23)


### Miscellaneous Chores

* **kg-viewer:** Synchronize kg versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.6.2

## [0.6.1](https://github.com/sushichan044/kg/compare/kg-viewer-v0.6.0...kg-viewer-v0.6.1) (2026-08-05)


### Miscellaneous Chores

* **kg-viewer:** Synchronize kg versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.6.1

## [0.6.0](https://github.com/sushichan044/kg/compare/kg-viewer-v0.5.0...kg-viewer-v0.6.0) (2026-08-04)


### Miscellaneous Chores

* **kg-viewer:** Synchronize kg versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.6.0

## [0.5.0](https://github.com/sushichan044/kg/compare/kg-viewer-v0.4.1...kg-viewer-v0.5.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* **viewer:** draw the ruling, the text, and the diagnostics as layers ([#59](https://github.com/sushichan044/kg/issues/59))

### Features

* **viewer:** draw the ruling, the text, and the diagnostics as layers ([#59](https://github.com/sushichan044/kg/issues/59)) ([a03440d](https://github.com/sushichan044/kg/commit/a03440da2e9315744cc2cdf610772536466a9e4c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.5.0

## [0.4.1](https://github.com/sushichan044/kg/compare/kg-viewer-v0.4.0...kg-viewer-v0.4.1) (2026-08-04)


### Miscellaneous Chores

* **kg-viewer:** Synchronize kg versions


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.4.1

## [0.4.0](https://github.com/sushichan044/kg/compare/kg-viewer-v0.3.0...kg-viewer-v0.4.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* **viewer:** styles.css no longer carries the only stylesheet export, IframeIsolation replaces styleOverrides with a styles injection, and the kgv-annotation-{bold,italic,ruby,emphasis} modifier classes are gone.
* separate manuscript processing stages behind typed contracts ([#43](https://github.com/sushichan044/kg/issues/43))
* **core:** `ManuscriptAppearanceSettings.marginMm` (and `MARGIN_OPTIONS`/`MarginMm`/`isMarginMm`) removed in favor of `fontSizePt`; `ManuscriptGeometry` gains `gridWidthMm`/`gridHeightMm`/`marginInlineMm`/`marginBlockMm`/`fitsPaper`. `paginateManuscript` gains an optional `ManuscriptOffsets` third parameter for document/page/stage line reservations. localStorage schema bumped to v3.

### Features

* **core:** replace minimum-margin appearance with point-based font size and line offsets ([#29](https://github.com/sushichan044/kg/issues/29)) ([21000cb](https://github.com/sushichan044/kg/commit/21000cbd448cbe6c72ce0ff02be223d148354bc0))
* extract reusable manuscript viewer packages ([#24](https://github.com/sushichan044/kg/issues/24)) ([af4647e](https://github.com/sushichan044/kg/commit/af4647e87fb42e618c1ef80a7d22f893cb89a99e))
* improve manuscript preview fidelity and sharing ([#39](https://github.com/sushichan044/kg/issues/39)) ([2822c3d](https://github.com/sushichan044/kg/commit/2822c3d33599d37da3cceaf71ddeb8942e60b069))
* **viewer:** isolate viewer styles in iframe via React portal ([#34](https://github.com/sushichan044/kg/issues/34)) ([5585998](https://github.com/sushichan044/kg/commit/5585998d5020ffc092d66928c4d55edac86159ff))
* **viewer:** make styling and zoom consumer-controlled ([#44](https://github.com/sushichan044/kg/issues/44)) ([38f3492](https://github.com/sushichan044/kg/commit/38f3492ff414bb8cfb527bf0072e7e3052464e29))
* **viewer:** share manuscript state via a context provider ([#31](https://github.com/sushichan044/kg/issues/31)) ([5bfefdb](https://github.com/sushichan044/kg/commit/5bfefdb2fde53578a25f8e4f4ba64d2f08e8fee2))


### Code Refactoring

* separate manuscript processing stages behind typed contracts ([#43](https://github.com/sushichan044/kg/issues/43)) ([4ca2eda](https://github.com/sushichan044/kg/commit/4ca2eda5eaac323c591995dc98f57a1d4b620f5c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.4.0

## [0.3.0](https://github.com/sushichan044/kg/compare/kg-viewer-v0.2.0...kg-viewer-v0.3.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* **viewer:** styles.css no longer carries the only stylesheet export, IframeIsolation replaces styleOverrides with a styles injection, and the kgv-annotation-{bold,italic,ruby,emphasis} modifier classes are gone.
* separate manuscript processing stages behind typed contracts ([#43](https://github.com/sushichan044/kg/issues/43))
* **core:** `ManuscriptAppearanceSettings.marginMm` (and `MARGIN_OPTIONS`/`MarginMm`/`isMarginMm`) removed in favor of `fontSizePt`; `ManuscriptGeometry` gains `gridWidthMm`/`gridHeightMm`/`marginInlineMm`/`marginBlockMm`/`fitsPaper`. `paginateManuscript` gains an optional `ManuscriptOffsets` third parameter for document/page/stage line reservations. localStorage schema bumped to v3.

### Features

* **core:** replace minimum-margin appearance with point-based font size and line offsets ([#29](https://github.com/sushichan044/kg/issues/29)) ([21000cb](https://github.com/sushichan044/kg/commit/21000cbd448cbe6c72ce0ff02be223d148354bc0))
* extract reusable manuscript viewer packages ([#24](https://github.com/sushichan044/kg/issues/24)) ([af4647e](https://github.com/sushichan044/kg/commit/af4647e87fb42e618c1ef80a7d22f893cb89a99e))
* improve manuscript preview fidelity and sharing ([#39](https://github.com/sushichan044/kg/issues/39)) ([2822c3d](https://github.com/sushichan044/kg/commit/2822c3d33599d37da3cceaf71ddeb8942e60b069))
* **viewer:** isolate viewer styles in iframe via React portal ([#34](https://github.com/sushichan044/kg/issues/34)) ([5585998](https://github.com/sushichan044/kg/commit/5585998d5020ffc092d66928c4d55edac86159ff))
* **viewer:** make styling and zoom consumer-controlled ([#44](https://github.com/sushichan044/kg/issues/44)) ([38f3492](https://github.com/sushichan044/kg/commit/38f3492ff414bb8cfb527bf0072e7e3052464e29))
* **viewer:** share manuscript state via a context provider ([#31](https://github.com/sushichan044/kg/issues/31)) ([5bfefdb](https://github.com/sushichan044/kg/commit/5bfefdb2fde53578a25f8e4f4ba64d2f08e8fee2))


### Code Refactoring

* separate manuscript processing stages behind typed contracts ([#43](https://github.com/sushichan044/kg/issues/43)) ([4ca2eda](https://github.com/sushichan044/kg/commit/4ca2eda5eaac323c591995dc98f57a1d4b620f5c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.3.0

## [0.2.0](https://github.com/sushichan044/kg/compare/kg-viewer-v0.1.0...kg-viewer-v0.2.0) (2026-08-03)


### ⚠ BREAKING CHANGES

* **core:** `ManuscriptAppearanceSettings.marginMm` (and `MARGIN_OPTIONS`/`MarginMm`/`isMarginMm`) removed in favor of `fontSizePt`; `ManuscriptGeometry` gains `gridWidthMm`/`gridHeightMm`/`marginInlineMm`/`marginBlockMm`/`fitsPaper`. `paginateManuscript` gains an optional `ManuscriptOffsets` third parameter for document/page/stage line reservations. localStorage schema bumped to v3.

### Features

* **core:** replace minimum-margin appearance with point-based font size and line offsets ([#29](https://github.com/sushichan044/kg/issues/29)) ([21000cb](https://github.com/sushichan044/kg/commit/21000cbd448cbe6c72ce0ff02be223d148354bc0))
* extract reusable manuscript viewer packages ([#24](https://github.com/sushichan044/kg/issues/24)) ([af4647e](https://github.com/sushichan044/kg/commit/af4647e87fb42e618c1ef80a7d22f893cb89a99e))
* improve manuscript preview fidelity and sharing ([#39](https://github.com/sushichan044/kg/issues/39)) ([2822c3d](https://github.com/sushichan044/kg/commit/2822c3d33599d37da3cceaf71ddeb8942e60b069))
* **viewer:** isolate viewer styles in iframe via React portal ([#34](https://github.com/sushichan044/kg/issues/34)) ([5585998](https://github.com/sushichan044/kg/commit/5585998d5020ffc092d66928c4d55edac86159ff))
* **viewer:** share manuscript state via a context provider ([#31](https://github.com/sushichan044/kg/issues/31)) ([5bfefdb](https://github.com/sushichan044/kg/commit/5bfefdb2fde53578a25f8e4f4ba64d2f08e8fee2))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.2.0

## [0.1.0](https://github.com/sushichan044/kg/compare/kg-viewer-v0.0.5...kg-viewer-v0.1.0) (2026-08-01)


### ⚠ BREAKING CHANGES

* **core:** `ManuscriptAppearanceSettings.marginMm` (and `MARGIN_OPTIONS`/`MarginMm`/`isMarginMm`) removed in favor of `fontSizePt`; `ManuscriptGeometry` gains `gridWidthMm`/`gridHeightMm`/`marginInlineMm`/`marginBlockMm`/`fitsPaper`. `paginateManuscript` gains an optional `ManuscriptOffsets` third parameter for document/page/stage line reservations. localStorage schema bumped to v3.

### Features

* **core:** replace minimum-margin appearance with point-based font size and line offsets ([#29](https://github.com/sushichan044/kg/issues/29)) ([21000cb](https://github.com/sushichan044/kg/commit/21000cbd448cbe6c72ce0ff02be223d148354bc0))
* extract reusable manuscript viewer packages ([#24](https://github.com/sushichan044/kg/issues/24)) ([af4647e](https://github.com/sushichan044/kg/commit/af4647e87fb42e618c1ef80a7d22f893cb89a99e))
* **viewer:** isolate viewer styles in iframe via React portal ([#34](https://github.com/sushichan044/kg/issues/34)) ([5585998](https://github.com/sushichan044/kg/commit/5585998d5020ffc092d66928c4d55edac86159ff))
* **viewer:** share manuscript state via a context provider ([#31](https://github.com/sushichan044/kg/issues/31)) ([5bfefdb](https://github.com/sushichan044/kg/commit/5bfefdb2fde53578a25f8e4f4ba64d2f08e8fee2))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @sushichan044/kg-core bumped to 0.1.0
