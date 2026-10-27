# 0.2.0-alpha.46 CANDIDATE — curve editing UI / default AFTER (not published)
- Six user UI requests: (1) workspace field check becomes icon-only square with tooltip/aria label at far right of the navigation row; (2) 'Узлы кривой' renamed 'Редактирование кривой' (E); (3) complete eight-item manual repairs + loop threshold moved into expandable menu inside curve editing toolbar, not duplicated in sidebar, shortcuts preserved; (4) default view becomes ПОСЛЕ as soon as computed, keeping first-import ДО as an immutable original with primary error rings and honoring an explicit user-selected stage during recalculation; (5) removal pointer is precise 32px vector X reticle centered at cursor hotspot; (6) addition pointer is a precise 32px vector + reticle at the same hotspot.
- No vector algorithm, source DO snapshot, EPS export or GPU code changes. Maintain alpha45 commit 4853b96 as rollback.
- Regression additions: tests/alpha46-curve-toolbar.test.mjs; browser-smoke responsive viewport field-button right edge; browser-mode-matrix editor menu, cursor style and default AFTER; existing EPS/PDF/native Undo and geometry parity tests mandatory. Pending CI and Pages deploy.
- Note that previous alpha44 default DO was an explicit earlier UX requirement; this new requested default AFTER supersedes it, without changing the actual stored/imported DO geometry or error markers.

