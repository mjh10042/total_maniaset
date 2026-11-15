# ManiaMapAnalyser computation modules (vendored)

The `js/` folder is a copy of the computation part of **ManiaMapAnalyser 2.1.0**
by **Leo_Black** — https://github.com/LeoBlackMT/osumania_map_analyser — MIT License (see `LICENSE`).
It is unmodified except for one addition: an optional `withParts` output in `js/rework/sunnyAlgorithm.js`
(5 lines, marked "total_maniaset" in the file; used by `shared/engine/live_model.js`).

total_maniaset runs its `runAnalysisPipeline` (Mixed estimator) + Companella fusion in the dan engine
worker (`shared/engine/worker.js`, via `shared/engine/mma_bridge.js`) for 4K charts, and shows its rice
estimate alone or averaged with DanOverlay 2.3.5, and its LN level alone or averaged with total_maniaset's
LN Course model (setting "4K 계산 엔진").

Copied: `js/estimator`, `js/rework`, `js/parser`, `js/ett`, `js/patterns`, `js/interlude`, `js/pipeline`.
Left out: the overlay app itself (`js/app`, incl. its anonymous usage statistics), `js/debug`, the settings and
preset pages, styles, `js/patterns/chartVibro.js` (UI only, imports the app config) and
`js/estimator/companella/ort/ort.node.min.mjs` (Node.js-only entry of ONNX Runtime).

Third-party parts it carries, as credited by ManiaMapAnalyser (their notices are in total_maniaset's `LICENSE`):
- Etterna MinaCalc (WebAssembly builds in `js/ett/versions`) — https://github.com/etternagame/etterna, MIT
- Sunny Rework (Star-Rating-Rebirth), sunnyxxy — https://github.com/sunnyxxy/Star-Rating-Rebirth
  (`js/rework/sunnyAlgorithm.js`, `sunnyWindowAlgorithm.js`, `reworkMathCore.js`, and the parts of
  `danielAlgorithm.js` built on it)
- Interlude (YAVSRG) pattern analysis (`js/interlude`, `js/patterns`) — https://github.com/YAVSRG/YAVSRG; ported
  from its Prelude library (`prelude/src/Calculator`), MIT, Copyright (c) 2024 percyqaz
- Daniel (`js/rework/danielAlgorithm.js`) — https://github.com/thebagelofman/Daniel, MIT,
  Copyright (c) 2026 TheBagelOfMan
- Companella (`js/estimator/companella/dan_model.onnx`) — https://github.com/leyna64/companella, MIT,
  Copyright (c) 2025 Leinadix
- ONNX Runtime Web 1.24.3 (`js/estimator/companella/ort`), Microsoft, MIT
- simfile-parser (`js/parser/vendor/simfile-parser`, see its NOTICE.md)
