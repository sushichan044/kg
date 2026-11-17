# Changelog

## [0.12.0](https://github.com/sushichan044/kg/compare/v0.11.0...v0.12.0) (2026-11-17)


### ⚠ BREAKING CHANGES

* FontPresetId no longer accepts "gothic", and FontPreset no longer has a measurement field.

### Features

* **core:** add Shaper port and shaped run measurer ([f8a5169](https://github.com/sushichan044/kg/commit/f8a516910f82a7c32ba79f163a1c4c2bf60f5e87))
* **core:** report the horizontal advance of tate-chu-yoko units ([dd9f86d](https://github.com/sushichan044/kg/commit/dd9f86d2d5993d5c4877682e91d4048ca0ae9478)), closes [#210](https://github.com/sushichan044/kg/issues/210)
* **core:** resolve glyph orientation for mixed vertical text ([7a6fbb3](https://github.com/sushichan044/kg/commit/7a6fbb389f47b8252b8bce7b131254081b1cd496)), closes [#191](https://github.com/sushichan044/kg/issues/191)
* **core:** resolve glyph orientation for mixed vertical text ([30f1449](https://github.com/sushichan044/kg/commit/30f14495a94bf191dec4af67c58453e904ad8838)), closes [#191](https://github.com/sushichan044/kg/issues/191)
* **frontend:** encode export PNGs and zip in a Web Worker ([293100b](https://github.com/sushichan044/kg/commit/293100b4c0ff9f0872c51bfddb89c651cffca387))
* **frontend:** encode export PNGs and zip in a Web Worker ([418d8aa](https://github.com/sushichan044/kg/commit/418d8aadab59472e83f3c82b53b1eb35c2b55a5b))
* **frontend:** use the viewer's worker-backed manuscript hook ([a493c75](https://github.com/sushichan044/kg/commit/a493c75a34f6b83e1a68e5c5d2515f21db3551f7))
* measure runs from font files with a Shaper port ([4f9e1ee](https://github.com/sushichan044/kg/commit/4f9e1eebef1dd720093cd69cf3a1a17161ba3b97))
* **viewer:** add DOM-free harfbuzzjs Shaper adapter ([0a2a288](https://github.com/sushichan044/kg/commit/0a2a288118f35210f8581d58688b3d5166936da0))
* **viewer:** compose and proofread manuscripts in a Web Worker ([81d33e5](https://github.com/sushichan044/kg/commit/81d33e5cc1f3b1b977c17ffca04ff4d9d85e7cb5))
* **viewer:** measure with the harfbuzz shaper and pin mixed glyph orientation ([b4c7b41](https://github.com/sushichan044/kg/commit/b4c7b41a9ebf4a7671cea4c7b004cbe0b7e747fe))
* **viewer:** run the manuscript pipeline in a Web Worker ([ad2cc01](https://github.com/sushichan044/kg/commit/ad2cc01048f9461328e1a5017500e3f0febcf282))
* **viewer:** switch measurement to the font-file shaper ([85312be](https://github.com/sushichan044/kg/commit/85312be653432991dcdbbdc12fa82826ade95c12))
* **worker-rpc:** add typed Web Worker RPC package ([daf1c7f](https://github.com/sushichan044/kg/commit/daf1c7fca52d58aa87e84ceddcf7863987c74750))


### Bug Fixes

* **core:** give uncovered ruby graphemes a full-width advance ([2d8b9c3](https://github.com/sushichan044/kg/commit/2d8b9c3f8e6668584b00c0a36e522feeec5368f7))
* **core:** keep shaped clusters on grapheme boundaries ([a3d840d](https://github.com/sushichan044/kg/commit/a3d840db434f7efa9d9583499c85eec82798428a))
* **core:** reject empty graphemes for every presentation ([d4279b0](https://github.com/sushichan044/kg/commit/d4279b00437fc64df1a38ae3ff7cdcd330591aa8))
* **core:** reject empty graphemes for every presentation ([3d576e3](https://github.com/sushichan044/kg/commit/3d576e3040d9c2454128a084bec8d56823a43bdc))
* **core:** ルビの収録外の字を全角幅で組む ([4b96e2a](https://github.com/sushichan044/kg/commit/4b96e2a5f24ff6f3e810e1de5ebbb3cba938b96e))
* **frontend:** block export of a result retained from another source ([fd96cc9](https://github.com/sushichan044/kg/commit/fd96cc9e967d26aacbef39667f69ab515665ed9e))
* **frontend:** block export while a failure leaves a stale result ([fedf56f](https://github.com/sushichan044/kg/commit/fedf56f34cf628503be2a6401d20dcecaab93566))
* **frontend:** restore saved Gothic preferences with the default typeface ([2126a50](https://github.com/sushichan044/kg/commit/2126a50aa0d95cc8eb0a941cf8121e3987096af4))
* **frontend:** surface export worker failures and close it without `using` ([121d783](https://github.com/sushichan044/kg/commit/121d783cb26fd1d6dc6a10c62aefbf175648f9ee))
* remove the Gothic font preset ([1dc2ed9](https://github.com/sushichan044/kg/commit/1dc2ed967b369a4f72bc1d6f37b4a81ad4492fef))
* **scripts:** handle missing module docstring in vertical orientation generator ([7fbf741](https://github.com/sushichan044/kg/commit/7fbf741754fbac250b1cb8a010db6188a6bc523f))
* **scripts:** handle missing module docstring in vertical orientation generator ([5c95fb4](https://github.com/sushichan044/kg/commit/5c95fb47cb147d4e0475e10e70fdb5e76458f019))
* **viewer:** center fallback glyphs in a horizontal box independent of font vertical metrics ([c6b4273](https://github.com/sushichan044/kg/commit/c6b4273425ee8cf9c9987f3e0a8220038e38fa52))
* **viewer:** draw logically measured Western glyphs at half width ([d27f7cf](https://github.com/sushichan044/kg/commit/d27f7cfd60960fd4227509021085221a38c216f8))
* **viewer:** draw tate-chu-yoko as compressed horizontal text ([fd8d8b8](https://github.com/sushichan044/kg/commit/fd8d8b853b1b4f792186c2540bb86afdd38cdce7)), closes [#210](https://github.com/sushichan044/kg/issues/210)
* **viewer:** draw upright half-width forms at their composed advance ([89a072e](https://github.com/sushichan044/kg/commit/89a072e90d474284549fa868ee6b543de17a0d15))
* **viewer:** draw upright half-width forms at their composed advance ([6199d1f](https://github.com/sushichan044/kg/commit/6199d1f12a1a5f7d84c3afe4f0cb3d99361e468f))
* **viewer:** keep a half-width mark in the one-em cell of its base ([527f9ac](https://github.com/sushichan044/kg/commit/527f9acca106f32e3a31af9af8cedfbb6ff724a5))
* **viewer:** keep a new connection's font load when an old one fails ([9a5d2b9](https://github.com/sushichan044/kg/commit/9a5d2b9346489fb111033993328eadab0fb68505))
* **viewer:** keep blank manuscript lines when copying ([a18ee7e](https://github.com/sushichan044/kg/commit/a18ee7e1105227257a641e278b10400a2f724ad9))
* **viewer:** keep paragraph newlines when copying shrunk paragraph ends ([2efdb6e](https://github.com/sushichan044/kg/commit/2efdb6ec6e8ae422cb068ec19d84e259a156d450))
* **viewer:** keep the displayed typography alive across reconnection ([4a4c146](https://github.com/sushichan044/kg/commit/4a4c1461f0db55be137221149c7b1d5c54b7715e))
* **viewer:** keep upright half-width ruby at its advance as generated content ([2210c39](https://github.com/sushichan044/kg/commit/2210c397063f9f739ff2d18bbe0b46060d1ce2dd))
* **viewer:** make selected and copied text match the manuscript ([9efee98](https://github.com/sushichan044/kg/commit/9efee98ad0a1beb5b8bcc0db04a6f44f6fa19474))
* **viewer:** make selected and copied text match the manuscript ([65e4061](https://github.com/sushichan044/kg/commit/65e4061fd6c21a7932c70a70a0074e50738d7b5e)), closes [#206](https://github.com/sushichan044/kg/issues/206)
* **viewer:** reprocess the latest input when reconnecting an engine ([bfd4b34](https://github.com/sushichan044/kg/commit/bfd4b346aa727ce15c8c2cd2a3c383d689d9cf23))
* **viewer:** treat a worker stopped by messageerror as dead ([ee876aa](https://github.com/sushichan044/kg/commit/ee876aa680e4a135f3e4aeed5429208ff11588dc))
* **viewer:** 収録外の正立字を代替フォントだけで描いてこまの中央に置く ([8024568](https://github.com/sushichan044/kg/commit/8024568cac7b14b5d3d1f6e6cacd64c2ab0c4bed)), closes [#219](https://github.com/sushichan044/kg/issues/219)
* **viewer:** 縦中横を text-combine-upright を使わずに描く ([cff0916](https://github.com/sushichan044/kg/commit/cff0916a29a55b6df4f386840ffa64b58068c59a))
* **viewer:** 縦書きで正立させた収録外の欧字を字幅の中央に置く ([ce7483b](https://github.com/sushichan044/kg/commit/ce7483b7fcda6edf5f058514e154c197d47ecc44))
* **worker-rpc:** reject pending calls when the client closes ([a285bc2](https://github.com/sushichan044/kg/commit/a285bc293af81ff4dee9225abf426ca214f96eac))


### Performance Improvements

* **core:** look up grapheme ends once per run ([48bff7a](https://github.com/sushichan044/kg/commit/48bff7a308bc198b5a05de86a3279fe6dfed9a89))


### Reverts

* **viewer:** drop the half-width workaround for logically measured glyphs ([24c0f16](https://github.com/sushichan044/kg/commit/24c0f1699db502369236c539364cc96fe9fc83f1))

## [0.11.0](https://github.com/sushichan044/kg/compare/v0.10.2...v0.11.0) (2026-11-11)


### ⚠ BREAKING CHANGES

* **viewer:** useTypography requires a TypographyProvider and a Suspense boundary above it. TypographyState no longer has a "loading" kind, and retry exists only on the failed state. TypographyStatus is no longer exported; render the Suspense fallback and the retry control in the consumer.
* **viewer:** @sushichan044/kg-viewer now requires react and react-dom ^19.2.0.

### Features

* **frontend:** run file and font switches as transitions ([3f82e7d](https://github.com/sushichan044/kg/commit/3f82e7d142cfb8c504d438adb6d764e81d845c9f))
* **viewer:** require React 19.2 or later ([80affd2](https://github.com/sushichan044/kg/commit/80affd2472611b2bfb5068f92214c6ba7408f232))
* **viewer:** suspend in useTypography while the font loads ([ae9900e](https://github.com/sushichan044/kg/commit/ae9900e6b82a4a91d626fb35384662bd3b2fd3da))


### Bug Fixes

* **core:** detect halfwidth punctuation beside astral kanji ([401d92c](https://github.com/sushichan044/kg/commit/401d92c53516479ce151bcbdfc2d9beefd76266b))
* **frontend:** keep the fetched catalog when the manuscript fails to load ([ed42bd5](https://github.com/sushichan044/kg/commit/ed42bd5e09d8d741f5ddbc5824b57307964aa41a))
* **frontend:** restore the saved page when the viewer appears after a font retry ([e07bb3b](https://github.com/sushichan044/kg/commit/e07bb3b6e1f6c2e59e6c9f6efa394eae60a5c2b0))
* **frontend:** show load failures instead of a stale or empty manuscript ([555f953](https://github.com/sushichan044/kg/commit/555f953e8b4e3a1bb556a2761ee02c73297fd004))
* harden the local server and clean up audit findings ([a36c90e](https://github.com/sushichan044/kg/commit/a36c90e8bdffb42f95262a0c290497daab58451d))
* **server:** keep listing files when a root is missing or unreadable ([a29a15a](https://github.com/sushichan044/kg/commit/a29a15ae4e5b03a812bd81c2dff0aed4ec495a66))
* **server:** reject requests that do not target the loopback origin ([d1d683e](https://github.com/sushichan044/kg/commit/d1d683e81c446f2f5edaa06d1fa7a75694fbbfc4))
* **viewer:** let any consumer of a shared font cache retry a failed load ([f893bc5](https://github.com/sushichan044/kg/commit/f893bc58750e91022937474156b25de530f3488c))
* **viewer:** type the font asset exports and correct the DOM contract docs ([f0aea46](https://github.com/sushichan044/kg/commit/f0aea4606b067e0936369aae66ae9eab996817a4))


### Performance Improvements

* **frontend:** defer composition changes and leave memoization to the React Compiler ([7e613eb](https://github.com/sushichan044/kg/commit/7e613eb5188cc671560a5bef4c1ecdfcef49165a))
* **frontend:** defer composition changes and leave memoization to the React Compiler ([8630ec8](https://github.com/sushichan044/kg/commit/8630ec81052b2026920a8f14cc5d4f9502c3b761))
* **viewer:** load the shaper while fonts download ([95b952c](https://github.com/sushichan044/kg/commit/95b952c42f15114887d0da3801019866e3d3aaa0))
* **viewer:** stop rebuilding every page on zoom and diagnostic selection ([af1be4c](https://github.com/sushichan044/kg/commit/af1be4c056e9fc85f865f5cec2b3ce26894ad452))

## [0.10.2](https://github.com/sushichan044/kg/compare/v0.10.1...v0.10.2) (2026-11-03)


### Features

* **viewer:** add folios and print-ready PNG export ([73ae4bc](https://github.com/sushichan044/kg/commit/73ae4bcb225d05d8d2785057d5ab61598ee19f6d))
* **viewer:** add folios and print-ready PNG export ([90a3d75](https://github.com/sushichan044/kg/commit/90a3d755eceeadf321e281ca16940a3aae98ac18))


### Bug Fixes

* **export:** reject images with incorrect dimensions ([3eda4e1](https://github.com/sushichan044/kg/commit/3eda4e117f8d2d2dbe6e9480ed48a2c7087a7797))

## [0.10.1](https://github.com/sushichan044/kg/compare/v0.10.0...v0.10.1) (2026-11-03)


### Bug Fixes

* **core:** avoid excessive spacing in paragraph composition ([1c48557](https://github.com/sushichan044/kg/commit/1c4855702b4147936a3c6c2f945310a35787b849))
* **core:** compare expansion badness with an em-scale tolerance ([2c2775f](https://github.com/sushichan044/kg/commit/2c2775fe4b89f3bf90773f75354e1d64ebd20a44))
* **core:** penalize excessive paragraph spacing before line counts ([968e5b4](https://github.com/sushichan044/kg/commit/968e5b420852567ffa4e5343fc69825b98367179))
* **core:** sum final expansion badness across all gaps ([e785c2e](https://github.com/sushichan044/kg/commit/e785c2e83e14fa921149011a2c8d04c68d7a3144))

## [0.10.0](https://github.com/sushichan044/kg/compare/v0.9.3...v0.10.0) (2026-11-03)


### ⚠ BREAKING CHANGES

* **frontend:** Diagnostic bands are decorative spans. Custom themes must target .kgv-diagnostic-trigger, .kgv-diagnostic-message, and .kgv-diagnostic-jump for controls and messages. Named manuscript presets have been removed.

### Features

* **frontend:** add a standalone mock development environment ([5c7b51d](https://github.com/sushichan044/kg/commit/5c7b51d5459dc2bf9e25917ed99677f8e577db7e))
* **frontend:** refine writing controls and diagnostic overlays ([ac826ff](https://github.com/sushichan044/kg/commit/ac826ffccc60f1a574742378973e6e84186acefd))
* **frontend:** streamline the writing workspace ([929b5d5](https://github.com/sushichan044/kg/commit/929b5d5f810beae4f61acec7d4af8a932a637118))

## [0.9.3](https://github.com/sushichan044/kg/compare/v0.9.2...v0.9.3) (2026-11-02)


### Features

* **typography:** share font preparation and add Rin Mincho ([2013524](https://github.com/sushichan044/kg/commit/20135242245e0390afc388c376e637e50eb8dfbf))
* **typography:** share font preparation and measured composition ([e7c1f7d](https://github.com/sushichan044/kg/commit/e7c1f7def156eff4f85d84279b427d1fe1cc495c))
* **viewer:** add optional spreads with configurable starting side ([15415e8](https://github.com/sushichan044/kg/commit/15415e86f000ac6599239434f4df270681cf0b88))
* **viewer:** add optional spreads with configurable starting side ([72f3dac](https://github.com/sushichan044/kg/commit/72f3dac7373bf680d7151c6db6c3b3b77610a642))


### Bug Fixes

* **viewer:** persist spread preferences and strengthen fit coverage ([99ed671](https://github.com/sushichan044/kg/commit/99ed6713baecb5fc8cf0a5e4135b474ba013bc26))
* **viewer:** recover from rejected typography setup ([b53828f](https://github.com/sushichan044/kg/commit/b53828f380312ef2c2ab884ec26d99ae3c1b6ff9))

## [0.9.2](https://github.com/sushichan044/kg/compare/v0.9.1...v0.9.2) (2026-10-29)


### Features

* **composition:** add fixed A6 41-character format ([a88ad23](https://github.com/sushichan044/kg/commit/a88ad2344ea5867ca73dfe64628bd6bec63c77c6))
* **composition:** add fixed A6 41-character format ([1f4ef58](https://github.com/sushichan044/kg/commit/1f4ef586b068da6c45cb25452f78e12e29e94507))
* **core:** support configurable sentence-ending symbols ([52b358b](https://github.com/sushichan044/kg/commit/52b358b3ab4a65fe453aed0a84fafb0c4d38c71c))
* **core:** support configurable sentence-ending symbols ([f92a796](https://github.com/sushichan044/kg/commit/f92a796c4dcf805f2449bc077f8290c25086d772))


### Bug Fixes

* **composition:** set A6 line gaps to 7H ([f79eaf0](https://github.com/sushichan044/kg/commit/f79eaf0eb6b1c2aa6e0c6fc5a024fc47bb904183))
* **composition:** use 16mm inner and 10mm outer A6 margins ([fc6f033](https://github.com/sushichan044/kg/commit/fc6f033ed79e78aebfcfebbb960e9bd4ab952a6e))
* **core:** handle configured sentence-ending graphemes consistently ([749a104](https://github.com/sushichan044/kg/commit/749a1044de99db974a05c35535094e65b0a6c936))

## [0.9.1](https://github.com/sushichan044/kg/compare/v0.9.0...v0.9.1) (2026-10-14)


### Features

* **viewer:** use white paper and black text with cyan ruling ([038455a](https://github.com/sushichan044/kg/commit/038455a0a4eb0327741f90af3b57d3fd2344186e))
* **viewer:** use white paper and black text with cyan ruling ([5112ca2](https://github.com/sushichan044/kg/commit/5112ca2dda996e2c823d3386b1c66bdc41734722))

## [0.9.0](https://github.com/sushichan044/kg/compare/v0.8.2...v0.9.0) (2026-10-13)


### ⚠ BREAKING CHANGES

* **typesetting:** Replace fontSizePt with fontSizeQ in settings and measurement requests, require page dimensions in millimetres, and ignore previous saved preferences without migration.

### Features

* **typesetting:** use Q and mm with a fixed A5 format ([fab83d7](https://github.com/sushichan044/kg/commit/fab83d723ccc5d63cbf7305040b88ef7ac53a0d9))

## [0.8.2](https://github.com/sushichan044/kg/compare/v0.8.1...v0.8.2) (2026-10-12)


### Bug Fixes

* **core:** keep ASCII sentences consistently sideways ([55f6f2d](https://github.com/sushichan044/kg/commit/55f6f2dbce86c36496aaa3b9d2d1574385d51276))
* **core:** keep ASCII sentences consistently sideways ([a32700c](https://github.com/sushichan044/kg/commit/a32700ca3854d45a9f8591fc9ceeaaed5bbde8c4))
* **core:** preserve standalone dotted abbreviations ([c622877](https://github.com/sushichan044/kg/commit/c62287706d1b0216790437393596d541b5955664))

## [0.8.1](https://github.com/sushichan044/kg/compare/v0.8.0...v0.8.1) (2026-10-11)


### Features

* **core:** combine runs of two or three exclamation or question marks as tate-chu-yoko ([5fe082e](https://github.com/sushichan044/kg/commit/5fe082e3532db2c68836b6b352f1595de1ec4d7d))
* **core:** combine runs of two or three exclamation or question marks as tate-chu-yoko ([31c56fc](https://github.com/sushichan044/kg/commit/31c56fcceca5ea25c80cdbf977f73915cd7f96d0))


### Bug Fixes

* **core:** keep combined exclamation runs out of the line head ([5c02f16](https://github.com/sushichan044/kg/commit/5c02f1653c301fb134836c21a755374e88123909))

## [0.8.0](https://github.com/sushichan044/kg/compare/v0.7.5...v0.8.0) (2026-10-09)


### ⚠ BREAKING CHANGES

* **viewer:** The viewer requires ADR 0006 phase 3 core snapshots. Upgrade core and viewer together; legacy per-grapheme combination has no adapter.
* **core:** NovelLine uses explicit single/combined units, exact/shared source placements, and positioned ruby/emphasis. Plugin measurers now accept run requests and return advance or clustered results; the old glyph, presentation-group, and inline-measurement contracts are removed.

### Features

* **core:** allocate group readings through paragraph continuation states ([b1d953a](https://github.com/sushichan044/kg/commit/b1d953a7257fd0a97f844b7d4252fdb835e09fe9))
* **core:** apply proportional jukugo ruby spacing ([5352e45](https://github.com/sushichan044/kg/commit/5352e45a3fe67a6ca64b5a05cf0693a78b2c5020))
* **core:** check ruby and emphasis clearance before scoring ([47bddbf](https://github.com/sushichan044/kg/commit/47bddbfbcc6ea539e92bc81b40c53ddfe4aa4576))
* **core:** enforce fixed-pitch ruby and emphasis clearance before scoring ([82b5492](https://github.com/sushichan044/kg/commit/82b5492158b8e684b98e083301ef49e53684c849))
* **core:** jointly arrange jukugo readings within candidate lines ([090b19f](https://github.com/sushichan044/kg/commit/090b19fda19a2608c12607f4adfb6753c91ae765))
* **core:** refine jukugo ruby placement and spacing ([e04cd0d](https://github.com/sushichan044/kg/commit/e04cd0d9ea7462c07be10be7c678ba82e69d9b9e))
* **core:** resolve contextual mono and group ruby before line scoring ([719d28c](https://github.com/sushichan044/kg/commit/719d28cf30d40ba5e03670a3441fccd756e93069))
* **core:** resolve contextual mono and group ruby before scoring ([13d5c65](https://github.com/sushichan044/kg/commit/13d5c657f5738e84ed1395cb42dd0f7b5bac5eb0))
* **core:** resolve contextual ruby and binding boundaries ([3a89326](https://github.com/sushichan044/kg/commit/3a89326c98fec14fa32d04ac79843f5e2a43810c))
* **core:** resolve contextual ruby and binding boundaries ([d6b23da](https://github.com/sushichan044/kg/commit/d6b23daa987782e8312b5616b8a4ac3eec662abd))


### Performance Improvements

* **core:** index ruby fragments during source validation ([45d2588](https://github.com/sushichan044/kg/commit/45d2588b70b4ac2af7e46600f0b7d27f54a532b2))
* **core:** reuse candidate lines across fitness states ([6650c82](https://github.com/sushichan044/kg/commit/6650c82c3ea3e604c1df1d78a5a7bb59251cc349))


### Code Refactoring

* **core:** publish ADR 0006 layout and measurement contracts ([e09dc85](https://github.com/sushichan044/kg/commit/e09dc85a0e8d997b43b2718f7bceb2c840c1fd21))
* **viewer:** consume composer-owned render units and decorations ([2fedd3c](https://github.com/sushichan044/kg/commit/2fedd3c2f3eef958e3c12b4d296e63b3471da4b7))

## [0.7.5](https://github.com/sushichan044/kg/compare/v0.7.4...v0.7.5) (2026-10-08)


### Bug Fixes

* **core:** measure compound punctuation on a full em ([a99554b](https://github.com/sushichan044/kg/commit/a99554b6f8d000372e3397a8a4411166162c2d04))
* **core:** prevent compound punctuation from overlapping closing brackets ([fb6cc61](https://github.com/sushichan044/kg/commit/fb6cc61f670f2783dc936d609ce146796d22baff))

## [0.7.4](https://github.com/sushichan044/kg/compare/v0.7.3...v0.7.4) (2026-09-10)


### Features

* compile viewer and internal frontend with React Compiler ([6bda522](https://github.com/sushichan044/kg/commit/6bda52229d4b505adb3facd02b6e735457447ba0))

## [0.7.3](https://github.com/sushichan044/kg/compare/v0.7.2...v0.7.3) (2026-09-10)


### Bug Fixes

* **core:** set upright Latin against kana solid, per JLReq 3.2.4 ([9e9fce1](https://github.com/sushichan044/kg/commit/9e9fce10b0d1e159ed2beb03239d05b79607837e))
* **core:** set upright Latin against kana solid, per JLReq 3.2.4 ([6029441](https://github.com/sushichan044/kg/commit/6029441a46aed9e24aad789d5467fc10bb741e90))

## [0.7.2](https://github.com/sushichan044/kg/compare/v0.7.1...v0.7.2) (2026-09-10)


### Features

* **core:** apply JLReq final spacing expansion ([a374bb5](https://github.com/sushichan044/kg/commit/a374bb55f09767a0f93f5e1170c99c5aa47e3d35))
* **core:** implement JLReq final spacing expansion ([227b08c](https://github.com/sushichan044/kg/commit/227b08cd953f328dc6383c47a097b1994f39c061))


### Bug Fixes

* **core:** preserve finite spacing limits ([5663421](https://github.com/sushichan044/kg/commit/56634212917295cccf0befdce41a0265108bb302))


### Performance Improvements

* **core:** speed up paragraph line-break optimizer's hot path ([263abc9](https://github.com/sushichan044/kg/commit/263abc92665e6c9f04b4ee08e4511c916e54836d))

## [0.7.1](https://github.com/sushichan044/kg/compare/v0.7.0...v0.7.1) (2026-09-10)


### Bug Fixes

* **viewer:** remove masu-me-era glyph shrink, render glyphs at full cell size ([1c2b423](https://github.com/sushichan044/kg/commit/1c2b423209d68548c64c68bc3ff4eb2dd0e0df2e))
* **viewer:** remove masu-me-era glyph shrink, render glyphs at full cell size ([bc80398](https://github.com/sushichan044/kg/commit/bc803987445abb4c4b81415648fb2706bc8d2f6b))
* **viewer:** widen upright glyph bounds tolerance for font-metric variance ([d48dc42](https://github.com/sushichan044/kg/commit/d48dc424ef4fa7c054f0363ea92bddb3f894ab9c))

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
