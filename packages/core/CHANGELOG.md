# Changelog

## [0.4.0](https://github.com/sushichan044/kg/compare/kg-core-v0.3.0...kg-core-v0.4.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* **viewer:** styles.css no longer carries the only stylesheet export, IframeIsolation replaces styleOverrides with a styles injection, and the kgv-annotation-{bold,italic,ruby,emphasis} modifier classes are gone.
* separate manuscript processing stages behind typed contracts ([#43](https://github.com/sushichan044/kg/issues/43))
* **core:** `ManuscriptAppearanceSettings.marginMm` (and `MARGIN_OPTIONS`/`MarginMm`/`isMarginMm`) removed in favor of `fontSizePt`; `ManuscriptGeometry` gains `gridWidthMm`/`gridHeightMm`/`marginInlineMm`/`marginBlockMm`/`fitsPaper`. `paginateManuscript` gains an optional `ManuscriptOffsets` third parameter for document/page/stage line reservations. localStorage schema bumped to v3.

### Features

* **core:** replace minimum-margin appearance with point-based font size and line offsets ([#29](https://github.com/sushichan044/kg/issues/29)) ([21000cb](https://github.com/sushichan044/kg/commit/21000cbd448cbe6c72ce0ff02be223d148354bc0))
* extract reusable manuscript viewer packages ([#24](https://github.com/sushichan044/kg/issues/24)) ([af4647e](https://github.com/sushichan044/kg/commit/af4647e87fb42e618c1ef80a7d22f893cb89a99e))
* improve manuscript preview fidelity and sharing ([#39](https://github.com/sushichan044/kg/issues/39)) ([2822c3d](https://github.com/sushichan044/kg/commit/2822c3d33599d37da3cceaf71ddeb8942e60b069))
* **viewer:** make styling and zoom consumer-controlled ([#44](https://github.com/sushichan044/kg/issues/44)) ([38f3492](https://github.com/sushichan044/kg/commit/38f3492ff414bb8cfb527bf0072e7e3052464e29))
* **viewer:** share manuscript state via a context provider ([#31](https://github.com/sushichan044/kg/issues/31)) ([5bfefdb](https://github.com/sushichan044/kg/commit/5bfefdb2fde53578a25f8e4f4ba64d2f08e8fee2))


### Code Refactoring

* separate manuscript processing stages behind typed contracts ([#43](https://github.com/sushichan044/kg/issues/43)) ([4ca2eda](https://github.com/sushichan044/kg/commit/4ca2eda5eaac323c591995dc98f57a1d4b620f5c))

## [0.3.0](https://github.com/sushichan044/kg/compare/kg-core-v0.2.0...kg-core-v0.3.0) (2026-08-04)


### ⚠ BREAKING CHANGES

* **viewer:** styles.css no longer carries the only stylesheet export, IframeIsolation replaces styleOverrides with a styles injection, and the kgv-annotation-{bold,italic,ruby,emphasis} modifier classes are gone.
* separate manuscript processing stages behind typed contracts ([#43](https://github.com/sushichan044/kg/issues/43))
* **core:** `ManuscriptAppearanceSettings.marginMm` (and `MARGIN_OPTIONS`/`MarginMm`/`isMarginMm`) removed in favor of `fontSizePt`; `ManuscriptGeometry` gains `gridWidthMm`/`gridHeightMm`/`marginInlineMm`/`marginBlockMm`/`fitsPaper`. `paginateManuscript` gains an optional `ManuscriptOffsets` third parameter for document/page/stage line reservations. localStorage schema bumped to v3.

### Features

* **core:** replace minimum-margin appearance with point-based font size and line offsets ([#29](https://github.com/sushichan044/kg/issues/29)) ([21000cb](https://github.com/sushichan044/kg/commit/21000cbd448cbe6c72ce0ff02be223d148354bc0))
* extract reusable manuscript viewer packages ([#24](https://github.com/sushichan044/kg/issues/24)) ([af4647e](https://github.com/sushichan044/kg/commit/af4647e87fb42e618c1ef80a7d22f893cb89a99e))
* improve manuscript preview fidelity and sharing ([#39](https://github.com/sushichan044/kg/issues/39)) ([2822c3d](https://github.com/sushichan044/kg/commit/2822c3d33599d37da3cceaf71ddeb8942e60b069))
* **viewer:** make styling and zoom consumer-controlled ([#44](https://github.com/sushichan044/kg/issues/44)) ([38f3492](https://github.com/sushichan044/kg/commit/38f3492ff414bb8cfb527bf0072e7e3052464e29))
* **viewer:** share manuscript state via a context provider ([#31](https://github.com/sushichan044/kg/issues/31)) ([5bfefdb](https://github.com/sushichan044/kg/commit/5bfefdb2fde53578a25f8e4f4ba64d2f08e8fee2))


### Code Refactoring

* separate manuscript processing stages behind typed contracts ([#43](https://github.com/sushichan044/kg/issues/43)) ([4ca2eda](https://github.com/sushichan044/kg/commit/4ca2eda5eaac323c591995dc98f57a1d4b620f5c))

## [0.2.0](https://github.com/sushichan044/kg/compare/kg-core-v0.1.0...kg-core-v0.2.0) (2026-08-03)


### ⚠ BREAKING CHANGES

* **core:** `ManuscriptAppearanceSettings.marginMm` (and `MARGIN_OPTIONS`/`MarginMm`/`isMarginMm`) removed in favor of `fontSizePt`; `ManuscriptGeometry` gains `gridWidthMm`/`gridHeightMm`/`marginInlineMm`/`marginBlockMm`/`fitsPaper`. `paginateManuscript` gains an optional `ManuscriptOffsets` third parameter for document/page/stage line reservations. localStorage schema bumped to v3.

### Features

* **core:** replace minimum-margin appearance with point-based font size and line offsets ([#29](https://github.com/sushichan044/kg/issues/29)) ([21000cb](https://github.com/sushichan044/kg/commit/21000cbd448cbe6c72ce0ff02be223d148354bc0))
* extract reusable manuscript viewer packages ([#24](https://github.com/sushichan044/kg/issues/24)) ([af4647e](https://github.com/sushichan044/kg/commit/af4647e87fb42e618c1ef80a7d22f893cb89a99e))
* improve manuscript preview fidelity and sharing ([#39](https://github.com/sushichan044/kg/issues/39)) ([2822c3d](https://github.com/sushichan044/kg/commit/2822c3d33599d37da3cceaf71ddeb8942e60b069))
* **viewer:** share manuscript state via a context provider ([#31](https://github.com/sushichan044/kg/issues/31)) ([5bfefdb](https://github.com/sushichan044/kg/commit/5bfefdb2fde53578a25f8e4f4ba64d2f08e8fee2))

## [0.1.0](https://github.com/sushichan044/kg/compare/kg-core-v0.0.5...kg-core-v0.1.0) (2026-08-01)


### ⚠ BREAKING CHANGES

* **core:** `ManuscriptAppearanceSettings.marginMm` (and `MARGIN_OPTIONS`/`MarginMm`/`isMarginMm`) removed in favor of `fontSizePt`; `ManuscriptGeometry` gains `gridWidthMm`/`gridHeightMm`/`marginInlineMm`/`marginBlockMm`/`fitsPaper`. `paginateManuscript` gains an optional `ManuscriptOffsets` third parameter for document/page/stage line reservations. localStorage schema bumped to v3.

### Features

* **core:** replace minimum-margin appearance with point-based font size and line offsets ([#29](https://github.com/sushichan044/kg/issues/29)) ([21000cb](https://github.com/sushichan044/kg/commit/21000cbd448cbe6c72ce0ff02be223d148354bc0))
* extract reusable manuscript viewer packages ([#24](https://github.com/sushichan044/kg/issues/24)) ([af4647e](https://github.com/sushichan044/kg/commit/af4647e87fb42e618c1ef80a7d22f893cb89a99e))
* **viewer:** share manuscript state via a context provider ([#31](https://github.com/sushichan044/kg/issues/31)) ([5bfefdb](https://github.com/sushichan044/kg/commit/5bfefdb2fde53578a25f8e4f4ba64d2f08e8fee2))
