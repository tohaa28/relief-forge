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
