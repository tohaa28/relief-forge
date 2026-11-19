# 0.2.0-alpha.61 — DoctorTracer SVG node budget — 2026-11-19

## Evidence and root cause
User diagnostic relief-forge-session(2).jsonl: 29 records on alpha.60.
EPS 8101921_maket_7_121126_163426.eps (1,226,967 bytes; original NOT provided).
1975 imported vectors, 22219 nodes, 61084 diagnosis points, 1115 original issues, 398 residual.
DoctorTracer starts; Canvas RGBA8 1262x1795 (9061160 bytes) succeeds; final fallback error:
SVG: превышен лимит 200000 узлов.
F-060 (SVG ImageBitmap decode) is fixed. Current issue originates in RichSVG import post-parse cap.

## Methods and rejected alternatives
New traceDocumentWithNodeBudget: original resolution, then 70%, then 45% only when
RichSVG throws its exact 200000-node limit. Next raster comes from original native
Bezier paths; bbox in mm never changes. Unrelated errors and user abort stop retries.
After import, candidate is re-rendered at original (not lowered) raster resolution.
Acceptance STILL requires IoU>=0.95, area ratio 0.95..1.05, complete Rust+native
diagnosis and strictly fewer errors; original DO and Undo stay unchanged until Apply.
Reject raising 200k global cap or silently simplifying geometry without fidelity proof.

## Implementation, tests and status
web/doctortracer-fallback.js: bounded helper, scale plan and exact error predicate.
web/app.js: retry orchestration, progress and local diagnostic events.
tests/doctortracer-fallback.test.mjs: bounded retry, mm preservation, cancellation, unrelated error.
Draft PR #93; main rollback 94cc59b1b92519642452ad2b932f1a25f0e9ebb2.
CI and deployment are to be confirmed separately. Live DoctorTracer Worker and user EPS
end-to-end accuracy remain unverified without original file. No user EPS bytes published.
