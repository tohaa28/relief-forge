# alpha.42 candidate methodology — 2026-10-26 (PR #62, NOT published)
- Keep exact opaque same-paint native duplicate removal separate from lossy Boolean polygonization. Retain later matching source without any added L/C nodes; never dedup transparency/masks/strokes or objects outside selected scope.
- Union first (after conservative native point repair), refit Clipper boundary, then smooth and optimize, then validate/diagnose actual AFTER. Both normal and large EPS use the same ordering and cached EPS snapshot.
- Source-dominant union detected through quantized Clipper XOR; native source cubic/handles remain EXACT. Other true cuts remain sampled Clipper + bounded postrefit; fully native Boolean split-and-trace remains an outstanding problem, not claimed repaired.
- Quality sampling in large documents: if global sampling cap exceeded, independently verify every modified path and candidate-contact pair via bounding-box broadphase. Budget exhaustion or ambiguous contacts reject modification; no silent certification.
- GPU: WGSL WebGPU runtime arithmetic f32 is unsuitable as final exact Bézier/Boolean authority under sub-0.01mm tolerances. Optional GPU spatial candidate generation could be evaluated after correctness regression on GTX1080/RTX3050, with padded bounds, deterministic CPU f64 verification and measured transfer overhead.
- Persistent open items: exact native provenance for F-037, full cross-batch diagnostic pairing F-038, micro-figure semantics, robust Boolean reconstruction on intersecting non-contained cubic arcs, quality/per-group fallback for Union rather than global node rollback. Protect all existing holes, paint and Undo + EPS=AFTER invariants.

# Технические решения и методы разработки «Доктора Узелкова»