# 0.2.0-alpha.45 RELEASED — exact CNC closed micro-contour filter (2026-10-26)
- Request: delete small independent closed elements with bounding width **strictly < 0.1 mm AND height strictly < 0.1 mm**, incl. inner details from compound objects. Switch default ON, width and height configurable separately. Never erase long thin engravings, open paths or exact-at-threshold forms.
- Feature [PR #68](https://github.com/tohaa28/relief-forge/pull/68) merged as [7f1e371](https://github.com/tohaa28/relief-forge/commit/7f1e371c3c67fcf9a3d2611712d44bf6ed8fea5e). Full PR [CI40325111904](https://github.com/tohaa28/relief-forge/actions/runs/40325111904) **SUCCESS** 255/255 JS, 17/17 Rust, WASM/browser tests, real EPS/PDF, 8-mode matrix/Undo. Real Chromium synthetic compound 19×19 mm outer with .04×.05 mm internal subpath confirms DO retains 2 loops, AFTER retains 1, default checkbox/removal, off retains 2, .02 width retains 2, restoring .1 width retains 1, and downloaded unpainted EPS has exactly 1 path.
- Main production [Pages CI40325275316](https://github.com/tohaa28/relief-forge/actions/runs/40325275316) **SUCCESS** build+deploy. Site https://tohaa28.github.io/relief-forge/?v=alpha45 . Live site on the user's machine and private `gerb.eps` not independently re-tested.
- `web/cnc-microfilter.js`: exact analytic derivative extrema for Q/C plus L endpoints (no raster or polygonal approximations); separates native commands at M/Z; deletes ONLY whole closed subpaths whose axis-aligned width AND height are strictly below independent settings, protected by IEEE boundary epsilon. Preserves retained segments, compound fill rule/paint and original DO. For a compound vector with unsupported or heterogeneous/masked SVG decorations: skips partial deletion instead of inventing one style; whole tiny object can safely disappear. Raster/open geometry never removed.
- Placement: after point repair -> group-scoped Union -> refit -> smoothing -> optimization and node-growth fallback, before final AFTER diagnostic. Applies to BOTH ordinary and large EPS preview. Single cached AFTER is the source of displayed result, manual Apply, RGB/outline EPS and final EPS geometry verification. Options participate in preview freshness and save checks; report includes deleted subpaths/objects/real nodes. No deletion occurs during import original DO.
- Tests: `tests/cnc-microfilter.test.mjs` covers compound internal details, cubic exact extrema vs control hull, long narrow closed slot, open lines, exact bound, customizable thresholds, color EPS and source immutability; `scripts/browser-mode-matrix.mjs` contains real user flow to physical EPS download. Stale-browser-test wait race fixed by waiting for recalculated UI results (GitHub CI40324609454 failed once).
- Previous rollback: alpha44 `dfb94dd` (production Pages40321047109). Remaining issues: exact arbitrary cubic Boolean/F-037, per-group topology of problematic source, GPU benchmark on actual GTX1080/RTX3050, and verification on private gerb source. This CNC filter does not claim to fix all unrelated intersection/clearance issues.

## Previous project history (retained in full)
# 0.2.0-alpha.45 CANDIDATE — CNC minimum closed-element filter (NOT published yet)
- User request: remove every independent CLOSED native vector subpath only if its **exact bounding-box width <0.1mm AND height <0.1mm** by default. User-configurable independent width/height thresholds; checkbox ON by default, operator can disable. Delete tiny internal details of compound paths too, retain outer figures, open engraving strokes, narrow-long details and all other source geometry.
- `web/cnc-microfilter.js`: exact analytic quadratic/cubic derivative roots + line endpoints, no sampled preview/chord approximation. Partition original native M/L/Q/C/Z subpaths; preserve each retained command verbatim. Style preserving safe reconstructions with original solid paint/fill rule; reject unsupported mixed decoration rather than silently corrupt colors. Keep filter after approved Union->Bézier smoothing->optimization and safety node budget, before AFTER diagnosis. `stats.micro` reports removed subpaths, entire objects and original nodes.
- `web/app.js`: ordinary and large-document preview both filter only RESULT/AFTER. Import ДО and first-error markers untouched. Normal Apply/EPS settings freshness reject stale filter options. `web/after-result.js` validates options for cached AFTER EPS. `web/index.html` adds enable switch, width and height inputs and CNC explanation.
- Source-owned `tests/cnc-microfilter.test.mjs`: exact cubic extrema, inner compound/hole cleanup, long thin slots, open traces, exact-threshold retention, color EPS and DO immutability. Full JS/Rust/WASM/Chromium/EPS/PDF/Undo verification pending; no private gerb processing claimed.
- Previous rollback point: alpha.44 `dfb94dd`, GitHub Pages workflow40321047109 SUCCESS. Preserve all previous history and failed attempts, never relax Union-geometry topology safety.

# 0.2.0-alpha.44 PUBLISHED — verified checkpoint (2026-10-26)

- User requirement: **ДО** must show the raw document *immediately after import* and its **original diagnosis problem rings**, irrespective of later Union/smoothing/optimization/Apply; no background task may select ПОСЛЕ without an explicit user click.
- Feature PR [#66](https://github.com/tohaa28/relief-forge/pull/66) merged at [74d1e9e](https://github.com/tohaa28/relief-forge/commit/74d1e9e489bf8db506ca9197ef266d295cf2fbe8).
- Full PR [CI 40320220363](https://github.com/tohaa28/relief-forge/actions/runs/40320220363) **SUCCESS**: 248/248 JS, 17/17 Rust, fresh WASM and actual Chromium regression. Synthetic duplicated closed SVG imported as 2 native paths with **17 original error rings**; DO retains exact original geometry, marker count and positions across DO→AFTER→DO. Browser EPS and PDF import, all 8 mode-matrix combinations, node editor, EPS export from cached AFTER, Undo/Redo and reopen tests passed.
- Main production [Pages workflow 40320407500](https://github.com/tohaa28/relief-forge/actions/runs/40320407500) **SUCCESS** build + deploy. Site https://tohaa28.github.io/relief-forge/?v=alpha44. Live user's browser and their private gerb.eps not independently re-run; avoid claiming a user-confirmed visual inspection.
- `web/import-before.js`: independent structured-clone import baseline captured when successful import becomes current. First original Rust/WASM diagnostic issues and completeness cached one time. Subsequent ordinary or large EPS preview always compares imported first snapshot to separately processed AFTER; background AFTER diagnosis no longer forcibly changes tab. New import replaces baseline, new blank document clears it. Export still uses approved AFTER snapshot exclusively.
- Failed CI attempts retained: [40319459488](https://github.com/tohaa28/relief-forge/actions/runs/40319459488) old static AFTER assertion, unsigned docs version, VM harness omitted new importedBefore stub; [40319662440](https://github.com/tohaa28/relief-forge/actions/runs/40319662440) browser-smoke wrongly assumed automatic AFTER; [40319990699](https://github.com/tohaa28/relief-forge/actions/runs/40319990699) mode-matrix wrongly compared saved AFTER to displayed DO. Tests were corrected to assert both stages and actual export parity, **not weakened**.
- Rollback: production alpha.43 is `e3e2c3a`; alpha.42 `b454bcf`. Remaining geometry limitations F-037 exact cubic crossing provenance, arbitrary analytic Bézier Boolean and hardware GPU performance remain separate and unchanged by this UI/data-integrity fix.

## Earlier working notes (historical, NOT the current release status)

# 0.2.0-alpha.44 candidate: immutable import DO + first diagnostic markers (PR #66; pending tests and deploy)
# alpha.44 candidate — ДО is immutable import baseline (2026-10-26; NOT YET DEPLOYED)
- Requirement: after importing EPS/PDF/SVG, show ORIGINAL native curves in ДО with all errors from first Rust/WASM diagnostic. Automatically calculating Union/smoothing and checking ПОСЛЕ MUST NOT switch tabs without user input.
- Implementation: web/import-before.js clones native geometry on successful import and captures first original-geometry diagnosis once (including partial status). Both ordinary and large-file previews use the same preserved original snapshot/markers, while AFTER uses its own separately diagnosed snapshot. Auto-preview and asynchronous AFTER diagnosis leave the requested stage unchanged. Importing another document starts a clean baseline; a new blank document clears it. EPS export remains bound to AFTER as before.
- Tests: tests/import-before-markers.test.mjs validates immutable geometry/initial issue points and explicit mode selection. Existing Rust/WASM, EPS/PDF browser, Undo/Redo, GPU fallback and node-budget tests MUST remain green. No user EPS bytes or screenshots committed.
- Alpha.43 remains the last production control point until PR CI and GitHub Pages deploy are verified.

# 0.2.0-alpha.43 PUBLISHED — VERIFIED CHECKPOINT 2026-10-26
- Functional PR https://github.com/tohaa28/relief-forge/pull/64 merged into main at `af4c285dd07906e16ecb62d541d7bc6e2a05ed01`.
- PR source-head CI https://github.com/tohaa28/relief-forge/actions/runs/40316932711 **SUCCESS**: 245 JS tests, 17 Rust native tests, freshly compiled WASM, genuine browser/Worker EPS and PDF import, union+holes silhouette, both color/outline EPS modes, actual AFTER export vs preview, Undo/Redo and node editing. Separate simulated WebGPU device exercises adapter request, WGSL dispatch, readback, candidate flags; NO hardware benchmark.
- main production GitHub Pages build and deployment https://github.com/tohaa28/relief-forge/actions/runs/40317131510 **SUCCESS**. URL https://tohaa28.github.io/relief-forge/?v=alpha43. No independent manual visual verification on user browser, no rerun on private source `gerb.eps`.
- Union change: `web/union-group-budget.js` refits/checks EACH group and EACH compound normalization, with local and document-wide node budgets. Rejected group preserves native source while accepted groups continue. Preserves alpha42 exact opaque copy dedup before Boolean, holes/paint, CPU f64 checks, AFTER=EPS snapshot. Can legitimately decline complex curved merges when proof/node-budget unavailable; NOT fully exact Bézier Boolean tracing.
- GPU change: `web/gpu-broadphase.js` real compute shader uses conservative f32 native Bézier control-hull AABBs to select possible overlap pairs, reads flags from GPU; CPU still does actual Clipper, post-refit, geometry diagnostics and EPS. Device failures/browser without WebGPU fall back to CPU and show status. No measured speedup claim on NVIDIA GTX 1080 / RTX 3050; GPU not used for raster tracing or final topology.
- Tests: `tests/scoped-union-gpu-alpha43.test.mjs` plus adapted async VM harness `tests/unified-point-apply.test.mjs`. Initial PR CI https://github.com/tohaa28/relief-forge/actions/runs/40316352394 FAILED two assertions: old cubic test required destructive flattened Union, old VM harness stripped `async`. Follow-up 40316568245 VM source slice still stripped `async`; corrected. Final 40316932711 passes all 245JS/17Rust/real browser gates. Do not remove fail-closed checks or weaken EPS/Undo gates.
- Remaining: exact native Bézier intersection F-037, cross-batch diagnostic gaps, exact arbitrary cubic Boolean, real WebGPU hardware runtime/throughput testing and per-user gerb verification. Version 0.2.0-alpha.42 still rollback checkpoint at commit `b454bcf` and historical successful workflow40308614388.
- The remainder of this file contains historic records, not revoked by this new entry.

# 0.2.0-alpha.43 CANDIDATE — 2026-10-26, NOT PUBLISHED
- Source branch `feature/alpha43-scoped-union-webgpu` based on published alpha.42 (`b454bcf`). Do not claim publication or CI success before evidence.
- Real WebGPU WGSL compute broadphase for native Bézier convex-hull AABB candidate pairs (high-performance adapter, conservative f32 padding). Device/readback buffers are disposed. CPU fallback for unsupported browsers, documents outside limits or device errors. GPU only filters candidate pairs; CPU f64 sampling, Clipper Union, Bézier post-refit, quality checks and EPS snapshot remain authoritative.
- Group-scoped Union acceptance: every independent group and each compound path is refitted/checked before commit. Invalid, node-inflating or over-budget groups stay original, while other approved groups and exact opaque source-copy removals remain. Overall input-node ceiling remains; no disabling topology/hole/paint guards.
- Both ordinary and large EPS preview use new GPU candidate prefilter, then Union -> smoothing -> optimization -> AFTER diagnostics -> EPS from one snapshot.
- Explicitly **not** implemented: full f64 analytic curve-curve Boolean tracing, guaranteed elimination of every unnecessary new node, full cross-batch diagnostic coverage, GPU Clipper/geometry kernel, hardware speedup proof on GTX 1080 or RTX 3050.
- Verification TODO: static/238+ JS, 17 Rust, compiled WASM, real Chromium EPS/PDF/Undo/Export parity, CPU/WebGPU candidate identical output, release Pages push and live user checks. No private `gerb.eps` committed; actual screenshot and exported file remain outside repo.
- Pre-existing alpha42 checkpoint: PR #62 merged `3dd7099`; final publication with history PR #63 `b454bcf`, Pages CI40308614388 SUCCESS. Preserve this rollback target.

# RELEASE COMPLETE — 0.2.0-alpha.42, GitHub Pages deployed and CI verified (2026-10-26)
- Functional PR [#62](https://github.com/tohaa28/relief-forge/pull/62) merged to main at [3dd70995124f5d1c935bbda45e1ba18ab385ab6e](https://github.com/tohaa28/relief-forge/commit/3dd70995124f5d1c935bbda45e1ba18ab385ab6e).
- Final-head PR CI [40307674333](https://github.com/tohaa28/relief-forge/actions/runs/40307674333) **SUCCESS**: 238 JS tests, 17 Rust native tests, fresh WASM, real browser/Worker gates including EPS, PDF, real Union, holes, project Undo/Redo, exact cached AFTER EPS. PDF synthetic 108 original anchors -> 103 AFTER, Undo exact, real two-mode EPS exports, source silhouette mismatch 0/320000 pixels.
- Main push GitHub Pages workflow [40307945350](https://github.com/tohaa28/relief-forge/actions/runs/40307945350) **SUCCESS**: build and deploy; site: https://tohaa28.github.io/relief-forge/?v=alpha42. External independently-controlled live-browser verification of deployed site was unavailable, so do not claim live viewport/user-site behavior independently checked.
- Correct processing order: native point repair -> independent exact opaque fill dedup -> optional Clipper Boolean Union -> post-Union refit -> Bézier smoothing -> optimization -> independent quality checks -> cached AFTER re-diagnosis -> snapshot EPS. Both normal and large-file modes. When Union blows node limit, fall back to independent native pre-Union snapshot and still safely optimize it; preserve correctly deleted duplicates. Avoid aliasing that snapshot to mutated doc.
- Safe source-dominant Union reuses original native M/L/C/Q without adding nodes. Arbitrary non-contained intersections remain Clipper-flattened/refit with safety limits, NOT true exact-native Bézier Boolean construction; do not claim all Union-inserted anchors are mathematically necessary. True native-curve intersection provenance (F-037), complete cross-batch diagnostics and GPU geometry acceleration remain unimplemented. Existing safeguards: hole/paint, no-opacity merge, no runaway node counts, Undo, epsilon/budget checks, EPS=AFTER.
- Prior CI FAILURES retained deliberately: stale static expectations/cache/version docs; transparent compound merge; browser PDF Undo due aliased safeDocument (post-Union 481 anchors erroneously called safe vs original 108). Each was fixed and verified by last green run. No private gerb geometry committed, no direct regression on private gerb input.
- This record is a post-publication evidence checkpoint only; no functional edits after merge #62.

# CANDIDATE 0.2.0-alpha.42 (PR #62) — NOT published, verification pending
2026-10-26. Requested Union-first before smoothing/optimization and re-diagnosis, preserve exact AFTER=EPS. PR https://github.com/tohaa28/relief-forge/pull/62; branch fix/union-first-verified-alpha42. Changes: independent conservative opaque same-paint exact native Bézier dedup, keep valid dedup after inflated Boolean rollback; reorder both normal and large-file preview; bound large-document quality via per-object and spatial potential-contact pairs, failing closed on exceeded pair budgets; maintain existing Undo/paint/hole/node/export safeguards. First PR CI 40304538124 failed 4 stale static expectations/history/cache, NOT geometry tests; follow-up updating tests/docs/version. No live alpha42 deployment claimed. Real F-037 exact curve crossings and true piecewise-Bézier Boolean construction remain outstanding; GPU still only proposed (numerical correctness requires deterministic CPU verification). Do not merge unless all JS, Rust, fresh WASM, actual browser gates pass, then verify Pages and live EPS. Published alpha41 remains checkpoint.

# gerb investigation COMPLETE — alpha.41 runtime unchanged, CI verified
2026-10-26. PR https://github.com/tohaa28/relief-forge/pull/61; investigation sourcec9e8137, CI-only host follow-upa17c773. First CI40291584782 FAILED browser installation on Ubuntu26 (not application); follow-up https://github.com/tohaa28/relief-forge/actions/runs/40292188928 SUCCESS56sbuild/59srun:229JS/17Rust/freshWASM/all real browser gates. Exact-host Ubuntu26/x64 CI selection of existing24.04 Playwright build proved working; no gate removed, no official Ubuntu26 support claimed. Latest documentation-only follow-up requires its normal checks; app web/src/Cargo/package unchanged versus8fdd9c3. Published version remains0.2.0-alpha.41.
User-facing local HTML/Markdown reports delivered separately; private geometry not committed. F-037/F-038/F-039 causes are confirmed, NOT implemented fixes. F-040 CI infrastructure compatibility fixed/tested independently. Investigation current task complete; next targeted corrections listed in docs/history/GERB_DIAGNOSTIC_INVESTIGATION_20261026.md. Never describe diagnostic findings as repaired artwork or a new app release.

# Investigation PR61 — CI host compatibility follow-up pending
PR https://github.com/tohaa28/relief-forge/pull/61 firstCI https://github.com/tohaa28/relief-forge/actions/runs/40291584782 FAILED browser installation only after229JS/native17/freshWASM passed. F-040 Ubuntu26 unsupported by pinned Playwright. Narrow CI-only Ubuntu24 browser selection added, all browser gates retained; latest-head CI required. Application web/src/Cargo/package unchanged atalpha41, no gerb fix claimed. Investigation sourcec9e8137 and complete findings below; published main still8fdd9c3 until green merge.

# INVESTIGATION 2026-10-26 — gerb.eps causes confirmed; published alpha.41 UNCHANGED
Latest observed baseline main8fdd9c3bc76528c54c644f7f12176273ded1cf2c/runtime6a0557f; user asked testing and root causes, not a claim of completed repair. Current commit adds only investigation docs + source-owned scripts/reproduce-alpha41-diagnostic-limits.mjs. No web/src/Cargo/package changes, no alpha42. Full canonical evidence docs/history/GERB_DIAGNOSTIC_INVESTIGATION_20261026.md. Private original604571bytes/hash312500844119a99a08e181236c2472f9a023dd1fb65af51bfcbf1c9466e58ff4 and curve excerpts kept local; user HTML/MD reports outsideGit. Earlier local checkout lost, recovered exactrepo; runtime remains known release.
Actual gerb93objects/1242closedparts/11493->11170anchors,3284->2642messages,14sampledjobs partial.35exactcopies/602nodes, duplicate messages cover19of35pairs; isolated keep-later dedup93->58/XOR0 sampled, not full repair. F-037 all5AFTERselfcrossing marks are chord artifacts: positive original-curve interval gaps .00118-.00270mm;297/760coincidentpairs include samples.1096inter-object reports have near-zero native contacts, mostly copies, do not dismiss all.166remaining short messages =164native+2closing in57whole tiny parts, protective nondeletion. Pinkzones517->502complete at.1mm are display-only; no automatic curve separation was built.
F-038 Union removed35copies then23225nodes>11493guard reverts entire candidate incl dedup; keep safeguards and scope rollback. F-039 combined quality sample>20000cap at.0025mm rejects smoothing/optimization wholesale (not proven bad geometry). SavedEPS matching-after11170, independent reimport identical2642counts/partial: export not culprit.229JSlocal PASS; actual publishedWASM/native audit and Chromium transport/Apply/export/Undo checked; fresh localCargo unavailable. Native provenance harness zero/degenerate conventions assertions all passed after recorded corrections.
Next targeted work if requested: native marker verification + origin maps; independent exact global paint/order-safe dedup; spatial cross-job coverage; scalable independent quality/per-group rollback; explicit microfigure policy. Do not silently erase57tiny parts, weaken node/hole/paint/Undo/AFTER=EPS/partial guards, change working PDF logic, or call investigation a deployed fix. Current user request investigation completed. Prior publication history retained below.

# CURRENT PUBLISHED: 0.2.0-alpha.41 — PDF named-layer import LIVE verified
User scope: PDF import only; all other working functionality unchanged. PR59 https://github.com/tohaa28/relief-forge/pull/59 merged6a0557f4a499dbbd902fdbf63b0418a41505fcc5/sourcec02ab96. PR CI https://github.com/tohaa28/relief-forge/actions/runs/40013897510 SUCCESS229JS/17Rust/freshWASM/all old+new browser gates. Main Pages https://github.com/tohaa28/relief-forge/actions/runs/40014070205 build SUCCESS56s + deploy SUCCESS10s. Live https://tohaa28.github.io/relief-forge/?v=alpha41 independently verified in Windows Chromium on supplied PDF and old EPS/neck cases. Later docs-only PR may advance main without runtime change.
F-035 root cause/fix: MuPDF named PDF optional-content g has inkscape:groupmode/label with xmlns only on rootSVG; generic object extraction drops root declaration, strict browser rejects standalone fragment. PDFpipeline selfContainedPdfLayers copies exact producer declaration onto prefixed layer g while preserving labels, all transforms/commands/paint/defs/text/images. Shared SVG/EPS import, repair/Union/narrow distances, UI/buttons and exporters EXACT unchanged after cache/version normalization. Do NOT fix by weakening XML/security validation or rasterizing/removing metadata.
Actual private suppliedPDF LIVE1compound396original anchors,49.789856x26.65857mm, original solid/evenodd/nativeC preserved; both EPS choices/project reopen/Undo exact original396 and Redo existing optimizer245 PASS.245AFTER is established default processing, not import data loss. PDF raw versus original editableSVG visual20pixels/342400; synthetic0/320000; original4xPNG/workspace reviewed. LayerUnicode/special names/text outlines/multipage2/cancel/images/invalid input preserving previous doc verified with mandatory scripts/browser-pdf-import.mjs.229tests includes3new realMuPDF unit; all existing modes/primary/Union/retrace/neck/PDF/project/node/Undo/+/- CI remain mandatory. No private files/coordinates inGit, sourcePDF unchanged. Live PDF6482ms measures multi-operation script, not pure import.
Live old min EPS retry PASS3146->1967/0legacy residualsPARTIAL, both EPS1967and exact old outline bytes, Undo3146Redo1967, original18/AFTER16neck zones complete, stale threshold cancellation/no JS errors. Unmodified alpha40 neck LIVE denseBEFORE0/parallel1/separated2 PASS. F-036: first additional cold old EPS smoke timed out120s; no first-run tracing, causeUNKNOWN. Same input/revision immediate traced retry PASS8072ms (coldimport+3views), no requestfailed. Preserve timeout honestly; do not call first attempt a pass or assume root cause; no EPS changes made. Revisit only if repeat/reproducible with stage/request traces and user scope. Current requested PDF fix complete, external user verification separate.
Keep all prior node-growth/partial coverage/AFTER=EPS/Undo/paint guards. Prior F-034 neck correction intact. Next independent work only if requested; no outstanding required code. Source runtime merge6a0557f, final histories below, later doc-only merge can advance main.

# Active candidate 0.2.0-alpha.41 — PDF import only (not published)
User explicit scope: fix supplied PDF import; leave all working features untouched. Base mainc06dda6d3827c0e0d4f2a17586196379fe21c53e, alpha40 Pages40004978211 successful. Branch fix/pdf-import-alpha41. F-035 confirmed: rootSVG-only Inkscape namespace lost in per-object fragments for named PDF OCG layers, browser throws exact "Некорректный SVG"; xmldom permissiveness insufficient. PDFpipeline selfContainedPdfLayers copies producer namespace to prefixed layer g without dropping labels or altering geometry. NO shared SVG/EPS/repair/clearance/UI/export logic changes (verified exact baseline after normalizing version/cache keys).
3new real-MuPDF tests + new actual Worker browserPDF gate PASS: raw-error reproduction, Unicode/special named layer/textC/scale/paint, multi-page2/cancel/image/invalidheaderpreservesprior, both EPS, full-path Undo/Redo/project reopen, independent original/exportSVG silhouette. Actual private suppliedPDF1compound396source anchors49.789856x26.65857mm, unchanged optimizer245; exact Undo396/Redo245; visual20pixels/342400, synthetic0/320000; original4xPNG and workspace screenshot inspected. All private geometry ignored. New CI browser gate added check-wasm alongside all existing modes. Full229JS/Rust/freshWASM/existing regressions/PR/main deploy/LIVE pending; do not claim published until checks and mainbuild+deploy success. Preserve all alpha40 neck fixes and old partial/export guards. Next: complete regressions -> GitPR -> latest CI -> main publish -> live PDF plus old features -> permanent final record.

# CURRENT PUBLISHED: 0.2.0-alpha.40 — contour narrow minima LIVE verified
Functional PR57 https://github.com/tohaa28/relief-forge/pull/57 merged c50ef643c3a6e69c10387ad5ee87cefc0cd040da, source7e014b3. PR CI https://github.com/tohaa28/relief-forge/actions/runs/40004099807 SUCCESS226JS/17Rust/freshWASM/all browser gates. Main Pages https://github.com/tohaa28/relief-forge/actions/runs/40004283241 build SUCCESS53s and deploy SUCCESS8s. Live https://tohaa28.github.io/relief-forge/?v=alpha40 independently checked in Windows Chromium on synthetic analytic/dense/true-neck fixtures and actual private min EPS. Documentation-only follow-up may advance main without runtime changes.
F-034 user report alpha39 neighboring-node false narrow places FIXED: pairwise segment endpoint distances were not continuous-contour minima. Added incident-continuation derivative sign test, true interior witnesses for parallel flat minima, connected-zone aggregation retaining shortest actual curve witness. Shared pair-cell boundary must itself have proven below-threshold native distance, so wide separating spans keep distinct necks. Default0.1mm, pink fill BELOW vectors, unchanged original L/Q/C geometry/paint, threshold only diagnostics, no export annotations. LIVE dense81node BEFORE0marks / denseparallel1true0.05mm central mark / separate narrow ends2marks, plus threshold .04/.06 and BEFORE/AFTER/EPS guards PASS.
Actual min LIVE original18zones / AFTER16zones complete at0.1mm (historical alpha39 raw2287/136 now obsolete). Existing repair3146->1967anchors,0sampled overlap residuals stillPARTIAL in old cross-batch WASM diagnosis; warning retained. Both live EPS1967 and outline bytes exact verified prior output; actual project Undo3146/Redo1967, rapid1000->.1 stale Worker cancellation, no JS errors PASS. Native source106ms; live10244ms covers cold import/network AND three original/after clearance states, not pure geometry or universal speed claim.
20distance unit checks incl6new F-034 cases; full226JS/17Rust/freshWASM/primary+eightUnion-smoothing-selection modes/PDF/project/node-editor/Undo/Union/retrace/new neckbrowser mandatory gates PASS. Initial5synthetic false cases and naive adjacency-clustering overmerge FAIL retained in failure register/logs, then fixed; one lexical repeatedL test representation corrected with true SVG native parser. All fixtures synthetic/private files remain local.
Limits: nonadjacent native-pair minimum search; same immediate native neighbors, within-one-native-segment self approach and stroke thickness outside current scope.2Msharedwork/50krawminima/3kzones/unsupported/numeric ambiguity -> explicit incomplete; no silent full certification or weakened old cross-batch warnings. One shortest actual witness per connected eligible narrow zone, not at every nearby node. Source/main release c50ef64 is canonical runtime; later docs-only PR keeps runtime identical. Next optional work: further curved/self/adjacent-remote semantics with geometry-preserving tests, preserving F-034 segmentation invariance. No current unfinished requested code.

# Active candidate 0.2.0-alpha.40 — whole-contour minima (not published)
Base main6470dc00b48ecc7209b47c76c4c2d1ca0e8409ad / last publishedalpha39 Pages40001458554. Branch fix/contour-clearance-minima-alpha40. User false neighboring-node marks reproduced F-034: dense straight703false/circle3000cap. Native curve-distance itself real, but segment endpoint witnesses not continuous-contour minima. Incident-direction continuation filter + actual interior flat witnesses + connected narrow zones with native shared-boundary below-threshold proof fix.20distance tests PASS incl6new (initial5false-positive tests and separate-neck overmerge test observed FAIL then PASS); Chromium actual dense BEFORE0/oneparallelneck1/separatenecks2 PASS. Source min2287->18zones complete106ms; old optimized138->17zones71ms; private originals unchanged. Full226JS/Rust/freshWASM/existing modes/actual EPS/live publication pending. Keep default0.1mm, pink layer under geometry, original coordinates/paint, Undo, exact AFTER/EPS and legacy large-diagnostic PARTIAL warnings.2Msharedwork/50krawminima/3kzones explicit incomplete; same immediate native neighbors/single-native-segment self approach/stroke width not included. Read latest DEVELOPMENT_LOG/F-034 before retrying methods; preserve histories. Next: all checks -> PR -> green main build/deploy -> live independent neck regression/private min -> append final links.

# CURRENT PUBLISHED: 0.2.0-alpha.39 — curve clearance LIVE verified
Functional PR55 https://github.com/tohaa28/relief-forge/pull/55 merged fa1d2566375e695474f86c803a7b044f8e39f1cb. Final PR CI https://github.com/tohaa28/relief-forge/actions/runs/40000669760 SUCCESS220JS/17Rust/freshWASM/all existing+new browser gates. Main Pages https://github.com/tohaa28/relief-forge/actions/runs/40000825101 build SUCCESS50s + deploy SUCCESS18s. Live https://tohaa28.github.io/relief-forge/?v=alpha39 independently verified in Windows Chromium, actual private min EPS + source-owned analytic fixture.
New separate default0.1mm minimum-distance setting measures native L/Q/C centerline pairs in cancellable Worker using AABB sweep/de Casteljau proven bounds and actual-point witnesses. Pink filled circles are under geometry, display-only, never EPS/SVG/project annotations. Strict below-threshold behavior,0.05mm analytic fixture,.04/.06 threshold changes, BEFORE/AFTER and no pageerrors verified LIVE. F-033 exact endpoint-return seams withoutZ excluded as ordinary neighbors; nonzero gaps remain measured.220JS total includes14new distance regressions.
Actual min LIVE original3146->1967anchors, existing repair0sampled overlap issues PARTIAL (legacy cross-batch warning preserved), NEW independent clearance ORIGINAL2287/AFTER136pair locations complete at0.1mm. Both actual EPS1967, outline bytes equal alpha38 verified deliverable; actual Undo3146/Redo1967; rapid threshold1000->.1 stale-job cancellation verified. Geometry-only source95ms; live multi-state script12564ms includes cold import/network plus three ORIGINAL/AFTER clearance states, not pure geometry or a universal speed claim.
Scope: nonadjacent native-segment pairs across document/compound paths; same-subpath consecutive segments incl closure excluded, same-single-segment self approach/stroke thickness not measured, one minimum location per eligible pair.2Mwork/3000markers/unsupported or unresolved numeric threshold -> explicit incomplete label. Does not weaken original Rust partial diagnostic/export guards or repair geometry/node ceiling. No private input in Git. Source8c8487b, history8b80741, release merge fa1d256; documentation-only follow-up can move main with runtime unchanged. Future adjacent remote/self-approach/clustering/stroke width require explicit semantics and tests; no automatic repair of small gaps authorized here. Complete logs and failures below.

# Active 0.2.0-alpha.39 — PR55, clearance source verified locally; publication pending
Base main4557963b514ef46364a47a943026c8fd143ede3c. Source8c8487b (after9c8a6bc), feat/curve-clearance-alpha39, PR https://github.com/tohaa28/relief-forge/pull/55 . Latest220JS locally PASS,14new distance regressions; first219-test CI https://github.com/tohaa28/relief-forge/actions/runs/40000316968 SUCCESS17Rust/freshWASM/all existing+new browser gates; latest-head CI https://github.com/tohaa28/relief-forge/actions/runs/40000511482 pending. Do not merge without latest-head CI success or claim published without main build+deploy and live check.
Native L/Q/C distance with proven lower bounds/actual point upper witnesses, separate0.1mm setting, cancellable Worker, pink filled circles behind geometry. Same-subpath adjacency includesZ or exact endpoint return (F-033); true nonzero gaps kept. All vector geometry/Undo/AFTER/EPS preserved. Private min ORIGINAL2287 and app AFTER136pair markers complete at0.1; source95ms worker-independent geometry benchmark; actual browser processed~3.2-3.7s including import. Both EPS1967same bytes as alpha38,Undo3146/Redo1967. Pairwise centerline distance excludes adjacent joins, same-native-segment self approach and stroke thickness.2Mwork/3000markers/unsupported/unresolved precision explicitly incomplete; separate legacy cross-batch WASM partial warning preserved. Full append-only evidence below and DEVELOPMENT_LOG. Next: latest CI -> merge -> main Pages -> live new clearance and private EPS -> record final URLs.

# Active candidate 0.2.0-alpha.39 — curve clearance (not published)
Base main4557963b514ef46364a47a943026c8fd143ede3c. Branch feat/curve-clearance-alpha39. New independent0.1mm threshold, native L/Q/C world-distance branch/bound + cross-document sweep in cancellable Worker, actual-point witnesses, pink circles under geometry. Adjacent same-subpath joins excluded; one location per native segment pair; same-segment self approach/stroke width not measured. 2Mwork/3000markers/unsupported/ambiguous threshold explicitly incomplete. Existing partial Rust diagnostic/export guards unchanged. Local12unit and actual Chromium clearance threshold/layer/BEFORE-AFTER/EPS regression PASS; real min native clearance97ms source/63ms prior optimized. Full npm/Rust/freshWASM/all browsers CI pending; do not claim published until main build+deploy. Follow docs/DEVELOPMENT_LOG newest entry and preserve original geometry, exact AFTER/EPS, Undo, source-owned fixtures/private file policy.

# CURRENT PUBLISHED: 0.2.0-alpha.38

## 0.2.0-alpha.38 — covered segment retraces PUBLISHED and LIVE verified (2026-10-23)
- Functional PR53 https://github.com/tohaa28/relief-forge/pull/53 merged db3ce8180f8bc458200aed4571db01038f0e598a; source checkpoint3b95875c316c60518095407eb7a6932305fde365. PR CI https://github.com/tohaa28/relief-forge/actions/runs/39995831886 SUCCESS:206JS/17Rust/freshWASM, new covered-retrace fixture3overlaps->0complete and XOR0, browser actual repair count/BEFORE-AFTER/Apply/Undo/EPS, existing8-mode/node-editor/project/PDF and true-Union/hole gates. Main Pages https://github.com/tohaa28/relief-forge/actions/runs/39996031307 build SUCCESS and deploy SUCCESS.
- Live https://tohaa28.github.io/relief-forge/?v=alpha38 independently checked with the actual supplied min EPS in Windows Chromium. Original3146anchors -> AFTER1967, reported remaining3overlaps->0; exactly1covered repeated closed line/3nodes removed. Both actual saved EPS modes contain1967anchors; live outline bytes EXACTLY equal the independently verified local contour-only output. Confirmed partial-coverage warning remains before export, explicit user-style override in browser test; no pageerrors. Actual Undo restores3146original anchors and Redo restores1967applied anchors, checked through saved project geometry. Live cold import+processing6782ms; local2995ms vs previous3111ms, no universal speed claim.
- Algorithm F-032: same-object native closed linear return contour may be removed only if every projected collinear interval is already covered by nondegenerate surviving boundary geometry; numeric roundoff bound independent of user diagnostic tolerance. Straight Bezier control hull may provide coverage; curved loops, strokes, unsupported paint/masks, standalone/uncovered/near-parallel/gapped traces retained. Degenerate contours do not justify deleting each other.2Mnative comparisons budget; incomplete proof leaves contour unchanged and records skipped limit. Source, paint, controls, translations, selected scope and exact AFTER/EPS/Undo contract preserved.
- Actual helper-only filled silhouette XOR0mm². Isolated affected optimized object1875sampled points: complete WASM3overlaps->0; all individual final objects independently complete/0. Whole-document interaction coverage across batches remains PARTIAL, never advertised complete. Whole Clipper Union21861still correctly rejected vs original3146; native local repair succeeds while preserving original-node guard.
- Prior cases:8048531 still439->396/0complete,20outer/10holes and prior refit XOR bound preserved. Prior kalin now3152->1969/0sampled issues partial, removing the same1covered return contour, while21872Union growth remains blocked. Old alpha36/37 notes saying3residuals are historical.
- Verified contour-only user output outputs/min_result.eps is local-only, not committed or uploaded. No private input/vector bytes in Git. Regression inputs are source-owned synthetic rectangles/return paths. Full method and conservative skip cases in web/covered-retraces.js, tests/covered-retraces.test.mjs and scripts/verify-retraces.mjs. All release/cache versions synchronized to alpha.38; approved raster assets and native +/- signs retained.
- Next independent work: full cross-batch relationship verification and optional handling of uncovered/stroked retraces require separate semantic decisions; do not silently remove guide lines or weaken original-node/tolerance/coverage gates. Firefox/user external CAM importer not newly verified. Canonical runtime merge db3ce81; documentation-only follow-up can advance main without changing runtime.

--- Earlier chronological snapshots follow ---
# Active candidate: 0.2.0-alpha.38 (not published)

## 0.2.0-alpha.38 — covered retrace repair (2026-10-23)
Base main d0f1518204405fdea3fc4b9d3074e96e6a03a079. Branch fix/covered-segment-retraces-alpha38. Actual supplied min EPS:3146anchors,134sampled issues partial; alpha37 AFTER1970anchors and3overlap issues, whole Union21861rejected. Reproduced a closed M A L B L A Z contour lying entirely on a surviving boundary line inside the same filled compound path. New algorithm verifies exact collinearity and full projected interval coverage by nondegenerate surviving subpaths before removing the duplicate zero-area contour; supports adjacent covering segments and truly collinear Bezier hulls. No sampling or user-tolerance snapping licenses removal. Uncovered/near-parallel/curved/stroked/unsupported/standalone rings preserved. Native coordinates, paint, translations, source and Undo retained. Tests/CI/live publication pending.

# CURRENT PUBLISHED: 0.2.0-alpha.37

## 0.2.0-alpha.37 — true overlap healing and complete zoom signs PUBLISHED (2026-10-23)
- Functional PR51 https://github.com/tohaa28/relief-forge/pull/51 merged e50d0c70c7565d96c4ea08d7721bc876c6468931, source checkpoint d9f886d416f5e4a2956ee725d346d811c7fee79c. PR CI https://github.com/tohaa28/relief-forge/actions/runs/39987564474 SUCCESS: 198JS,17Rust,freshWASM ABI, true Union/hole/silhouette/EPS-roundtrip fixture, actual complete SVG +/- signs and real zoom inverse, primary Worker/browser + eight Union/smoothing/actual-selection combinations + project/node-editor/PDF gates.
- Main Pages https://github.com/tohaa28/relief-forge/actions/runs/39987792373 build SUCCESS and deploy SUCCESS. Live https://tohaa28.github.io/relief-forge/?v=alpha37 checked independently in Windows Chromium at DPR2. Header confirms alpha.37. Both complete centered SVG +/- signs and actual zoom work; private live screenshot inspected. User Firefox verification still separate, not claimed.
- Actual supplied8048531 EPS: source439nodes/43issues, preUnion272/16; now accepts valid Clipper+refit396/0 with complete coverage at0.02mm, preserves20outer regions/10holes. Post-refit XOR area0.2115301734mm² vs reference filled Union and perimeter/tolerance area budget15.7998427253mm². Exact independent outline export/reimport396anchors,0issues,complete and10nested holes.
- LIVE site original439->396,0residuals,no override needed. Both actual downloaded EPS choices have396m/L/C anchors; live outline bytes EXACTLY equal independent verified artifact. Verified local user deliverable outputs/8048531_result.eps has20199bytes, SHA2566af812c14b1d2ec4e14325b596a873e7b6a5b32f99d5f77d7e609954fa69c962; contour-only unpainted EPS intended for vector/CAM workflow, not an ink-rendered preview. Private geometry is never committed.
- Timings (separate scopes): geometry stages~733ms excluding file conversion/network; local real Worker file import+processing1021ms. LIVE cold browser first EPS21136ms, independent cold repeat7107ms, same-session warm reimport562ms, all0issues. Heavy Ghostscript/MuPDF first-load conversion/setup and network dominate cold import; do NOT advertise sub-second cold startup. Existing EPS Worker persists engines but fresh Ghostscript FS per document. Future optional performance work: independently validate parallel engine loading or a narrowly proven painted-Corel fast path; never replace full PostScript interpretation with an unsafe regex.
- At0.005mm original-node ceiling rejects denser Union and keeps16issues with warning; at0.02/0.046/0.1 accepts396/312/249nodes,0issues. Union off retains16issues. Kalin regression still rejects21872 against3152source and keeps1972/3issues partial. Full cross-batch coverage remains unsupported on large inputs; no claim of universally clean arbitrary files/settings.
- Root causes/decisions: F-030 zoom PNGs had clipping baked into pixels (old CSS-only fix insufficient); replace usage with full native SVG paths while approved PNG hashes/ZIP unchanged. F-031 intermediate272-node ceiling blocked valid396-node Union although source had439; now final ceiling is original source. F-029 selected-only normalization loop now tracks selected object references/replacements and leaves unselected compounds byte-identical. Pre-Union segment stats explicitly labeled; cancelled Union no longer falsely claims unified silhouette.
- Failed test attempts retained: unpainted EPS wires initially misclassified as separate filled solids in roundtrip test; corrected to aggregate nested-wire containment while retaining exact nodes/complete WASM and hole checks. New zoom inverse check first used too-strict1e-7 absolute tolerance for SVG float DOM; uses2ppm relative with exact glyph and actual viewBox change still mandatory. Final PR/main CI had no failures; publication transport reused existing workflow gates.
- Next: preserve this baseline; inspect remaining large-file cross-batch relationships and cold-engine setup separately. Do not remove node ceiling or tolerance/topology/serialization checks. Canonical source release merge e50d0c7; documentation-only follow-up may advance main without runtime differences.

--- Earlier chronological snapshots below ---
# Active candidate: 0.2.0-alpha.37 (NOT YET PUBLISHED)

## 0.2.0-alpha.37 — Union healing and complete zoom icons (2026-10-23)
Base main80089d1745898e1068db44a2a8b58aa5c6c2cd35; branch fix/overlap-healing-zoom-alpha37. Re-read prior Relief Forge chats and F-013/014/015/016/027/028/029. Existing Clipper tool from alpha.27 handles filled compatible objects and compound rings. Actual supplied8048531: source439anchors/43issues; optimized272/16; valid Union+refit396/0 with complete WASM diagnosis. Alpha.36 rejected it solely because396>272 despite396<439. Change the budget to preserve original-document ceiling, allowing necessary intersection cuts while still blocking kalin1972->21872 against3152source. No tolerance/quality/serialization safeguards removed.
Inspected original zoom PNGs: plus crop includes adjacent fragments and truncated plus; minus crop includes a button edge. CSS cannot recover missing pixels. Use complete native SVG plus/minus within the existing controls; preserve original approved raster hashes. Fix selected-only compound normalization to exclude unselected source objects. Re-run all native/JS/WASM/browser/real-file checks before publishing. Private EPS remains ignored.

# CURRENT PUBLISHED: 0.2.0-alpha.36

## 0.2.0-alpha.36 — publication and live-site verification SUCCESS (2026-10-23)
- Functional PR48 https://github.com/tohaa28/relief-forge/pull/48 merged d3e9230e931a20629933cdd007ed4842be0ae6a8. Initial main39983346199 FAILED the mode-matrix project-save race and did NOT deploy. This remains historical, not reclassified as success.
- Follow-up PR49 https://github.com/tohaa28/relief-forge/pull/49 merged 005866ff9bb503a9ab42e0719d2991d5c3479f43. Final PR CI https://github.com/tohaa28/relief-forge/actions/runs/39983892161 SUCCESS; earlier superseded fbf0df3 CI39983756498 CANCELLED (not passed).
- Main production https://github.com/tohaa28/relief-forge/actions/runs/39984099761 SUCCESS: build and deploy. Site https://tohaa28.github.io/relief-forge/ is alpha.36. Fresh Rust17/17, JS196/196, WASM ABI and actual primary+8-mode Chromium browser gates PASS.
- Independent Windows Chromium LIVE site test after deploy: private kalin original3152 -> AFTER1972 anchors; both downloaded outline and original-color EPS parsed directly and each contained exactly1972 m/L/C anchors; project also1972 commands, Undo history retained, no pageerror. This resolves the observed old-result21872 growth on that input. Other private EPS checks and four-tolerance/Union matrix recorded above. Private binary/screenshot evidence remains local ignored; never commit original geometry.
- Native kernel old/new JSON identical121cases; measured2000-node ring1500->37ms (~40x), repeated1470->26ms (~56x), NOT an end-to-end app speed guarantee. Bounds computed once per batch instead of per marker.
- Confirmed fixes: false opens from split windows; lowercase Corel curves; independent optimization safety; post-Union node growth guard; exact serialized AFTER; preserved/wrapped button icons; source filename; actual selected-object scope invalidation; stale import settings debounce cancelled. Save EPS preserves established exact-snapshot commit+Undo contract.
- Limits: private kalin AFTER retains3diagnostic issues and partial cross-batch coverage, explicitly warned; no mathematical certification of arbitrary curves. Native/kernel/source-owned/browser coverage documented, not a claim of all possible files. Firefox failed to launch locally (spawn UNKNOWN) and is NOT user-verified. ArtCAM/Corel external-app importer not newly verified.
- Next independent improvement: inspect3remaining kalin issues against real curve semantics; extend complete cross-batch relationships with performance measurements. Keep current safe partial-coverage warning until full coverage is actually established.

--- Previous chronological handoff snapshots follow ---
# 0.2.0-alpha.36 — main deploy FAILED, debounce follow-up pending
PR48 merged d3e9230. Main39983346199 failed at mode-matrix second project download; no deploy. Follow-up branch fix/alpha36-import-debounce cancels old settings timer on import, waits for debounce/stream completion in browser regression. Re-run full CI then merge and require main build+deploy SUCCESS. Prior alpha.32 remains live.

# 0.2.0-alpha.36 — PR48 verification, publication pending
Base8f9afb8; branch fix/alpha32-verified-pipeline-alpha36. PR48 first head1c49eca CI39982180020 SUCCESS17Rust195JS+freshWASM+Chromium. New scope guard and browser-mode matrix need final CI, then merge and main build/deploy success. Private kalin3152->1972, old exported21872 rejected; 145->3 issues partial. Kernel exact differential121; 40x measured2000-node case. Firefox failed to launch, not verified. Full history below.

# Active release: 0.2.0-alpha.36

## 0.2.0-alpha.36 — alpha.32 continuation, 2026-10-23
Base main 8f9afb8 (user rollback to exact alpha.32). Branch fix/alpha32-verified-pipeline-alpha36. Reviewed and ported F-025 diagnostic provenance, F-027 responsive buttons, F-028 AFTER/export node budget and geometry equality, Corel lowercase curves from archived alpha.35. This is an explicit new release, not a claim that alpha.32 already had those fixes. New: batch-scoped bounds validator computes each contour box once instead of rescanning nodes for every issue. Snapshot local to each job, no stale mutable global cache. Native Rust and fresh WASM must pass CI (Cargo unavailable locally). JS/browser/private EPS checks in progress. No publication or user verification yet. Full cross-batch diagnosis remains partial. Private EPS stays ignored.

# ОПУБЛИКОВАННОЕ ТЕКУЩЕЕ СОСТОЯНИЕ — Relief Forge 0.2.0-alpha.32

**Пользовательский откат выполнен 2026-10-23.** `main` после PR #46: `2dfadad1c8f342733da857b0585540dacd46c95e`. Точный исходный релизный commit alpha.32 `4ad8efd1801be16d4c37472fda4989f9e3afbf06`. Проверка Git-tree после merge: 0 различающихся файлов вне append-only документации (runtime, package/Cargo, scripts, tests and Pages workflow identical).

- PR: https://github.com/tohaa28/relief-forge/pull/46
- PR CI: https://github.com/tohaa28/relief-forge/actions/runs/39964713772 — **SUCCESS**, JS 167/167, Rust 15/15, WASM ABI PASS.
- main production: https://github.com/tohaa28/relief-forge/actions/runs/39964842575 — **build SUCCESS и deploy SUCCESS**.
- Сайт: https://tohaa28.github.io/relief-forge/
- Резервная alpha.35 до отката: `archive/alpha35-before-alpha32-rollback-20261023` -> `bb56f9b11976fd75199b3b16f0f377be3df5bc18`; не удалять. Подробный протокол: `docs/history/ROLLBACK_ALPHA32_20261023.md`.
- Старые известные недостатки alpha.32 сознательно возвращены (алгоритмы, диагностика, интерфейс, export). Chromium smoke из alpha.35 отсутствует в восстановленном alpha.32 workflow; пользовательская Windows/Firefox проверка отдельно не подтверждена.
- Любые прежние заголовки ниже «готовится», «не опубликовано» — датированные этапы до успешного результата; не считать их нынешним статусом.
- Этот коммит только документирует уже состоявшийся откат, исходники приложения не меняет.

---

# Актуальный статус: возвращаем Relief Forge к 0.2.0-alpha.32 (23.10.2026)

- **Целевая версия: 0.2.0-alpha.32**, точный оригинальный merge PR #38: `4ad8efd1801be16d4c37472fda4989f9e3afbf06`, дерево `6cd82072293720fb5810d669de8db9cd8b48b36a`.
- Последнее до отката main: `bb56f9b11976fd75199b3b16f0f377be3df5bc18` (alpha.35). Резерв: `archive/alpha35-before-alpha32-rollback-20261023`.
- Код, WASM source, UI, старые тесты, lockfiles и workflow: **из настоящей alpha.32**, а не версия-подмена. Актуальные длинные журналы сохранены как документация.
- Ветка отката: `rollback/restore-alpha32-20261023`. История метода и предостережения: `docs/history/ROLLBACK_ALPHA32_20261023.md`.
- Обязательно проверить SHA контрольного дерева, PR CI (Rust/npm/WASM), затем merge и **main GitHub Pages build+deploy SUCCESS**. До них публикация alpha.32 НЕ подтверждена. Не делать force-push.
- Возвращаются известные дефекты alpha.32, в том числе отсутствие поздних защит экспорта EPS и интерфейсных исправлений; не утверждать обратное.
- Поздние заметки ниже являются архивными, их текущие «alpha.35 published» больше не означают целевую рабочую версию.

---

# Current verified release — 0.2.0-alpha.35 (2026-10-23 UTC)
- Functional PR #44 merged into main, SHA aba78e90be219aae93769fc84f9e78d6022a95c2; previous alpha.34 baseline db083eb92d1abf1b1cd64f876283ae7af47828a9.
- Final PR CI #39961633180 PASS (193 JS/15 Rust/WASM/actual Chromium browser), main Pages #39961788762 PASS build + deploy. Production URL https://tohaa28.github.io/relief-forge/ . A subsequent documentation-only PR may move main SHA; always check actual main and workflows before editing.
- Alpha.35 includes icon sizing/wrapping fixes, toggles preserving SVG, current source filename in HTML workspace, stale EPS Worker cache key fix. EPS node inflation risk F-028: after Clipper/refit real M/L/C/Q budget; optional Union rejected if it adds nodes; EPS numeric geometry compared to exact cached AFTER prior to download. F-027 tracks buttons and textContent. Source modules web/preview-node-budget.js, web/eps-export.js, web/app.js.
- User's specific _result.eps with excessive points was NOT attached here; only synthetic roundtrips and CI browser smoke verified. For next input request exact original + result and compare per-object M/L/C tokens against BEFORE/AFTER before changing any algorithm; also test external ArtCAM/Corel importer.
- Appendix below is append-only historical snapshots and may contain outdated 'pending' notes. Current top-of-file status prevails; full logs in docs/DEVELOPMENT_LOG.md and logs/actions.jsonl.
# alpha.35 cache audit: EPS Worker/pipeline deep imports still had alpha.34 keys; fixed to alpha.35. Added tests/module-cache-version.test.mjs to prevent recurrence. PR #44 source head in-progress, CI needs a fresh success and main Pages deploy.
# alpha.35 CI environment experiment: PR 39960501240 JS/Rust/WASM green, apt install-deps slow. Next commit removes unconditional apt upgrades but RETAINS real Playwright Chromium Worker/WASM browser smoke; failure must block publication. Outcome pending.
# alpha.35 PR #44 CI 39960304986 failed 191/192 JS on test Russian message wording; negative EPS tampering made strict, re-run pending. Rust 15/15 pass. No release until green CI+Pages. 
# alpha.35 PR #44 CI 39960067760 FAILED 189/192 JS (RGB error wording, obsolete static After source regex, VM preview fixture missing new budget hook); fixed test code in follow-up. New CI mandatory. Alpha.35 NOT deployed. Real EPS from user still needed for bytewise reproduction.
# CURRENT alpha.35 (0.2.0-alpha.35): PR #44, head commits 5b02ead then 9cf559; source guard for excessive EPS real nodes F-028. Original main baseline db083eb92d1abf1b1cd64f876283ae7af47828a9. CI first run 39958428866 FAILED 186/188 JS due stale version test and missing release-version in NEXT_CHAT_START, 15 Rust PASS. Previous main push run 39956907984 FAILED due slow apt download exceeding 8m; apt timeout increased to 20m (smoke retained). NO publication of alpha.35 until PR/main CI SUCCESS. Latest CI/PR SHA must be rechecked on continuation.
# Active change: alpha.35 UI controls and filename (SOURCE WRITTEN; PR/CI/DEPLOY PENDING)
Base main (rollback): db083eb92d1abf1b1cd64f876283ae7af47828a9; branch fix/toolbar-file-badge-alpha35.
Task: fix zoom icon/plus duplication and lost info-button SVG, make narrow buttons wrap, show confirmed input filename within workspace without affecting EPS/SVG geometry. F-027 + DEVELOPMENT_LOG details.
Tests added: toolbar-filename.test.mjs; browser-smoke.mjs checks 1440/1024/820/390px, info toggle, EPS/SVG filename. No CI evidence yet for alpha.35; do not claim published until merged PR plus main Pages success.
Previous published functional release alpha.34, PR #42 merge 1d66be8028ae706ed8d26748f24eb5f85059172a, CI 39956322917 SUCCESS. Previous docs PR #43 main db083eb92d1abf1b1cd64f876283ae7af47828a9.
Next: open PR, verify JS/Rust/WASM/Chromium; merge and check main build/deploy; then append actual final evidence rather than overwrite history. User Windows Firefox verification remains separate.
# FINAL verified alpha.34 handoff — 2026-10-23 12:52 UTC
- Functional release: 0.2.0-alpha.34; merged PR #42; release merge SHA 1d66be8028ae706ed8d26748f24eb5f85059172a.
- PR final CI: https://github.com/tohaa28/relief-forge/actions/runs/39956129539 — build SUCCESS; 184 JS, 15 Rust, actual compiled WASM ABI and real Chromium Worker/WASM browser smoke PASS.
- Main production: https://github.com/tohaa28/relief-forge/actions/runs/39956322917 — build SUCCESS and deploy SUCCESS; https://tohaa28.github.io/relief-forge/ .
- Last pre-release baseline for rollback: main 1f21fe7bda764a02c4404f6e5aaa3c947af1e6e9 (alpha.33). Documentation-only follow-up branch docs/alpha34-release-evidence does not alter functional version.
- Test evidence: private 8049569(1).eps local 53 closed rings; curve optimization 712→597 commands at 0.046 mm, 0 false open reports in local Worker/WASM before/after; full cross-batch verification NOT supported and user Windows smoke still outstanding.
- New first command for next chat: fetch actual main SHA/last Actions (the status above is a timestamped snapshot), then read F-025/F-026 and latest DEVELOPMENT_LOG. Preserve all history; no EPS bytes in Git.
# CI state correction, 2026-10-23T12:48Z: PR #42 alpha.34 browser step of workflow 39954313037 remained in_progress >13m after successful Rust/JS/WASM; instrumentation follow-up separates apt, shell download, Chromium smoke. DO NOT claim deployed until green PR + main build/deploy. See DEVELOPMENT_LOG.
# Latest active session: 0.2.0-alpha.34
Base/main checkpoint: 1f21fe7bda764a02c4404f6e5aaa3c947af1e6e9 (PR #41, main workflow 39952034182 success).
Branch: fix/diagnostic-topology-alpha34. Task: false open contours in private 8049569(1).eps and verification of optimization. See F-025 and latest DEVELOPMENT_LOG for exact methods, metrics and failed attempts. Local final checks: 184/184 JS, published unchanged WASM ABI, Chromium private EPS + synthetic BEFORE/AFTER/Apply/EPS export/Undo PASS. Private EPS export/reimport: 53 closed rings, 597 segments. Functional local commit cb19b7c. User explicitly authorized publication in the follow-up. Prior approval blocker resolved. Direct git push lacks HTTPS terminal credentials; publish reviewed tracked files via connected GitHub API. Next: PR fresh Rust/WASM/JS/browser CI, merge after checks, verify main deploy. Private EPS not in Git. No Windows user verification. Previous handoff retained below to preserve historical evidence; alpha.33 references below are historical.

# НАЧАТЬ ЗДЕСЬ — передача «Доктора Узелкова» в следующий чат

**Срез состояния:** 23 октября 2026 года. Это рабочая точка входа, **не** неизменяемый исторический журнал. Перед новой правкой проверить GitHub: после этой даты главная ветка или PR могут измениться.

## 1. Проект и достоверный контрольный статус

- Приложение: **«Доктор Узелков» / Relief Forge**, браузерная Rust/WASM программа в стиле CorelDRAW/ArtCAM для диагностики, лечения, объединения и оптимизации векторных узлов.
- Репозиторий: **https://github.com/tohaa28/relief-forge**
- Сайт: **https://tohaa28.github.io/relief-forge/**
- Последняя подтверждённая функциональная версия: **0.2.0-alpha.33**
- Проверенный merge commit main: **\`fee205c17a729ed246f0760f2cebd29352e73cd9\`**.
- Последний функциональный PR: [#39 — CorelDRAW c/C EPS](https://github.com/tohaa28/relief-forge/pull/39), merged 2026-10-23T11:44:09Z.
- Последняя подтверждённая main+Pages публикация: [Actions #39948169551](https://github.com/tohaa28/relief-forge/actions/runs/39948169551) — **build success + deploy success**.
- Последняя CI выборка: **171/171 JS, 15/15 Rust, WASM ABI PASS** (job #120395840760). Browser smoke на проблемном Windows ПК **не получен**.
- Исходный пример проблемного ПК: \`8049569_10_29.10.eps\`. Он **не** включён в GitHub и не должен публично коммититься; когда требуется повторная проверка его байтов в другой сессии, нужно убедиться, что исходный файл реально доступен через upload/Library, а не воображать предыдущий container path.

**Документационная контрольная точка:** [PR #40](https://github.com/tohaa28/relief-forge/pull/40) **объединён** с main, merge SHA **\`f1f8a71b0f8b2d3f3575c496c2d0a4d0093548b0\`**. Подтверждённые проверки: [PR CI 39951134402](https://github.com/tohaa28/relief-forge/actions/runs/39951134402) — **176/176 JS, 15/15 Rust, WASM ABI PASS**, [main build + Pages deploy 39951445491](https://github.com/tohaa28/relief-forge/actions/runs/39951445491) — оба SUCCESS. Изменён только процесс записи истории и документация, функциональная версия остаётся **alpha.33**. Последующий status-only PR может иметь новый SHA; при следующем обращении всегда сверять актуальный main и последние Actions, а не фиксированный хеш в этом снимке.

## 2. Что именно произошло с последним EPS

Пользователь прислал diagnostic JSON, где:
\`\`\`json
{"version":"0.2.0-alpha.31","source":"8049569_10_29.10.eps",
 "documentPaths":0,"elementCount":0,
 "canvasRect":{"width":989,"height":786},
 "mascotHidden":true,"issues":[],"ok":true}
\`\`\`
Это было **не отсутствие canvas**: пустой импорт ошибочно выдавался за success. В alpha.32 добавлен \`EPS_EMPTY_GEOMETRY\` и защита незамены прежнего doc.

После загрузки оригинала выяснилась настоящая причина: EPS CorelDRAW 2020 содержит **53 замкнутых контура, 654 команды curveto (651 \`C\` и 3 \`c\`), 58 \`L\`**, но нет печатных операторов paint до \`N/newpath\`. Ghostscript рисует пустую страницу. Консервативный recovery отвергал весь EPS из-за трёх \`c\`; обе формы в CorelDRAW Prolog эквивалентны \`curveto\`. В alpha.33 [#39](https://github.com/tohaa28/relief-forge/pull/39) паттерн заменён на \`[Cc]\`, настоящие кубические команды восстановлены, в кеше \`corel-outline.js?v=alpha.18\` заменено на \`alpha.33\`. Независимое локальное SVG восстановление было визуально проверено, CI green. На проблемном ПК пока не проверено.

**Первое практическое действие следующей разработки**, если тема импорта продолжается: взять новую диагностику пользователя/файл и проверить, отображаются ли все 53 объекта в published alpha.33. Не начинать снова с исправления маскота: его скрытие уже подтверждено отчётом, а причина данного EPS известна.

## 3. Где сохраняется вся память проекта

1. [AGENTS.md](../AGENTS.md) — обязательные правила.
2. **Этот файл** — моментальный актуальный handoff, команды продолжения.
3. [История релизов alpha.1–alpha.33](history/RELEASE_CHRONICLE.md) — что было сделано по версиям/PR.
4. [Реестр неудач F-001–F-024](history/FAILURE_REGISTER.md) — симптомы, неверные методы, первопричины и проверки.
5. [Алгоритмы и технические решения](history/METHODS_AND_DECISIONS.md) — границы, order of operations, safe guards, Known limits.
6. [Протокол ведения журнала](history/WORKLOG_PROTOCOL.md) — обязательный процесс для всех будущих PR.
7. [Полный исторический HANDOFF.md](../HANDOFF.md) и [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) — первичная накопленная хронология (старые разделы не равны актуальной версии).
8. [Журнал действий JSONL](../logs/actions.jsonl), [FEATURE_MATRIX.md](FEATURE_MATRIX.md) и [REA_WORKFLOW.md](REA_WORKFLOW.md).
9. Фактические PR, commit history и workflow runs GitHub — итоговый источник для публикации, а не память о прошлой реплике.

**Порядок чтения:** AGENTS → THIS FILE → FAILURE_REGISTER → METHODS → RELEASE_CHRONICLE → last few DEVELOPMENT_LOG entries → GitHub latest main/CI → code.

## 4. Текущий пайплайн — не менять порядок

\`\`\`
EPS/PDF/SVG → interpreter/fallback → editable real M/L/C/Q geometry
 → diagnostics → auto point repair/smoothing → optimization source
 → Clipper true Union compatible filled polygons → cleanup topology/XOR
 → final post-Union Bezier refit → EXACT AFTER snapshot
 → diagnose AFTER residual errors → Apply with Undo or save cached AFTER
\`\`\`

- \`M/L/C/Q\` реальных curveNodes не смешивать с sampled points; чужие кривые не flatten без явной Boolean операции.
- Save EPS **не** перерасчитывает лечение/диагностику; реальный AFTER со всеми остаточными ошибками сохранять по осознанному выбору.
- Union должен удалять внутренние overlap границы и сохранять отверстия; compound path без удаления пересечений ≠ true Union. После Union рефинить \`L\` в реальные C, иначе оптимизация «не работает».
- Для неподдерживаемых/разноцветных/открытых путей Union не применять.
- При неудачном EPS импорт не должен заменять старый документ; пустой PDF допустим.
- Untouched EPS с original CMYK — byte-for-byte; изменённый EPS только известный solid RGB с явными ограничениями.

## 5. Проверить первым при начале нового чата

\`\`\`text
GitHub main SHA (получить, не угадывать):
Последний релиз/version (Cargo, package, UI и ?v=):
Последний merged PR и head/merge commit:
Последний workflow: build job, deploy job, conclusion:
Есть ли незакрытые PR / conflict?
Исходный пользовательский EPS доступен сейчас как файл? Где фактически?
Текущая задача пользователя и рамки изменения:
Предыдущий контрольный commit для rollback:
\`\`\`

Не искать source внутри другого репозитория, не изменять Макетную, PrintCheck, VectorForge или подарочные конструкторы.

## 6. Команды и среда

\`\`\`bash
npm ci
npm test
cargo test --locked
cargo build --locked --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/relief_forge.wasm web/engine.wasm
node scripts/check-wasm.mjs
npm run serve
\`\`\`

Windows: \`BUILD_WINDOWS.bat\` или \`powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\Build.ps1 -Serve\`.

Не обещать запуск Rust/браузера локально без инструмента. В облаке GitHub Actions проверяется build/deploy; Windows Chrome пользователя — отдельный уровень.

## 7. Следующие технические проверки (если пользователь не назначит другую задачу)

1. Пользовательский smoke на **том же проблемном ПК**: alpha.33, Ctrl+F5, импорт \`8049569_10_29.10.eps\`, фактические 53 объекта и видимое рабочее поле; зафиксировать workspace report и result.
2. Проверить EPS output этой геометрии: \`_result.eps\`, размеры исходной развертки, реальные 654 C + 58 L до лечения, диалог цвет/без цвета. Не приписывать непечатаемому исходнику оригинальную толщину/цвет.
3. ДО/ПОСЛЕ: счёт реальных узлов, количество исправлений, корректная пространственная подсветка остатков, Undo и editor после Union, повторный импорт сохранённого EPS. Особое внимание малым элементам и holes.
4. Реальный многостраничный PDF: page picker, выбранная страница, embedded raster и ограничения, затем сохранение в EPS.
5. Performance: измерить время загрузки/Corel shortcut vs Ghostscript; прогресс и память на >2000, 10000+ точек. Не писать «ускорили N раз», пока нет измерения.
6. Арткам-эквивалентность: только эталонные файлы/GUI capture/REA, не из логики программы.

## 8. Что именно писать в конце новой сессии

- Любой FAIL, гипотезу, отвергнутый подход и итог — \`docs/DEVELOPMENT_LOG.md\` + \`logs/actions.jsonl\`.
- Новую ошибку — \`docs/history/FAILURE_REGISTER.md\`; новую методику — \`docs/history/METHODS_AND_DECISIONS.md\`.
- Изменения релиза — \`docs/history/RELEASE_CHRONICLE.md\` и \`docs/FEATURE_MATRIX.md\`.
- Обновить **этот документ** актуальным SHA, PR, build/deploy, следующим шагом.
- Сохранить checkpoint GitHub PR/merge после проверок; ни одного выдуманного тестового результата.
- Не удалять старую историю и не публиковать приватный EPS.

## 9. Текст для первого сообщения следующего чата

> Продолжи разработку «Доктора Узелкова» в \`tohaa28/relief-forge\`. Начни с \`AGENTS.md\`, \`docs/NEXT_CHAT_START.md\`, \`docs/history/FAILURE_REGISTER.md\`, \`docs/history/METHODS_AND_DECISIONS.md\`, \`docs/history/RELEASE_CHRONICLE.md\`, \`HANDOFF.md\` и журналов. Получи фактический latest main SHA, PR и CI GitHub. Сохраняй все удачные и неудачные попытки подробно, включая ограничения и контрпримеры. Не заменяй реальные Безье sampled points, не запускай лечение повторно при Save EPS. Для очередной задачи создай feature branch, тесты, контрольную точку, PR и обнови NEXT_CHAT_START перед завершением.

### Upcoming EPS-specific guards
- Node-budget check after Clipper/refit compares real M/L/C/Q AFTER with pre-Union optimized commands; fallback if increased. UI displays the actual final count, not only optimizer's intermediate number. Export parses and compares every numeric PostScript command with cached AFTER before download; synthetic and browser regression tests added. User's actual failed output file not supplied: do not assert byte-for-byte reproduction.
