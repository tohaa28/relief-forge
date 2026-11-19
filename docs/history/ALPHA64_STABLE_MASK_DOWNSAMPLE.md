# Alpha64 — alpha-preserving downsample and upstream segmentation IoU audit

Date: 2026-11-19. Prior published baseline `2b13e06b54331d20311308d36f152036394128a7`. Original private EPS is NOT uploaded; user sent only a 38-event JSONL. Do not commit or reproduce private pixel arrays in the public GitHub repository.

## New alpha63 evidence
- 2026-11-19T15:17:16.490Z: session-start `0.2.0-alpha.63`.
- EPS `8101921_maket_7_121126_163426.eps`, 1,226,967B, preflight 2405 contours, 9679 curves and 10157 lines.
- Ghostscript/MuPDF import 1975 vector objects, 0 images, initial 22219 nodes; health OK.
- 61,084 sampled diagnostic points, 1115 issues (`complete:false`).
- Auto-preview 22219->21271 nodes, native issues still 398, afterDiagnosticComplete false; elapsed ~69s.
- DoctorTracer fallback at 398 errors, initial black-transparent RGBA via Canvas2D 1262x1795, 9,061,160B.
- Attempt 1: 1262x1795, Worker returned `paths:1,paletteCount:1,backend:Rust WASM CPU`; RichSVG 200000-node cap.
- Attempt 2: 883x1256, same palette/path count and cap.
- Attempt 3: 567x807, same palette/path count; candidate failed original-resolution mask, IoU .491 / areaRatio 1.797, so source preserved.
- The alpha63 one-black-ink hypothesis did not improve the user job. The log does not contain the actual source EPS, source RGBA, segmented preview, or DoctorTracer SVG; therefore cannot prove all causes of the mismatch.

## Confirmed source defect and causal limit
`paintDocumentSilhouette` previously used `ctx.lineWidth=Math.max(1/sx,1/sy)` in the document's mm coordinates, with `sx=plan.width/plan.widthMm`. In alpha61–63 retries the rasterizer was called independently at 100%,70%,45% resolution, making an OPEN curve physically wider (by about 1/0.45=2.22 on the last attempt). This changes the bitmap sent to the tracer and may inflate the returned geometry. Whether this accounts for the observed 1.797 area ratio cannot be proven from JSONL alone: it depends on the fractions of open contours, alpha segmentation and SVG compound rendering.

## Implementation
1. Initial `rasterPlan` now stores physical one-pixel width `strokeWidthMm`, stable after `scaledDoctorTracerPlan`. `paintDocumentSilhouette` and fallback `vectorRasterSvg` use this original width even if called at a reduced size.
2. `traceDocumentWithNodeBudget` accepts an independent `referenceRaster`. `app.js` passes the already-copied `originalMask` (which is also used for final acceptance) and the existing `firstRaster`. On retry #2/#3 use `downsampleBlackTransparentRgba8`, an explicit fractional-area box filter over the original RGBA alpha. RGB stays exactly (0,0,0), alpha 0..255 preserved via weighted means, source arrays and EPS immutable. No repeated drawing or widened 1px strokes.
3. Worker `traceWithDoctorTracer` retains a binary 1-byte-per-pixel input alpha before transferring the full RGBA buffer. After Worker response, compare it with returned `segments:ArrayBuffer` alpha, which is DoctorTracer's actual segmentation preview from `traceFixed`. `compareSegmentedAlpha` returns `iou,areaRatio,sourcePixels,segmentedPixels`; `onTraced` writes only that aggregate. No user bitmap or vector in logs.
4. The original strict gates still apply: RichSVG <=200k nodes, original-size raster mask IoU>=.95, area in .95..1.05, complete Rust+native post-diagnosis, fewer errors, Undo and original EPS unchanged.
5. Existing fallback without `referenceRaster` still uses `rasterize`, but physical stroke fixed; invalid or aliased reference buffer fails closed.

