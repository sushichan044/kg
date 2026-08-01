# Changelog

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
