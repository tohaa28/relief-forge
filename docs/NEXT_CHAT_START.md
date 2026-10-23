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