## Test plan
- Fractional weighted alpha values, zero RGB and exact source immutability.
- Conservation of alpha mass under noninteger scale (within <=.5 alpha/target pixel quantization).
- Stable mm stroke width at 45% geometry scale.
- Synthetic segmentation mask label violations, IoU/mask area values independent from SVG.
- Actual Worker mock returns segment RGBA, result reports independent audit without leaking bytes.
- Retries reuse original untouched reference even if first transferable pixel buffer gets mutated/detached.
- Full npm tests, Rust cargo, WASM ABI and browser regression via CI; PR merged and GitHub Pages only if green.
- Next real-user run on same EPS needed to measure improvement. If the `doctortracer-trace-result.segmentation` mask IoU is poor at 100% or downscaled, diagnosis shifts to DoctorTracer 0.21.1 hard-stage; if good yet output IoU bad, inspect SVG paint, holes/compound path and scaling. Do not disable safety gates.

## Rollback and next chat
Prior healthy published alpha63 main `2b13e06b54331d20311308d36f152036394128a7`. Working branch `feature/alpha64-stable-mask-downsampling-segmentation-audit`, pending CI/PR/Pages as of candidate writing. Update NEXT_CHAT_START, HISTORY, FAILURE_REGISTER (F-064), METHODS_AND_DECISIONS (M-064), RELEASE_CHRONICLE, FEATURE_MATRIX, DEVELOPMENT_LOG, HANDOFF, logs/actions.jsonl. No private EPS file has been uploaded; only log evidence is available.


## CI attempt #1, failure and correction (2026-11-19)
- Run https://github.com/tohaa28/relief-forge/actions/runs/44557050466 on candidate `6e35c97bf846e40521b744d2cbddaec5b7366577`: `npm test` 356 PASS / 1 FAIL (357 total). Rust/WASM/browser stages not reached because JS stage failed.
- The only failure: new `alpha64: worker segmentation alpha audit` test used `assert.throws(...,/длину/)`; production validation intentionally reports `DoctorTracer: неверная длина сегментированной маски`. JS regex checks exact word form, so the test expected the wrong grammatical case. Algorithm produced the intended validation error.
- Fixed test to `/неверная длина/` in commit `d2c65c88224d38d4fe0049a25985d32252d2cef2`. The failed run is preserved, not hidden or called green; rerun final full CI required before merging.


## 0.2.0-alpha.64 — ОПУБЛИКОВАНА · 2026-11-19
- Пользовательский журнал alpha.63 `relief-forge-session (2).jsonl` (38 событий): original EPS `8101921_maket_7_121126_163426.eps` не загружен. 1975 объектов, 398 остаточных ошибок, raster 1262×1795; one-ink DoctorTracer 0.21.1 3 попытки: 2×200000 узлов и последняя IoU=.491 / areaRatio=1.797, отказ сохранён.
- Подтверждённый в коде дефект alpha.61-63: при retry 70%/45% 1px stroke перерисовывался в другом физическом масштабе (~2.22× шире в мм на последнем разрешении). Исправление alpha64: стабильный `strokeWidthMm`, area-weighted downsample исходной независимой RGBA-маски вместо повторного рендера EPS. RGB=0, исходная alpha остаётся без порога.
- Новый журнал `doctortracer-trace-result.segmentation`: сравнение исходного alpha>=128 с alpha фактической сегментации Worker 0.21.1 ДО SVG, только IoU/areaRatio/количества пикселей, без содержимого EPS/SVG.
- PR #96 https://github.com/tohaa28/relief-forge/pull/96 MERGED, main `58498bea4bdbab54dd18dcc7b06c14ddc486bbef`.
- Final PR CI https://github.com/tohaa28/relief-forge/actions/runs/44557430633 SUCCESS: 357/357 JS, 17/17 Rust, WASM compile/ABI and browser smoke.
- Main GitHub Pages https://github.com/tohaa28/relief-forge/actions/runs/44557865477 SUCCESS (build + deploy). Public URL: https://tohaa28.github.io/relief-forge/?v=alpha64
- Previous published rollback alpha63 `2b13e06b54331d20311308d36f152036394128a7`.
- Failed initial candidate CI 44557050466 (356/357 JS, wrong Russian test regex) documented; intermediate 44557267989 cancelled due superseding push; final CI green.
- Actual IoU on private EPS cannot be claimed fixed from this JSONL alone. Need rerun same EPS in alpha64 and supply new journal/actual source for confirmation. Keep 200k-node cap, IoU>=0.95, area 0.95..1.05, complete full native/Rust diagnosis and Undo intact.
- Full analysis: docs/history/ALPHA64_STABLE_MASK_DOWNSAMPLE.md, F-064, M-064, logs/actions.jsonl.

