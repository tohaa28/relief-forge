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