**Состояние, от которого исходить:** 0.2.0-alpha.33, GitHub main \`fee205c17a729ed246f0760f2cebd29352e73cd9\`, [успешный CI/Pages](https://github.com/tohaa28/relief-forge/actions/runs/39948169551). Это **архитектурный справочник** и причины выбора методов, не обещание, что каждый PDF/EPS проверен на конкретной ОС.

## 1. Неизменные пользовательские требования

1. Вход: CorelDRAW EPS (в том числе непечатаемые контуры), SVG, PDF, JSON проекта. Сохранять физический размер в мм и входное имя с суффиксом \`_result\` при экспорте EPS.
2. Реальные Безье: хранить \`M/L/C/Q/Z\` и управляющие точки. Экранная выборка/Flatten НЕ равна редактируемым якорям. «Узлы кривой» и панель должны показывать фактические команды.
3. Сравнение **ДО/ПОСЛЕ**: одна согласованная геометрия результата. Остаточные проблемы подсвечиваются именно на результате ПОСЛЕ. Лечение/Union/оптимизация должны влиять на одни и те же данные, которые затем сохраняются.
4. «Автоисправление» — заголовок параметров и найденных ошибок; изменение геометрии подтверждается единственной кнопкой «Применить изменения» либо явно выбранным Save; undo обязателен.
5. Заданный пользователем допуск оптимизации (мм), сглаживания (мм), диагностики (мм). Нельзя смешивать их размерности, скрыто менять или приписывать приложению допуск, которого оно не соблюдает.
6. Потребности препресса: правильные внешние силуэты и отверстия, true Boolean Union для наложенных совместимых объектов; неоднозначные касания/разноцветные объекты без агрессивного автоматического склеивания.
7. Статус/процент на больших файлах и отмена; запрет выдавать частичный поиск замечаний за полную проверку.
8. Цвет: режим EPS «без цвета» или «с исходной окраской». Исходные CMYK/ICC не объявлять сохранёнными после перекодирования через RGB, если нет доказательства. Untouched EPS — исходные байты при совпадении geometry stamp.
9. Маскот только для действительно пустого начального поля; утверждённые PNG/пиктограммы не изменять без отдельного разрешения.
10. История открытых файлов/исправлений/экспорта, версии в UI, переносимый GitHub handoff. Все подтверждения испытаний разделять.

## 2. Границы компонентов

| Уровень | Основные файлы | Контракт |
|---|---|---|
| UI и документ | \`web/app.js\`, \`web/index.html\`, \`web/style.css\` | Создаёт/хранит doc, отвечает за Preview/Apply/Undo, маркеры, импорт, export, статус |
| EPS worker | \`web/eps-worker.js\`, \`web/eps-pipeline.js\` | Прогресс, отмена, ошибки, \`{svg, metadata, logs}\`; тяжёлые движки не блокируют UI |
| Corel fallback | \`web/corel-outline.js\` | Только узкое подмножество безопасно распознанных непечатаемых Corel EPS, без произвольного PostScript eval |
| PDF | \`web/pdf-pipeline.js\` | Выбор одной из страниц, MuPDF SVG, физические размеры страницы; растр сохраняется как растр |
| SVG representation | \`web/rich-svg.js\` | Объекты с \`points\`, \`commands\`, \`artwork\`, \`paint\`, \`closed\`, \`offset\` |
| Point editor | \`web/curve-edit.js\` | Реальные endpoint/control-handle операции, не sampled diagnostic points |
| Autoheal | \`web/point-repair.js\`, \`web/curve-optimizer.js\`, \`web/auto-repair.js\` | Исправление узлов, сглаживание/оптимизация с параметрами; Undo/сравнение |
| Boolean | \`web/overlap-merge.js\`, \`web/polygon-union.js\`, \`web/union-node-cleanup.js\`, \`web/union-refit.js\` | True fill union, hole topology, очистка, final refit в реальные C |
| Diagnostics | Rust \`src/lib.rs\`/WASM, \`web/worker.js\`, \`web/after-diagnostics.js\`, \`web/issue-markers.js\`, \`web/large-file-support.js\` | Батчи, владелец исходного контура, частичное покрытие, пространственные маркеры |
| EPS export | \`web/eps-export.js\`, \`web/eps-paint.js\`, \`web/after-result.js\` | Экспорт ТОГО ЖЕ подтверждённого ПОСЛЕ; проверка цветового режима перед Apply |
| Workspace reliability | \`web/mascot-visibility.js\`, \`web/workspace-health.js\`, \`web/bootstrap-watchdog.js\` | Диагностика layout/visibility/content, ручной отчёт, безопасный wireframe |
| Тесты/CI | \`tests/*.test.mjs\`, \`src/lib.rs\`, \`scripts/check-wasm.mjs\` | Раздельные npm/Rust/WASM/Pages проверки |

Фактические пути перед модификацией перепроверить в текущем \`main\`; это карта релиза alpha.33, не автоматическая схема зависимостей.

## 3. EPS: главный порядок импорта и почему он такой

\`\`\`
Файл EPS (сохранять bytes + имя)
 → epsWorker
 → быстрая проверка консервативного Corel path-only паттерна
      ├─ распознан: извлечь реальные m/L/C/c/@c/N → безопасный SVG
      └─ не распознан: Ghostscript (EPS/PostScript → vector PDF) → MuPDF (SVG)
 → importRichSvg(svg, unitsPerInch=72)
 → проверить объектный состав, размеры и count
      ├─ EPS 0 объектов: ЯВНАЯ ОШИБКА, текущий doc не трогать
      └─ действительный результат: doc.paths, sourceFileName, epsImport
 → проверка рабочего SVG и fit → диагностика
\`\`\`

### Почему не распознавать весь EPS regex-ом

PostScript исполняемый язык с процедурами, словарями, условиями, матрицами, вложенными изображениями и шрифтами. Консервативный Corel recovery допускается только когда **прямо доказано** соответствие известной форме без paint. Если встретился неизвестный оператор или сложная обработка клиппинга — отказаться от recovery и использовать интерпретатор. Слепой парсинг любых строк \`C\`/координат даёт опасные ложные контуры.

Для \`8049569_10_29.10.eps\` три lower-case \`c\` не означают «неподдерживаемый оператор»: Prolog задаёт \`/c/curveto\`, их шестипараметровая форма эквивалентна \`C\`. Исправленный parser допускает именно \`[Cc]\`; не обобщать на любые неизвестные буквы. Оригинальный файл 80 192 байта **не добавлять в публичный GitHub**, использовать синтетический fixture.

### Геометрия и формат

- \`BoundingBox\` EPS измеряется в PostScript pt, размеры внутреннего документа — мм. Для EPS SVG используется 72 единицы на дюйм, для обычного SVG по умолчанию 96 (по контракту rich importer).
- Реальные вершины = \`M\`, \`L\`, endpoint \`C\`/\`Q\` и управляющие ручки; \`sampledContours\` создаёт геометрию **только** для анализа/Boolean.
- SVG \`artwork\` хранит оформление и матрицы; canvas rendering может использовать исходную разметку. Не удалять её молча и не считать \`stroke\` диагностического recovery настоящей печатной краской/толщиной.
- Original EPS сохранён byte-for-byte там, где \`originalGeometryStamp\` совпадает с документом; при изменении геометрии невозможно честно восстановить все PostScript/CMYK исходные команды.

## 4. PDF: отредактируемая страница и ограничения

\`\`web/pdf-pipeline.js\`\` использует имеющийся локально MuPDF WASM:
- Проверка заголовка PDF и ограничения размера (64 МБ), числа страниц (не более 500).
- Для нескольких страниц — выбор **одной** пользователем; выбранная страница рендерится в SVG path-команды (\`text=path\`).
- Реальная векторная геометрия должна оставаться векторной; изображения — не «автовекторизировать».
- Намеренно пустая страница PDF допустима, в отличие от EPS с 0 объектов после конвертации.
- Программа в alpha.33 **не экспортирует обработанный PDF**, выход остаётся EPS.
- Зашифрованные/сложные PDF, ICC, transparency требуют отдельных эталонов, а не blanket-гарантий.

## 5. Лечение → Union → Post-Union → ПОСЛЕ → Save

Критически важен **порядок**:

\`\`\`
исходный Doc / выбранный scope
  ↓ диагностика (полная либо явно partial)
  ↓ исправление обоснованных дефектов / сглаживание исходных C
  ↓ оптимизация исходных C (параметры пользователя)
  ↓ Clipper true Boolean Union для совместимых закрытых одноцветных заливок
  ↓ topology-preserving cleanup (дубликаты, collinear, короткие безопасные)
  ↓ FINAL refit polygon→редактируемые M/L/C для объединённых объектов
  ↓ AFTER snapshot (одна геометрия для canvas / node editor / diagnostics)
  ↓ AFTER диагностика оставшихся дефектов (батчи, accuracy flags)
  ↓ пользовательский Apply (Undo checkpoint) и/или Save EPS из cached AFTER
\`\`\`

### Почему это строго

- Если оптимизировать **до** Union и остановиться: Clipper перепишет красивые Безье в тысячи \`L\`; пользователь увидит «оптимизация 50 точек», а редактор ПОСЛЕ — тысячу новых узлов. Так делать запрещено (F-016).
- Если заменить Boolean \`M…Z\` compound-only: перекрытия по площади останутся и диагностика будет считать внутренние границы (F-013). Не называть такое истинным объединением.
- Если безоговорочно удалять короткие рёбра: исчезают тонкие детали/отверстия/острые углы (F-015). Чистку проводить с границей отклонения и проверкой topology/XOR, при нарушении вернуть **неочищенный корректный Union**.
- Если в editable node mode показывать точки сэмплирования вместо \`commands\`: пользователь редактирует не ту геометрию, которая сериализуется в EPS (F-016).
- Если сохранять через повторное лечение: документы до и после Ctrl+S могут различаться, Undo/цвет/диагностика не согласованы (F-011). Только frozen AFTER snapshot.

### Clipper: безопасная область

- Boolean нужен для объёмно перекрывающихся **закрытых filled paths с одинаковым простым paint**; при fill-rule важно сохранить holes/counters.
- Разные цвета, stroke-only, маски/градиенты/неподдерживаемые blend modes оставлять отдельно.
- Операция выполняется через flatten → integer clipper → rings/holes. Контроль flatten tolerance и проверка объёмов/компонент, затем **refit** в кривые.
- Refit — численная аппроксимация, а не аналитическое тождество с оригинальными управляющими ручками. Документ и визуальный DX на малых элементах проверять на реальных макетах.

## 6. Диагностика на больших документах

- Native Rust ABI имеет ограничения размеров одного расчёта, поэтому работа с большим EPS требует разбивки на батчи.
- Для каждого sampled contour сохранять отображение индекса обратно на исходный объект; пересечения между независимыми блоками нельзя выдавать за проверенные.
- Пометка \`diagnosticComplete\` всегда привязана к **конкретному** snapshot \`source/result\`, допуску и scope. Частичная проверка != «замечаний ноль».
- Для overlay до 1000 маркеров распределять замечания по занятой пространственной сетке; индекс маркера соответствует первоначальному index ошибки (не индексу отобранной тысячи).
- Rust issue position вне вычисленного контура НЕ рисовать как истинную точку (ограниченная проверка source bounds), но диагностический coverage после отброса помечать неполным.

## 7. Применение и экспорт без скрытых изменений

- До открытия EPS Save modal вычислить \`chooseAfterSnapshot\`; проверить актуальность настроек, документа и режима объединения.
- Если нет замечаний и полный охват — обычный Save; если есть замечания/неполная проверка — предупреждение с выбором.
- Пользовательское подтверждение «сохранить с дефектами» означает **экспорт готового результата ПОСЛЕ**, а не возврат к оригиналу и не автоматическую повторную диагностику.
- На ошибке цветного экспорта не применять геометрию и не тратить checkpoint Undo.
- Режим \`original colors\`: untouched EPS byte-for-byte с CMYK; modified — только известные solid RGB свойства, ограничение заявлять в UI; \`outline\` без цвета для ArtCAM.
- Имя результата \`<original-stem>_result.eps\`; журнал успешной/неуспешной операции хранить отдельно от исходного файла.

## 8. Надёжность интерфейса и решение ошибок одной машины

- Нельзя судить об успехе импорта только по \`canvasStyle.display=block\`. Пользовательский alpha.31 JSON: холст 989×786, SVG visibility ок, **documentPaths=0/elementCount=0** — это **ошибка импорта**, а не GPU.
- \`workspace-health\`: сравнивать наличие SVG детей, фактический \`getBBox\`, viewport rect, \`viewBox\`, CSS, mascot/overlay; создавать читаемый отчёт, если не удалось восстановить.
- \`bootstrap-watchdog.js\` отдельный non-module скрипт на случай, если \`app.js\` даже не инициализировался.
- Маскот скрывать при начале/после любого успешного импорта; CSS fallback независимо от \`hidden\`, но не скрывать документ вместо маскота.
- Кнопка «Показать контуры» — чисто экранный fallback, не меняет геометрию, paint, EPS и историю. Не использовать её как «исправление пустого doc».
- Browser cache: версия в UI и версии URL импортируемых JS-модулей должны меняться **вместе**. Ошибка alpha.33: \`corel-outline.js?v=alpha.18\` продолжал ссылаться на старый модуль.

## 9. Методы проверки и доказательства качества

\`\`\`bash
npm ci
npm test
cargo test --locked
cargo build --locked --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/relief_forge.wasm web/engine.wasm
node scripts/check-wasm.mjs
npm run serve
\`\`\`

Минимальный набор каждого релиза:
1. Синтаксис/импорт модулей, тесты JS и native Rust, полный WASM ABI, build.
2. Синтетические кейсы пересечений, отверстий, нулевых сегментов, замкнутых C и открытых L.
3. Case EPS: видимый обычный; «непечатный» Corel; смешанные \`C/c\`; сложный Paint fallback; форматные ограничения.
4. PDF: настоящий одностраничный вектор, выбор страницы, пустой PDF, raster nested.
5. UI: ДО/ПОСЛЕ, \`Apply\`, Node edit from AFTER, Undo, Save EPS before/after and with remaining issues.
6. History: три слоя — Git commit/PR, \`docs/DEVELOPMENT_LOG.md\`, \`logs/actions.jsonl\` и failure register.
7. Отдельно GitHub Actions PR CI, merge SHA, main build+deploy, HTTP/live/browser smoke на реальном User-PC. Не смешивать эти статусы.
8. В случае неуспеха **сохранить failed run и причину**, даже когда повторный run зелёный.

## 10. Долгосрочные ограничения / исследовательские направления

- True ArtCAM 2018 parity требует runtime эталонов или REA/Ghidra подтверждений; из чужих скриншотов нельзя доказать эквивалентность.
- Большие EPS: межблочная геометрия не всегда полностью тестируется; производительность и RAM проверять на эталонах с разным числом контуров, а не одном гербе.
- Native color space after edited CMYK (PostScript inks vs RGB SVG) — отдельная задача, нельзя исправить словесной пометкой.
- Complex fills/masks/transparency and multi-page PDF simultaneous processing не реализованы; сложные PostScript программы требуют GS, не расширять узкий Corel regex до общей PS-машины.
- Проблемный Windows Chrome 155 ПК в момент публикации alpha.33 **не имеет подтверждённого нового пользовательского smoke-test**; можно считать устранённой конкретную причину на уровне парсера, но не гарантировать каждый браузер.
- История исходных макетов не должна уходить в публичный GitHub, кроме специально подготовленных синтетических/очищенных тестовых данных.

**Завершая новую сессию:** зафиксировать все изменения в [WORKLOG_PROTOCOL.md](WORKLOG_PROTOCOL.md) и обновить [NEXT_CHAT_START.md](../NEXT_CHAT_START.md) прежде, чем объявить завершение работы. 

## 11. alpha.34: provenance and optimization postconditions
Diagnostic windows carry source contour identity/closure/start; open-window flags are not source topology. A closed split includes the real closing edge, never a synthetic chord. Exact duplicate terminal endpoint is normalized only in a diagnostic copy; close-but-distinct ends remain real gaps. Both BEFORE/AFTER use mapDiagnosticIssue.
Independent curve-quality validation checks real segments and sampled topology before accepting smoothing/optimization/refit, also across objects before Union. New short segments and crossings are matched by location, not paid for by removing an unrelated old issue. Failure rolls back proposed geometry, preserves Undo and reports rejection. Sampling <=0.0025 mm and 2M comparison cap are conservative operational bounds, not proof against sub-resolution tangencies. Partial diagnostic coverage still explicitly shown. Private geometry never committed.

## 12. alpha.34 release and CI browser-test observability
- Quality gates remain cargo test --locked, npm test, fresh Rust wasm32 build, scripts/check-wasm.mjs, actual Playwright Chromium with worker/WASM and UI transfer/Undo/export; PR CI alone is not production.
- Keep Chromium dependency setup, headless-shell download and smoke in distinct timed Actions steps. During alpha.34 a combined step took 13+ minutes mainly before Chromium download, but PASSED; splitting steps improves attribution, not mathematical test strength. Evidence: PR runs 39954313037 and 39956129539.
- The published functional merge is 1d66be8028ae706ed8d26748f24eb5f85059172a, main deployment run 39956322917 was SUCCESS. The next documentation-only follow-up cannot be treated as a new functional alpha release.
- F-025 geometric source/window mapping plus independent sampled candidate guards remain numeric; mark inter-batch checks as partial. Do not conflate these with completely verified topological invariance.

## 13. Alpha.35 — адаптивные icon controls и метаданные файла в рабочем поле
- Логическая иконка zoom должна быть единственным визуальным содержимым zoom-кнопки, доступное имя хранить в aria-label. Фиксированная ширина должна включать и иконку, и padding, поэтому не оставлять анонимные +/− text nodes рядом с ней.
- Текст изменения состояния панели обновлять внутри выделенного span label; никогда не заменять textContent родительской кнопки, иначе теряется вложенная SVG use пиктограмма.
- При недостатке ширины вертикально переносить отдельные button elements; иконки держать flex:none, подписи допускать к многострочности, hotkey kbd не накладывать на иконки. Не изменять поставляемые PNG assets.
- Filename overlay — HTML внутри workspace, вне SVG #canvas; используется basename подтверждённого doc, textContent вместо innerHTML. Его состояние следует Undo/Redo/New и не зависит от начатого/ошибочного импорта. Max-width/ellipsis/title не изменяет физические размеры документа.
- После статических тестов обязателен браузерный bbox/layout smoke нескольких ширин в том же Actions workflow. Пользовательская визуальная проверка Firefox Windows — отдельный статус.

## 14. alpha.35 real command budget and EPS snapshot parity
- Distinguish intermediate source optimizer node counts from final geometry after Clipper/refit. Only M/L/C/Q count as editable nodes, not sampled diagnostic polyline points. A mandatory post-Union budget discards a candidate that grows total real nodes; keep optimized pre-Union input and explicitly notify that its Union operation was canceled. If pre-Union stage grows nodes, keep untouched original document. This conservative trade-off can leave overlaps but cannot silently add thousands of nodes.
- EPS export verifies its numeric path token stream (m,L,C,@c) equals freshly serialized frozen AFTER geometry, including all coordinates and exact node count. RGB repainted outputs use same geometry. Untouched original bytes are returned only with intact complete geometry stamp. Do not rerun optimization on Save.

### alpha.35 release evidence
The final post-Union node-count budget, HTML workspace filename and direct EPS command parity gate are published in PR #44. CI #39961633180 covers real browser Worker/WASM and synthetic roundtrip, production deploy #39961788762 success. These checks are not an analytic proof that external ArtCAM/Corel importers use identical point counts. When Boolean Union would increase nodes, it is explicitly rejected rather than silently exported; retaining overlap is a disclosed limitation.

## 15. Восстановление исходной версии alpha.32 (2026-10-23)
- Применять Git-tree reconstruction от подтверждённого релизного merge commit; проверять SHA всех runtime/test/toolchain файлов, а не только номер версии. Не применять force push и не терять поздние методы.
- Исходная контрольная точка `4ad8efd1801be16d4c37472fda4989f9e3afbf06`, исходный Git tree `6cd82072293720fb5810d669de8db9cd8b48b36a`. Before-rollback archive: `archive/alpha35-before-alpha32-rollback-20261023`.
- Современные журналы `docs/history`, `docs/DEVELOPMENT_LOG.md`, `logs/actions.jsonl`, `HANDOFF.md`, `docs/NEXT_CHAT_START.md` сохраняются в откатной ветке; это документация, а не вмешательство в runtime. Восстановленная рабочая сборка должна полностью совпасть с alpha.32.
- Намеренно возвращаем limitations: поздние топологические/экспортные проверки узлов, патчи интерфейса и cache busting из alpha.33–35 не входят. Это честный rollback, не дополнительная оптимизация.
- Две отдельные проверки: original alpha.32 workflow cargo/npm/wasm и GitHub Pages deploy на новом main; старый workflow **не** выполняет современный Playwright smoke. Внешняя проверка user Windows/Firefox необходима отдельно.

## 0.2.0-alpha.36 — alpha.32 continuation, 2026-10-23
Base main 8f9afb8 (user rollback to exact alpha.32). Branch fix/alpha32-verified-pipeline-alpha36. Reviewed and ported F-025 diagnostic provenance, F-027 responsive buttons, F-028 AFTER/export node budget and geometry equality, Corel lowercase curves from archived alpha.35. This is an explicit new release, not a claim that alpha.32 already had those fixes. New: batch-scoped bounds validator computes each contour box once instead of rescanning nodes for every issue. Snapshot local to each job, no stale mutable global cache. Native Rust and fresh WASM must pass CI (Cargo unavailable locally). JS/browser/private EPS checks in progress. No publication or user verification yet. Full cross-batch diagnosis remains partial. Private EPS stays ignored.

### alpha.36 additional observations (2026-10-23)
Recovered actual source/result attachments from latest chats. Actual kalin EPS browser: 3152 source anchors -> 1972 pre-Union; rejected dense Union/refit at 21872 anchors; AFTER has 3 residual issues and explicitly partial coverage, not a false claim of clean geometry. Both EPS save choices passed actual download. Actual 8049569 EPS: 765->688 anchors at .02 mm, 0 AFTER issues, partial coverage. Source-owned 2444-node circle and 1440/1024/820/390 toolbar tests pass in Windows Chromium. 195 JS pass. Private files remain ignored.
New Rust broad phase rejects only point pairs outside tolerance and segment boxes separated beyond overlap tolerance plus parametric endpoint roundoff; original predicates and deterministic output order preserved. Added native boundary/near-parallel/backtrack regressions and independent old/new WASM comparison script. Fresh Rust/WASM validation still pending CI; baseline downloaded published WASM ABI passed, not a newly compiled build. verify-example first tried narrow EPS readers on painted private input and correctly refused; recovered full imported project through actual application Worker, then ran algorithm matrix. Earlier initial 5 JS failures are prerequisites/version/docs/static assertion corrections, final 195/195.

### alpha.36 final native/runtime evidence and selected-scope correction
PR #48: https://github.com/tohaa28/relief-forge/pull/48. First head 1c49eca CI https://github.com/tohaa28/relief-forge/actions/runs/39982180020 SUCCESS: 17 Rust, 195 JS, fresh 95059-byte WASM ABI and actual Chromium Worker smoke. Downloaded exact artifact; old alpha.32/new kernels produced byte-identical diagnostic JSON for 121 synthetic inputs. 2000-node circle, 5 iterations: old 1500 ms/new 37 ms (40.28x); repeated old 1470/new26 (55.85x). These kernel benchmarks do not claim end-to-end speedups.
Recovered actual old kalin_result(1).eps contains 21872 real m/L/C anchors and 541346 bytes, matching rejected Union result exactly. New kalin imported project 3152->1972; independent run diagnostics 145->3, partial; union disabled 4579 ms, enabled with explicit growth rollback 8480 ms, baseline WASM at that point. Both EPS serialization modes and outline reimport node/closed counts passed. 8049569 matrix: .005/.02/.046/.1 mm, Union off/on, real anchors 753/688/650/602 (from765), 0 residual issues, partial; both export modes and reimport passed. New WASM Chromium rechecks both painted8049569 and 53-contour8049569_10_29.10 plus kalin passed.
Additional bug found while testing actual selection: list/filter selection only rendered and left old all-object preview cached. Now selection changes trigger debounce recalculation; stats carry exact scope; Apply and EPS snapshot reject stale scope. Dedicated unit regression and actual eight-case Union/smoothing/selected-object browser matrix cover this. Initial matrix attempted Apply after EPS save, but Save already applies exact snapshot with Undo by established contract; fixed test to assert this contract rather than treating disabled no-longer-needed Apply as failure. Node editor, project save/reopen/Undo and real vector PDF/SVG export included. Firefox package downloaded but launch failed spawn UNKNOWN in this Windows environment; Firefox NOT verified. Follow-up CI/head required before merge.

## 0.2.0-alpha.37 — Union healing and complete zoom icons (2026-10-23)
Base main80089d1745898e1068db44a2a8b58aa5c6c2cd35; branch fix/overlap-healing-zoom-alpha37. Re-read prior Relief Forge chats and F-013/014/015/016/027/028/029. Existing Clipper tool from alpha.27 handles filled compatible objects and compound rings. Actual supplied8048531: source439anchors/43issues; optimized272/16; valid Union+refit396/0 with complete WASM diagnosis. Alpha.36 rejected it solely because396>272 despite396<439. Change the budget to preserve original-document ceiling, allowing necessary intersection cuts while still blocking kalin1972->21872 against3152source. No tolerance/quality/serialization safeguards removed.
Inspected original zoom PNGs: plus crop includes adjacent fragments and truncated plus; minus crop includes a button edge. CSS cannot recover missing pixels. Use complete native SVG plus/minus within the existing controls; preserve original approved raster hashes. Fix selected-only compound normalization to exclude unselected source objects. Re-run all native/JS/WASM/browser/real-file checks before publishing. Private EPS remains ignored.

### alpha.37 actual-file verification before CI
Windows Chromium with actual8048531 EPS PASS: complete diagnosis43->0, real439->396nodes; Union was applied, not silently cancelled. Four-tolerance matrix with Union off/on: .005 guard retained387nodes/16issues (too dense after Union); .02 accepted396/0; .046 accepted312/0; .1 accepted249/0. Union-off at .02 retains272/16. Preserved strict original-node ceiling; did not loosen fit tolerance or bypass safety when tighter settings could not satisfy it.
Independent reference filled silhouette check (Clipper normalization vs refit) retained20outer components/10holes; XOR0.2115301734mm² against perimeter/tolerance budget15.7998427253mm². Pipeline stage timings: repair3ms, smooth/optimize137ms, Union170ms, refit414ms, finalWASM9ms (~0.73s excluding file conversion/network). Both EPS modes exactly compared to AFTER; outline EPS reimport396nodes,0issues, complete coverage and same nested-hole geometry. Saved verified contour EPS locally to outputs, never put private geometry in Git.
Initial independent roundtrip topology assertion incorrectly treated each unpainted wire as a separately filled solid, reporting0holes. EPS outline mode carries geometry without ink; recovery legitimately splits rings into separate objects. Corrected test to classify the aggregate nested wires using even-odd containment; retained complete diagnostic, real-node equality and all10holes assertions. No product export code was changed to hide this test error. Source-owned CI fixture now includes a negative-winding hole.
198JS tests PASS and eight-mode browser matrix PASS. Zoom PNGs were inspected directly and demonstrably contain truncated/adjacent UI pixels. Native full SVG signs tested at1440/1024/820/390, plus/minus clicks alter/restore actual canvas viewBox. Approved PNG files unchanged. All new release versions/cache URLs synchronized. New Rust/WASM CI and publication still pending.

## 0.2.0-alpha.38 — covered retrace repair (2026-10-23)
Base main d0f1518204405fdea3fc4b9d3074e96e6a03a079. Branch fix/covered-segment-retraces-alpha38. Actual supplied min EPS:3146anchors,134sampled issues partial; alpha37 AFTER1970anchors and3overlap issues, whole Union21861rejected. Reproduced a closed M A L B L A Z contour lying entirely on a surviving boundary line inside the same filled compound path. New algorithm verifies exact collinearity and full projected interval coverage by nondegenerate surviving subpaths before removing the duplicate zero-area contour; supports adjacent covering segments and truly collinear Bezier hulls. No sampling or user-tolerance snapping licenses removal. Uncovered/near-parallel/curved/stroked/unsupported/standalone rings preserved. Native coordinates, paint, translations, source and Undo retained. Tests/CI/live publication pending.

### alpha.38 actual-example postcondition evidence
205JS tests PASS. Real min EPS browser import+processing2995ms versus alpha37 baseline3111ms, not an asserted universal performance improvement. BEFORE3146anchors/134sampled issues partial; AFTER1967anchors/0sampled issues partial, one covered retraced contour/three anchors removed. Clipper whole-document attempt still exceeds original-node budget and is rejected; the native exact retrace repair succeeds independently of that attempt. Real affected optimized object has1875sampled points; isolated full WASM check confirms3overlaps->0 with complete coverage. Each individual final object also checks complete/0; cross-object relationships across diagnostic batches remain unverified.
Exact helper-only repair compared through independent winding-aware Clipper XOR:0mm² filled silhouette difference; surviving native commands/controls preserved. Both EPS choices match actual AFTER geometry; outline reimport1967anchors/0issues. Verified contour-only output saved to local outputs/min_result.eps, private geometry never committed. New fixture checks exact three-overlap pattern, conservative non-removal cases and UI Apply/Undo/export. Initial issue inspection used a global contour index as a path-local index; cumulative contour prefix identified the correct local retrace. Do not change mapping merely to hide that distinction. CI/freshWASM/publication pending.

## 2026-10-23 · 0.2.0-alpha.39 — native curve clearance measurement (source + local checks)
- Request: detect separations below a separate configurable threshold, default0.1mm; pink filled circles behind vectors. Base main4557963b514ef46364a47a943026c8fd143ede3c, previous alpha38 Pages39996755362 build/deploy success. Branch feat/curve-clearance-alpha39.
- web/curve-clearance.js reads native M/L/Q/C/Z with world offsets and ordinary polylines, across all objects and compound subpaths. Excludes only directly neighboring segments of the same subpath (including closure seam), not different objects sharing a coordinate. Distances concern centerlines, not stroke thickness. Same-segment self approach is outside this pairwise diagnostic.
- Method: x-sorted control-hull AABB sweep; de Casteljau branch/bound per candidate; lower=max(box separation, closest chord distance minus Bernstein control/chord error bounds); upper=distance between ACTUAL evaluated native curve points at chord-seeded parameters. Never treats a chord point as a native-curve witness. Strict upper<threshold gives a real marker, minimum converges to <=min(1e-5mm,threshold*1e-4) gap; ambiguous near-threshold bound remains explicitly incomplete. Rejected endpoint-only measurement (misses internal minima), fixed coarse flattening (false/omitted near thresholds), reuse of repair tolerance (changes unrelated semantics), synchronous main-thread search (blocks UI).
- Source inspiration/primary algorithm documentation: https://bezier.readthedocs.io/en/2024.6.20/algorithms/geometric-curve-intersection.html (convex-hull boxes + recursive subdivision); adapted to bounded minimum-distance search with actual point witnesses, independent implementation.
- Work capped at2M comparisons/subdivisions per document and3000 pair markers; budget, unsupported commands or unresolved threshold bounds label measurement incomplete. This is independent of the existing Rust diagnostic batching completeness and never weakens export warnings. One closest location per native segment pair; adjacent continuity deliberately ignored. No geometry repair performed.
- Worker isolated search +120ms debounce; exact displayed-document geometric fingerprint prevents stale results across BEFORE/AFTER, Undo, import and threshold changes; superseded Worker terminated. Rendering cached result only, pixel-minimum visible pink disk lives between grid and geometry, pointer-events none. No markup added to model/EPS/SVG/project. Threshold change only rerenders measurement, does not run repair or write history.
- Local12new unit checks PASS (strict threshold, exact line/degenerate/crossing, analytic internal Q/C minima, C/C reversal/translation, compound/offset, adjacent seam vs narrow opposite sides, source immutability, work/marker caps, unsupported commands,10k far segments). Actual Chromium browser-clearance PASS: default0.1, Q-to-line analytic0.05, change0.04->no circles then0.06->circle, DOM layer order/pink/pointer-events, BEFORE/AFTER, actual EPS no markers, no pageerrors.
- Private native documents measured, no geometry committed: min-source3038segments/2914candidate pairs/93459work/2291markers97ms; alpha37 min-optimized1862segments/659pairs/37757work/138markers63ms; prior kalin3044segments/2919pairs/93803work/2300markers75ms. All clearance reports complete within budget. Counts are pair locations, not distinct connected defect regions. Browser import/end-to-end timings remain separate.
- Release manifests/Cargo/cache URLs alpha39 synchronized. CI mandatory browser-clearance added through scripts/check-wasm.mjs alongside all existing Rust/WASM/Union/retrace/eight-mode/node/PDF browser gates. Full npm/CI/publication pending; Cargo unavailable locally. Private EPS untouched. No failed algorithm/test attempt observed so far; one exploratory lookup referenced nonexistent curve-geometry.js and was corrected to actual rich-svg/curve-edit modules.

Alpha39 F-033: adjacency includes exact endpoint-return closures withoutZ. Equality is exact, never user diagnostic/proximity tolerance; adjacent seam exclusion changes only pair enumeration, not commands/model/topology. Nonzero gap still diagnosed; see14new unit regressions.

## 2026-10-23 · 0.2.0-alpha.40 — whole-contour minimum clearance, not nearby nodes (candidate)
- User reports alpha39 narrow-place false positives at neighboring nodes. Base main6470dc00b48ecc7209b47c76c4c2d1ca0e8409ad, previous Pages40001458554 build/deploySUCCESS, branch fix/contour-clearance-minima-alpha40. No private input committed.
- Confirmed F-034: native segment-pair distances were numerically real but their endpoint minima were not minima of the continuous contour. Skipping only immediately neighboring indices missed near continuation two or more short edges away; raw pair output duplicated the same narrow region at every node. New5regressions initially FAIL14/19: dense straight81nodes ->703false marks; ordinary500edge circle ->3000cap; two parallel segmented lines ->152marks instead of1; monotone gap ->7instead of1; smooth real minimum at joined Q node ->2instead of1. Existing14distance tests passed.
- Implemented: clearanceSegments retains previous/next controls and stable IDs/neighbors (exact-return andZ seam retained); zero-length point spans ignored for this distance diagnostic only. isContourMinimum tests a candidate endpoint against ALL incident contour directions. If distance decreases along continuation it cannot be a whole-contour local minimum, so discard. Direction sign uses local/world roundoff slack (128EPS*coordinate scale), not repair or clearance tolerance. Genuine interior native minima and constrained open ends/cusps are retained. lineNearest seeds overlap interior for flat parallel minima, choosing an actual native interior witness; curveDistance exact ties prefer interior parameters.
- Rejected broad fixed node-count exclusion, excluding every same-contour pair, threshold shrink or UI-only hiding: would depend on segmentation or lose actual necks. Geometry remains original native L/Q/C, no source mutation, thresholds unchanged, no automatic repair.
- Cluster accepted minima by connected neighboring native-pair cells, retaining the actual shortest witness per connected narrow zone; equal-distance plateaus choose an actual central witness (not an averaged/off-curve fabricated distance). Initial adjacency-only clustering FAILED added6thregression: two genuine narrow ends separated by wide shared node merged1instead of2. Fix requires a native proof that the shared pair-cell boundary is itself below threshold: actual joint-to-joint distance for diagonal cells, or native curve-to-joint minimum for an edge. Wide intervening boundary keeps zones separate. Final20/20clearance tests PASS (6new), total226full suite pending.
- All pair distance/subdivision and zone boundary/connectivity work shares2Mwork budget,50000raw accepted minima/3000display zone caps; exhaustion/unsupported/ambiguous bounds explicitly incomplete. If grouping exhausts budget returns valid ungrouped witness fallback with incomplete status, never a false full claim. Pair/zone enumeration is independent of existing legacy WASM cross-batch partial status. Same immediate native neighbors and within-one-native-segment self approach remain outside scope; no universal analytic topology certification.
- Private native CPU checks after change: min-source3038segments/2910candidate pairs,2232continuations rejected,55native minima ->18zones,complete106ms; old alpha37 min-optimized1862segments/659pairs,95continuations rejected,43minima ->17zones,complete71ms; prior kalin3044segments/2915pairs,2242continuations rejected,54minima ->19zones,complete90ms. Old alpha39 source2287marks is historical regression baseline, not correct physical neck count. Timings do not include EPS conversion/network/browser.
- Actual Chromium new browser-clearance PASS: original81node BEFORE0marks (verified actual parsed80L segments), actual dense parallel BEFORE1true0.05mm central midpoint, separated narrow ends2marks, plus prior Q0.05/.04/.06 threshold/background/BEFORE-AFTER/real EPS no annotations/no JS errors. First browser structural assertion FAILED because legal SVG compresses repeated L letters; replaced lexical count with svgpath native command parsing, retaining mandatory80segment BEFORE check. No production geometry fault inferred from test representation error.
- web/app.js/index: label now "Узкие места", tooltip shortest distance, hint explains whole-curve minima and neighboring-node exclusion. Default0.1mm/pink-under-vectors/Worker cancellation/cache safety unchanged. All manifests/Cargo/cache URLs synchronized alpha40. FreshRust/WASM/full npm/existing primary+eight-mode/PDF/Union/retrace+new minimum browser checks still pending; not yet published.

## 2026-10-23 · 0.2.0-alpha.41 — PDF layer import only (candidate)
- User supplied private PDF and screenshot showing alpha40 "Некорректный SVG" / last import failed while prior EPS remained on canvas. Explicit constraint: other functioning features must not change. Base mainc06dda6d3827c0e0d4f2a17586196379fe21c53e, last alpha40 Pages40004978211 successful, branch fix/pdf-import-alpha41.
- Exact input11604bytes, SHA256 d210e4cb7bc1a327cf2eaf7f274d81656baec1443a7ddb4f8659c175e785017c. Private document and rendered/raw SVG/PNG evidence remain ignored, no geometry copied to public fixtures. Read-only PDF inspection used bundled MuPDF and original4x PNG; user source unmodified. No PDF authoring deliverable created.
- Confirmed F-035: MuPDF preserves PDF optional-content layer as <g inkscape:groupmode/label>; namespace only declared on rootSVG. rich-svg splits each drawing object into standalone artwork fragments, dropping root namespace declaration. Browser strict parser then rejects unbound layer prefix in safeFragment/openValue; paint read is unsupported too. Existing simple single-page CI fixture had no named layer. Direct real-browser import/safeFragment on old raw SVG reproduces EXACT "Некорректный SVG"; xmldom printed fatal namespace error but permissively retained DOM, proving browser gate essential.
- Narrow fix web/pdf-pipeline.js selfContainedPdfLayers before returning selected-page SVG: copy producer root xmlns:inkscape declaration onto every containing g that uses this prefix, unless locally declared already. Quoted-tag matching includes attribute > or quotes encoded as XML entities; preserve namespace URI and layer labels (Unicode/quotes/&/< >), all grouping, transforms, paths/controls/fill/rules/defs/text outlines/images. No removal of layers/metadata, no rasterizing page, no weakening of parser/security. Shared SVG/EPS reader, EPS conversion, repair, Union, curve distance, node editor, layout/buttons and exporters remain unchanged. Primary MuPDF writer options consulted: https://mupdf.readthedocs.io/en/1.27.2/reference/common/document-writer-options.html ; text=path/no-reuse-images retained.
- Rejected: disable safeFragment/parsererror checks (unsafe invalid saved projects), flatten page to bitmap (loses editable curves), strip layer names (unnecessary information loss), global rich-svg namespace refactor (outside user-authorized scope), changing EPS pipeline/MuPDF version (not root cause). Initial exploratory filename lookups pdf-import.js/pdf-pipeline.test.mjs did not exist; corrected to actual modules, no change based on guesses.
- Source-owned tests/fixtures/pdf/layered-fixture.mjs builds genuine optional-content PDF with Unicode/special layer name, Bézier path, actual font text, optional embedded2x2raster and multipage tree.3new real-MuPDF unit tests PASS: strict independent-fragment XML/paint/curves/mm scale, exact raw SVG bytes after removing ONLY added local namespace declarations, multipage/image metadata preserved. Existing simpler PDF unit fixtures retained.
- New mandatory scripts/browser-pdf-import.mjs PASS real Worker browser: reproduces prior error with raw inherited namespace, successful layeredPDF import, text outlines/nativeC/paint/scale, raw-pageSVG versus original exported editable SVG raster silhouette, both actual EPS choices, exact full paths Undo/Redo, saved project reopening, multipage choose2/cancelpreservespriorgeometry, embedded image, actual rejected invalid header preserves previous document. Added to existing scripts/check-wasm.mjs CI gate; no checks removed.
- Actual private PDF Windows Chromium PASS: one compound path/396source anchors, width49.7898561111111mm height26.658569999999997mm (exact page-bounds conversion). Native solid #231f20/evenodd paint valid. Existing UNCHANGED optimization default produces245anchors; actual full-path Undo restores original396 and Redo restores applied245. Both EPS save successfully; project save/reopen retains PDF metadata. Visual raw-pageSVG versus source editableSVG difference20alpha pixels/342400 (<.006%),56922ink; synthetic0mismatch/320000. Original4x MuPDF PNG and actual workspace BEFORE screenshot inspected; logo/text layout preserved as editable outlines. First synthetic browser test PASS; before private test corrected raster comparison to use actual page ratio rather than integer-rounded SVG natural dimensions (avoids comparing different canvas heights). No product change from this test setup correction.
- Scope guard observed: git-show baseline vs every changed existing web file outside pdf-pipeline, after normalizing alpha41->alpha40 cache/version strings, EXACT identical. No other feature logic changed; synchronized Cargo/package/UI/cache version41 is necessary publication plumbing. Local private full multi-operation browser3701ms, earlier import/conversion + operations2605ms; not a universal startup guarantee. Full229JS/17Rust/freshWASM/all old regression modes/publication still pending. Last published alpha40 until main build+deploy.

## 2026-10-26 · alpha.41 gerb.eps investigation — runtime unchanged
User asks to test inaccurate problem locations/incomplete healing and identify causes. Baseline main8fdd9c3bc76528c54c644f7f12176273ded1cf2c, runtime6a0557f, original604571bytes/SHA256312500844119a99a08e181236c2472f9a023dd1fb65af51bfcbf1c9466e58ff4. Earlier checkout/cwd missing; restored exact repository/dependencies/approved icon archive (local generated icons excluded fromGit), no other repo modified. No new release/version/UI/geometry algorithm changes. Full evidence: docs/history/GERB_DIAGNOSTIC_INVESTIGATION_20261026.md.
Actual Chromium/GS/MuPDF/publishedWASM:93objects/1242closedparts;11493->11170anchors,323removed,105terminal snaps (not105original open contours);3284->2642messages,14jobs/25795->25469sample points,partial. Source35exact opaque same-command/offset/paint copies/602nodes,28duplicate-subcontour messages cover19objectpairs;16exactpairs outsidecheckedjobs. At.005mm18jobs give0duplicate messages despite same35nativecopies. Experimental keep-later exact dedup93->58/10891anchors, winding-aware silhouetteXOR0mm2 at.005sample/.00001grid,1094samplemessages stillpartial; not a fully repaired deliverable.
F-037: independently reconstructed EXACT subdivision provenance for all1242before/afterparts, assertions coordinate<1e-10mm. All5AFTER self-intersection messages on3parts have positive native-interval gaps .0011805588.. .0027043173mm (boundswidth<1e-8), hence chord crossings not true native crossings. Of1096inter-object messages allhave actual near-zero witnesses<1e-8 (mostly duplicate contacts); DO NOT dismiss all as proxy artifacts.297/760AFTERcoincident pairs include samples rather than2nativeanchors.164realnative short spans+2degenerate closing edges remain in57whollytiny protected parts (0subdivision-short artifacts here). Pinkdistancefeature independently517->502zones complete at.1mm/CPU2393->2167ms, displayonly not auto-separation and separate from2642kernelmessages.
F-038: Union removedExact35 then candidate23225nodes exceeds original11493; correct node guard reverts whole candidate incl safe dedup. F-039: independent combined-document quality hits20000sample-pointcap at.0025mm; acceptedfalse reason 'Кривая слишком сложна', beforeSegments9928/after9006, so smoothing/optimization rolledback; no actual geometry failure established by budget. Protectalltiny parts intentionally avoids deleting artwork.
Actual savedEPS passes matching-after11170; independent export/reimport EXACT same per-kind2642counts/partial. No serialization corruption found. Originalinputunchanged. Local229/229JS PASS; publishedWASM audit not fresh localCargo (unavailable); new PRCI separate. scripts/reproduce-alpha41-diagnostic-limits.mjs contains5source-owned experiments, prints limitations without requiring bugs remain in future releases. Real baseline browser transport/Apply/export/Undo passed but remaining geometry issues NOT declared fixed. Private audit harness initial relative import and omission of zero spans/two-point closure were caught by strict assertions, corrected before conclusions; all failed harness attempts recorded here. No runtime patch or alpha42, no private EPS/vector/logo/screenshot uploaded. Local HTML/Markdown user reports with private curve excerpts visually reviewed; not committed.
Next requested correction priorities: native provenance/refinement before marker classification, independent global paint/order-safe exact dedup, spatial cross-job relationships, scalable independent quality + per-group rollback, explicit microcomponent policy. Preserve original node/paint/hole/Undo/AFTER=EPS/partial guards; never disable safeguards merely to clear counters. Current investigation complete; no claim of full repair.
