# 0.2.0-alpha.63 — DoctorTracer one-ink fix and event-level diagnostics

Date 2026-11-19. Real user event log: `relief-forge-session (1).jsonl`, 33 valid JSONL records. Source EPS bytes or actual returned traced SVG not available; do not infer detailed contours or claim live EPS quality.

## Evidence: exact alpha.62 timeline (UTC)
- 14:25:04 session-start alpha.62.
- 14:25:10 EPS 8101921_maket_7_121126_163426.eps, 1226967B, 2405 contour preflight, 9679 cubic / 10157 linear segments; estimated geometry (preflight).
- 14:25:23 import-integrity 1975 vectors / no images; document nodes 22219; import ~12.475s; 61,084 points diagnosed later.
- 14:25:42 diagnosis 1115 issues / 36 batches / 0 failed; `complete:false`.
- 14:26:50 large-preview 22219 -> 21271 nodes, 398 errors remain, afterDiagnosticComplete:false.
- 14:26:56 DoctorTracer fallback started; direct Canvas2D RGBA 1262x1795 9,061,160 bytes, mask tag `black-transparent-rgba8`.
- 14:26:56 attempt #1 1262x1795, 14:27:02 parse node-cap error `SVG: превышен лимит 200000 узлов`.
- 14:27:02 attempt #2 883x1256, 14:27:05 same 200000 node-cap error.
- 14:27:05 attempt #3 567x807, 14:27:08 fallback REJECTED: `новая геометрия заметно отличается от исходного растра (IoU 0.491, площадь 1.797)`. Original geometry unmodified, safe fail.
- 14:27:08 after-diagnose-cached `complete:false,fullScope:true,nativeUnresolved:1`, not an eligible clean confirmed result.

## Code analysis
Actual DoctorTracer `gh-pages/worker.js?v=0.21.1` delegates hard-category to `traceFixed`; `gh-pages/desktop-curves.mjs` contains:
`const shared=Int32Array.from(labels,v=>v===255?-1:v)`.
Thus transparent background is encoded as label 255, not a second printable ink. Relief Forge alpha.62 forced input RGB=0 and preserved alpha but requested `category:'hard',colors:2` with no explicit palette. Two requested printable colors for one available RGB can permit an ill-defined second centroid or duplicate layer. This is a *plausible* cause of excess area, not established from the journal alone. No private user pixels/SVG are available to isolate more root causes.

## Change
- `web/doctortracer-fallback.js`: `traceWithDoctorTracer` sets `colors:1,palette:[[0,0,0]]`. Existing blackTransparentRgba8 normalizes RGB and keeps every alpha byte unchanged.
- Diagnostics per trace attempt: `traceDocumentWithNodeBudget` calls `onTraced` immediately after response; `web/app.js` logs `doctortracer-trace-result` (dimensions, returned path count, paletteCount nullable, backend, requestedInkCount=1). Never serialize full SVG, pixels or user EPS into log.
- Fail-closed on unrelated worker errors, >200000 imported nodes, IoU<.95, area outside .95..1.05, incomplete native/Rust re-diagnosis, nondecreased residual errors; original file and Undo are preserved.
- Modified unit tests: production Worker must receive category hard + colors 1 + palette [[0,0,0]]; added fractional-alpha/packed RGBA8 black mask and retry log tests. No change to external DoctorTracer code; do not vendor GPL modules.

## Validation and limitations
All CI checks must pass on PR #95 before merging; then successful main Pages deploy. This does not constitute a real user-EPS test. To confirm the fix, rerun the same source EPS and send a fresh `relief-forge-session.jsonl`, ideally an offline visual side-by-side inspection. If IoU still fails, analyze new per-attempt trace metrics; consider separate controlled category='aa' experiment only with known geometry.

## Rollback and continuity
Baseline published main commit alpha.62: `b461a5fd1df0d043e27f721c32c3f3a7c516e7cf`. Candidate branch `feature/alpha63-monochrome-doctortracer-ink`, PR #95. Feature matrix / FAILURE_REGISTER F-063 / METHODS_AND_DECISIONS M-063 / RELEASE_CHRONICLE / NEXT_CHAT_START / DEVELOPMENT_LOG / HANDOFF / logs/actions.jsonl retain exact methodology, failure observations and status.
