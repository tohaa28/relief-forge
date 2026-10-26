# 0.2.0-alpha.42 CANDIDATE — PR #62 (not published)
- Union before smoothing/optimization, both fast and large preview: implemented.
- Exact native opaque duplicate removal independent from optional Clipper Union rollback: implemented.
- Contained filled objects retain dominant source Bézier handles via silhouette equality check: implemented.
- Large-document postquality fallback per-object + proximity pairs: implemented, budget failure remains rejected.
- UI AFTER and EPS share cache: existing invariant unchanged (browser tests pending).
- Exact native intersections F-037: NOT implemented. GPU computing: NOT implemented (analysis only). Full real-gerb validation still pending.
- No claims of finished native-only Boolean on arbitrary Béziers.

# Матрица Vector Doctor и лечения

«Написано» означает код текущего alpha, а не проверенную совместимость с ArtCAM. Последний подтверждённый PR #17 для alpha.14: 15 нативных Rust-тестов, 63 JS-теста и проверка собранного WASM ABI успешны. Это CI PR, не доказательство текущего live Pages. Основной браузерный сценарий проверен; совместимость с ArtCAM ещё не подтверждена.

| Возможность | Текущий alpha | Следующий критерий готовности |
|---|---|---|
| Отбор: открытые/замкнутые | UI | Группы, слои, эталон ArtCAM |
| Отбор: дубликаты | Одинаковая сегментация, любой старт и направление | Геометрически совпадающие кривые с разными узлами |
| Направление обхода | UI, полилинии | Ориентация осей документирована, составные контуры |
| Отбор по площади и длине | UI, полилинии | Точные интегралы кривых и поведенческие эталоны |
| Область: выделенные/все | UI | Видимость слоёв и группировка |
| Совпадающие узлы | Rust | Разделить геометрический и топологический допуски |
| Самопересечения | Линейные сегменты | Безье, касания, совпадающие интервалы |
| Пересечения разных объектов | Линейные сегменты | Кривые и устойчивая классификация |
| Цвет маркеров внутри/между объектами | Красный/зелёный; клик по замечанию или маркеру центрирует место дефекта (код + JS-тесты) | Визуальная проверка на реальном браузере |
| Убрать маркеры | Отдельная команда «Скрыть/показать»; при новом анализе снова видны | Проверка в живом браузере |
| Соединение совпадающих концов | Однозначные пары | Проверка эталонов, ручной выбор ветви |
| Удаление петель | Внутренние пересечения отрезков | Планарный граф, касания и все конфигурации |
| Порог сохранения петель | Явно определённая alpha-формула | Формула ArtCAM подтверждена REA и кейсами |
| Сохранение исходников | Undo + история в JSON | Отдельный слой исходников |
| Результат на заданном слое | Нет | Слои, активный слой, имя результата |
| Допуск кривых | alpha.14: независимые численные допуски сглаживания ручек C-кривых и сокращения сегментов, Apply/Undo | Формальная оценка отклонения, топологическая безопасность, сравнение с ArtCAM |
| Разгруппировка при отборе | Нет | Модель групп и сохранение принадлежности |
| Частичные наложения | Диагностика | Разбиение и ручное/правиловое удаление |
| Нулевые и короткие сегменты | Короткие диагностируются; соседние узлы очищаются | Явная топология вырожденных контуров |
| Упрощение | Rust: открытые полилинии; JS: аппроксимация и сокращение сегментов кривых Безье и замкнутых контуров (с численным допуском) | Не менять топологию, тесты касаний и петель, строгий контроль формы |
| Булевы операции | Нет | Объединение, вычитание, пересечение, XOR |
| Смещение/эквидистанта | Нет | Готовая Rust-библиотека + тесты углов/самопересечений |

**EPS без заливок / толщин:** в 0.2.0-alpha.3 добавлено восстановление видимых контуров у ограниченного класса пустых CorelDRAW EPS; исходная геометрия Безье сохранена, толщина обводки исключительно экранная. Для восстановленных объектов предусмотрена автоматическая диагностика. Проверить после публикации в браузере на исходном файле.

**0.2.0-alpha.7:** Информационная панель и создание документа скрыты при запуске, доступны без потери функций по кнопкам. EPSF-3.0 экспорт бесцветных незалитых линий (`m/L/C/@c/N`), без печатной обводки даже при цветном импорте. Обратный импорт Relief Forge: CorelDRAW и собственный paintless EPS. Действительный импорт в старый ArtCAM остаётся внешним контрольным тестом.
Далее: редактор Безье, привязки, точные трансформации, DXF/SVG без потери кривых; затем базовые 2D-траектории. Рельефы и 3D не входят в первый векторный этап.


## Текущая контрольная точка: 0.2.0-alpha.14 (22.10.2026)

Единый автоматический раздел: найденные замечания, допуск диагностики, сглаживание касательных C-кривых, оптимизация сегментов и одна подтверждающая кнопка «Применить изменения». Центральный ДО/ПОСЛЕ отображает **реальные** команды геометрии, сравнение не изменяет исходник. Экспорт EPS с исходным именем и `_result` сохраняет только подтверждённые бесцветные пути даже при открытом предпросмотре. История файлов — localStorage браузера. См. актуальный `HANDOFF.md`; первоначальные строки матрицы не подтверждают идентичности ArtCAM.

### alpha.15
Сохранены здоровые точки, компактная легенда, история и единый Apply. Добавлена защита острых стыков при оптимизации, сглаживание явного замкнутого C-стыка, Undo/Redo при активном автоматическом предпросмотре. Численная оценка ошибки не гарантирует сохранения топологии. 68 JS и 15 native Rust тестов, WASM ABI проверены локально; cargo test через CI учитывается отдельно.

### alpha.16
Нативная очистка точек C/Q/L и замыкание близких концов включены до сглаживания в общий кандидат Apply. Дубликат точного конечного M в диагностической копии закрытой C-кривой исключён; реальные внутренние повторы и близкие концы не скрываются. На приватном EPS 17 контуров: прежние 51 замечание были ложными, корректно 0. Собственная повреждённая фигура: 4→0 замечаний после 1 очистки и 1 замыкания, C сохранены. Топологические пересечения и неоднозначные соединения требуют отдельного решения. 75 JS, 15 native Rust и расширенная WASM-проверка локально PASS.

### alpha.17
Проблемные места — цветные кольца фиксированного экранного размера с белым фоном и номерами, соответствующими списку. Масштаб учитывает высокие и широкие листы; клик/клавиатура центрируют место. Явная индикация скрытых маркеров. На приватном 1.eps: 3 отметки ДО/ПОСЛЕ, 14px при Fit/zoom, геометрия совпадает с alpha.16. 79 JS и WASM ABI PASS локально.

### alpha.18
Ручные узлы M/L/C/Q/Z: drag, точное добавление de Casteljau, удаление/соединение соседних сегментов; минимум 2 узла, составные/замкнутые контуры, offset. Сохранение SVG оформления через обратную матрицу, Undo/Redo и JSON history. 88 JS + WASM локально PASS; браузер на 1.eps: 384 редактируемых узла, drag и точный Undo. Редактирование сохранённой геометрии; авто-предпросмотр возвращается после Готово. Прямая независимая правка ручек не включена в этот выпуск.

### alpha.19 — ручное управление узлами CorelDRAW

Введены видимые управляющие ручки Безье и отдельный режим их перетаскивания; типы узлов Перегиб, Сглаженное, Симметрическая (квадрат/круг/ромб); UI-курсоры плюс/минус, контекстное меню. Также реализованы преобразование выбранного сегмента в линию/кубику, изменение направления, размыкание и замыкание контуров. Точные L/Q→C преобразования, Undo и EPS проверены модульно. Join/Extract/Elastic и мультивыделение узлов пока отсутствуют. CI PR #24: 15 Rust, 94 JS, WASM ABI PASS; live Chromium нужно проверить после публикации.

### alpha.20 — бренд и скорость

Официальное имя в интерфейсе «Доктор Узелков». SVG персонаж и уникальные пиктограммы со встроенными keycaps для операций; детерминированная клавиатурная маршрутизация. Для сложных EPS интерпретаторы кешируются в Worker на повторные загрузки, GS filesystem не разделяется между макетами; старый быстрый импорт Corel по-прежнему обходится без тяжёлых модулей. Диагностика и геометрия не заменены. При перетаскивании узлов новая функция возвращает типы в одном проходе, SVG DOM кешируется ограниченно, рендер выполняется через requestAnimationFrame. Фактический коэффициент ускорения требует замеров на однотипных EPS.

### alpha.21 — professional UI layout (визуальный слой)

Маскот отсутствует в шапке, центрирован в empty-state рабочего поля и скрывается после открытия файла. Кнопки и SVG-ссылки имеют единый размер, порядок значок — действие — hotkey, общие отступы, адаптивную вёрстку. Алгоритмы расчёта, импорт EPS, экспорт, форматы проекта и история не менялись. Утверждённые PNG не помещены в репозиторий из-за отсутствия бинарной записи через коннектор, подмена/упрощённая перерисовка не производилась.

### alpha.22 — точная утверждённая растровая графика
Весь набор из 33 PNG защищён SHA-256 манифестом, исходные три PNG побайтово идентичны утверждённым изображениям. Маскот и пиктограммы подключены к действующему UI, без изменений EPS/геометрии/Undo. Автоматическая проверка и распаковка перед GitHub Pages.

### alpha.23 — проверка перед Save EPS

Сохранение EPS имеет обязательный preflight всех векторных контуров на геометрии потенциального выхода. Auto-apply допускается только при полном безошибочном ответе Rust и совпадении сохранённой версии кандидата/параметров; история Undo сохраняется. Иначе модальное предупреждение: сохранить текущую подтверждённую геометрию с известными или неизвестными ошибками только по выбору пользователя либо вернуться без сохранения. Проверка больше 2000 точек предупреждает и не инициирует автоматическую коррекцию.

### alpha.24 — контроль больших EPS и Drag & Drop
Потоковое чтение EPS/PS/SVG/JSON после перетаскивания (один файл); статус чтения и анализа с процентом. Пакетная WASM диагностика по <=2000 точек и прогресс, с явным *частичным* статусом при нескольких блоках, разбиении одного пути или недоступных точках. Отдельное пакетное сглаживание/оптимизация с чистым PREVIEW и ручным Apply; отмена без мутаций. Save EPS больших файлов также показывает процент пакетной проверки, но не выдаёт недоказанное «ошибок нет» — предлагает сохранить только подтверждённые кривые по выбору пользователя. Маркеры здоровых узлов снижаются на больших документах, дефектные сохраняются.
### alpha.25 — цветной EPS и обзор точек
При Ctrl+S пользователь выбирает (1) бесцветный EPS из подтверждённых кривых, (2) исходную окраску. Если EPS не менялся, возвращается исходный PostScript byte-for-byte (включая CMYK); после правок экспортер использует доступные сплошные RGB-цвета заливки и обводки, не обещает восстановления CMYK или сложных эффектов. Нельзя применять неподтверждённые геометрические изменения для неэкспортируемого цветного рисунка. Отображение 1000 дефектов распределяется по сетке всего изделия с сохранением привязки к индексам, без тысяч надписей. Ошибочные координаты вне просчитанных контуров не визуализируются и делают пакетный результат неполным.

### alpha.26 — residual AFTER / cached export / shape overlap
Diagnostic report and interactive colored markers are tied to every AFTER vector path, regardless of >2000 sampling split; certification remains incomplete across independent batches. Save EPS reuses the result without rerunning repair/diagnostics. Saving with warnings exports the treated result, never the unoptimized original. Auto merge of equal-style real overlaps: rectangle-fill Boolean union, exact duplicate deduplication, compound Bézier ownership preservation for other curves (NOT a boolean silhouette union), explicit opt-out. Unsupported paint and complicated geometry are left unchanged.

### alpha.27 — true Boolean union (Clipper)
Для совместимых закрытых заливок одного цвета настоящая операция union удаляет внутренние пересекающиеся сегменты; внешний силуэт, отверстия, evenodd сохраняются в ПОСЛЕ и EPS. Работает и при множестве под-путей одного исходного объекта. При обработке заполненных C/Q вывод — контуры L после адаптивной аппроксимации (точность 0.0002–0.005 мм). Различные краски, stroke-only, маски, растр не сливаются. Режим ПОСЛЕ показывает результат и остаточные проблемы; Save EPS повторную обработку не запускает.

### alpha.28 — защита формы при уборке коротких звеньев после Union
Новый модуль union-node-cleanup удаляет только локально невлияющие узлы/очень короткие сегменты по допуску оптимизации и автоматически контролирует каждую операцию общей топологией (внешние компоненты, отверстия, площадь симметрической разности). При нарушении возвращается неизменный Union. Цифры очистки видны на ПОСЛЕ, остаточные проблемы диагностируются на очищенной геометрии, EPS экспортирует готовый снимок. Законные острые мелкие элементы намеренно сохраняются.

### alpha.29 — финальная оптимизация кривых после Union
После всех Boolean/cleanup результат L-полигонов оптимизируется многопроходно в реальные M/L/C/Q-узлы с пользовательским допуском; количество опорных узлов ПОСЛЕ отражает именно эту геометрию, а не предварительный отчёт. Редактор точек, открытый из ПОСЛЕ, принимает оптимизированную геометрию с Undo и показывает фактические command endpoints. Непересекающиеся оригинальные C не заменяются новыми выборками; неизменённый уже оптимизированный результат не flatten-ится повторно. Save EPS не делает повторных расчётов.

### alpha.30 — PDF vector import and mascot reliability
Direct PDF (single/multi-page page picker) vector import through bundled MuPDF with text outlines and retained embedded bitmap objects. Multi-page imports selected page only. File-open and drag/drop accept PDF. Mascot uses cross-browser state synchronization and hides during and after any successful file load, unhide only for empty document on failure/cancel. PDF export NOT added; Save EPS unchanged.

### alpha.31 — Workspace Health
Automatic post-import check and recovery for SVG layout size, CSS visibility, mascot/drop overlays and artwork outside viewBox, independent backup wireframe rendering, one-click JSON diagnostics and plain script startup watchdog when the main module itself fails. No document mutation, no auto-zoom on ordinary manual navigation. Intended for browser-/machine-dependent blank workspaces.

### alpha.32 — Import-integrity EPS zero-object guard
EPS import is only committed if importRichSvg generated >=1 editable object; blank Ghostscript/MuPDF SVG triggers an error (and falls back only to proven Corel safe outline extraction). Historical EPS with zero paths is now health=warning empty-import. Failed imports are reflected in downloadable workspace diagnostics with code and filename; previous document/Undo remains unchanged. Empty PDF page is allowed by design. Root cause of specific source EPS requires file evidence.

### alpha.33 — CorelDRAW EPS c/C unpainted curves
Fallback importer now recognizes both equivalent PostScript curveto aliases C and c with exact cubic control points and no synthetic vertices. Direct path reader recovers actual uploaded file containing 53 closed outlines; CSS and Ghostscript are not involved. Existing import-integrity rejection remains for true empty/unsupported EPS; vendor/cache URLs updated. The actual user file is not committed.

### История и восстановление контекста (documentation checkpoint, 2026-10-23)
Обязательные release chronology, failure register F-001–F-022, архитектурные решения, NEXT_CHAT_START и WORKLOG_PROTOCOL созданы в \`docs/history/\` и \`docs/NEXT_CHAT_START.md\`; \`AGENTS.md\` требует их обновления при каждой следующей итерации. \`tests/history-integrity.test.mjs\` проверяет соответствие актуальной версии, отсутствие дыр в нумерации ошибок и parseable action journal. Документация не доказывает runtime behavior; реальные CI/Pages и user smoke остаются отдельными статусами.

## alpha.34 quality control
- Source-aware split diagnostics, exact geometric closure: implemented; real private EPS/WASM checked, zero false opens.
- Independent candidate rejection on new sampled intersections/short real segments/topology changes: implemented and regression tested, numeric limits apply.
- Actual command reduction: private EPS 712→597; unchanged source/Apply/Undo retained. Browser smoke gates CI. Publication pending.

alpha.34 observed verification: 184 JS PASS, local Chromium/private EPS 0 false open issues, export/reimport 53 rings/597 segments preserved. New native/WASM CI and publication blocked pending explicit push authorization.

### alpha.34 — publication verified on GitHub Pages (2026-10-23)
- Implemented/tested: split provenance prevents false open contours; independent geometric optimization safety guard, real command reduction; in PR #42.
- Native: 15/15 Rust PASS. Browser-independent tests: 184/184 JS PASS. New WASM ABI PASS. Real Chromium Worker/WASM smoke PASS including import, BEFORE/AFTER, Apply, EPS download and Undo (PR workflow 39956129539).
- Deployed: PR #42 merged 1d66be8028ae706ed8d26748f24eb5f85059172a; main workflow 39956322917 build+deploy SUCCESS.
- User Windows smoke not yet confirmed; private EPS and unresolved inter-batch/certification limitations remain. No claim of mathematically exhaustive correctness.

### 0.2.0-alpha.35 — responsive UI and filename (source-written, CI pending)
- Icons: 42px icon-only zoom buttons, preserved info-toggle SVG, wrapping right-panel controls; regression tests + multi-viewport real Chromium check added.
- Filename: workspace overlay bound to successfully committed document; original basename, tooltip for long names; Undo/Redo and New synchronize without exporting filename into vector.
- Scope: CSS/HTML/UI only; Rust/WASM, curve quality, privacy/color and EPS export invariants retained. Publication NOT yet verified in this checkpoint.

### alpha.35 node inflation block (implemented, not yet published)
- Guard real editable nodes after Union; rollback optional Boolean result if it increases node count, explicit status. EPS output numerical commands checked against cached AFTER before download. Source user EPS not presently uploaded; real-specific import/export roundtrip verification remains outstanding.

### 2026-10-23 alpha.35 observed release states
- icon layout and committed filename: implemented + JS/browser tested + GitHub Pages published; Windows Firefox user acceptance pending.
- EPS AFTER node-count growth protection and serialized command equality: implemented + synthetic EPS roundtrip JS/browser tested + published. Customer-specific EPS/result bytes unavailable in this session; user-verified resolution not claimed.
- Tests: 193/193 JS; 15/15 Rust; compiled WASM ABI; Chromium actual Worker/WASM; PR CI #39961633180; production build/deploy #39961788762 SUCCESS; functional merge aba78e90be219aae93769fc84f9e78d6022a95c2.

### Rollback 2026-10-23 — alpha.32 exact source and deliberate limitations
- Source: source-of-truth original merge PR #38 `4ad8efd1801be16d4c37472fda4989f9e3afbf06`. SHA files under `web/`, `src/`, `tests/`, tools, manifests and workflow checked identical to old tree. No hybrid algorithm.
- History: alpha.35 pre-rollback `bb56f9b11976fd75199b3b16f0f377be3df5bc18` archived as `archive/alpha35-before-alpha32-rollback-20261023`; latest docs retained append-only.
- Alpha.33–35 features and protections, including F-025 and F-028 mitigations and filename badge, are NOT present. Old known issues may return. Source restored; PR CI, main build/deploy and independent Windows browser smoke are separate gates.

### Alpha.32 rollback verification completed (2026-10-23)
- Selected release now **0.2.0-alpha.32** (not alpha.35), byte-identical executable repo source and assets to merge PR #38.
- PR #46 build SUCCESS: 167 JS PASS, 15 Rust PASS, WASM ABI PASS. Main Pages `39964842575` build SUCCESS/deploy SUCCESS, URL https://tohaa28.github.io/relief-forge/.
- All post-alpha.32 feature fixes removed from deployed code by user-requested rollback; archive branch points to complete pre-rollback alpha.35. No user-device testing claim.

## 0.2.0-alpha.36 — alpha.32 continuation, 2026-10-23
Base main 8f9afb8 (user rollback to exact alpha.32). Branch fix/alpha32-verified-pipeline-alpha36. Reviewed and ported F-025 diagnostic provenance, F-027 responsive buttons, F-028 AFTER/export node budget and geometry equality, Corel lowercase curves from archived alpha.35. This is an explicit new release, not a claim that alpha.32 already had those fixes. New: batch-scoped bounds validator computes each contour box once instead of rescanning nodes for every issue. Snapshot local to each job, no stale mutable global cache. Native Rust and fresh WASM must pass CI (Cargo unavailable locally). JS/browser/private EPS checks in progress. No publication or user verification yet. Full cross-batch diagnosis remains partial. Private EPS stays ignored.

### alpha.36 final native/runtime evidence and selected-scope correction
PR #48: https://github.com/tohaa28/relief-forge/pull/48. First head 1c49eca CI https://github.com/tohaa28/relief-forge/actions/runs/39982180020 SUCCESS: 17 Rust, 195 JS, fresh 95059-byte WASM ABI and actual Chromium Worker smoke. Downloaded exact artifact; old alpha.32/new kernels produced byte-identical diagnostic JSON for 121 synthetic inputs. 2000-node circle, 5 iterations: old 1500 ms/new 37 ms (40.28x); repeated old 1470/new26 (55.85x). These kernel benchmarks do not claim end-to-end speedups.
Recovered actual old kalin_result(1).eps contains 21872 real m/L/C anchors and 541346 bytes, matching rejected Union result exactly. New kalin imported project 3152->1972; independent run diagnostics 145->3, partial; union disabled 4579 ms, enabled with explicit growth rollback 8480 ms, baseline WASM at that point. Both EPS serialization modes and outline reimport node/closed counts passed. 8049569 matrix: .005/.02/.046/.1 mm, Union off/on, real anchors 753/688/650/602 (from765), 0 residual issues, partial; both export modes and reimport passed. New WASM Chromium rechecks both painted8049569 and 53-contour8049569_10_29.10 plus kalin passed.
Additional bug found while testing actual selection: list/filter selection only rendered and left old all-object preview cached. Now selection changes trigger debounce recalculation; stats carry exact scope; Apply and EPS snapshot reject stale scope. Dedicated unit regression and actual eight-case Union/smoothing/selected-object browser matrix cover this. Initial matrix attempted Apply after EPS save, but Save already applies exact snapshot with Undo by established contract; fixed test to assert this contract rather than treating disabled no-longer-needed Apply as failure. Node editor, project save/reopen/Undo and real vector PDF/SVG export included. Firefox package downloaded but launch failed spawn UNKNOWN in this Windows environment; Firefox NOT verified. Follow-up CI/head required before merge.

## 0.2.0-alpha.36 — publication and live-site verification SUCCESS (2026-10-23)
- Functional PR48 https://github.com/tohaa28/relief-forge/pull/48 merged d3e9230e931a20629933cdd007ed4842be0ae6a8. Initial main39983346199 FAILED the mode-matrix project-save race and did NOT deploy. This remains historical, not reclassified as success.
- Follow-up PR49 https://github.com/tohaa28/relief-forge/pull/49 merged 005866ff9bb503a9ab42e0719d2991d5c3479f43. Final PR CI https://github.com/tohaa28/relief-forge/actions/runs/39983892161 SUCCESS; earlier superseded fbf0df3 CI39983756498 CANCELLED (not passed).
- Main production https://github.com/tohaa28/relief-forge/actions/runs/39984099761 SUCCESS: build and deploy. Site https://tohaa28.github.io/relief-forge/ is alpha.36. Fresh Rust17/17, JS196/196, WASM ABI and actual primary+8-mode Chromium browser gates PASS.
- Independent Windows Chromium LIVE site test after deploy: private kalin original3152 -> AFTER1972 anchors; both downloaded outline and original-color EPS parsed directly and each contained exactly1972 m/L/C anchors; project also1972 commands, Undo history retained, no pageerror. This resolves the observed old-result21872 growth on that input. Other private EPS checks and four-tolerance/Union matrix recorded above. Private binary/screenshot evidence remains local ignored; never commit original geometry.
- Native kernel old/new JSON identical121cases; measured2000-node ring1500->37ms (~40x), repeated1470->26ms (~56x), NOT an end-to-end app speed guarantee. Bounds computed once per batch instead of per marker.
- Confirmed fixes: false opens from split windows; lowercase Corel curves; independent optimization safety; post-Union node growth guard; exact serialized AFTER; preserved/wrapped button icons; source filename; actual selected-object scope invalidation; stale import settings debounce cancelled. Save EPS preserves established exact-snapshot commit+Undo contract.
- Limits: private kalin AFTER retains3diagnostic issues and partial cross-batch coverage, explicitly warned; no mathematical certification of arbitrary curves. Native/kernel/source-owned/browser coverage documented, not a claim of all possible files. Firefox failed to launch locally (spawn UNKNOWN) and is NOT user-verified. ArtCAM/Corel external-app importer not newly verified.
- Next independent improvement: inspect3remaining kalin issues against real curve semantics; extend complete cross-batch relationships with performance measurements. Keep current safe partial-coverage warning until full coverage is actually established.

## 0.2.0-alpha.37 — Union healing and complete zoom icons (2026-10-23)
Base main80089d1745898e1068db44a2a8b58aa5c6c2cd35; branch fix/overlap-healing-zoom-alpha37. Re-read prior Relief Forge chats and F-013/014/015/016/027/028/029. Existing Clipper tool from alpha.27 handles filled compatible objects and compound rings. Actual supplied8048531: source439anchors/43issues; optimized272/16; valid Union+refit396/0 with complete WASM diagnosis. Alpha.36 rejected it solely because396>272 despite396<439. Change the budget to preserve original-document ceiling, allowing necessary intersection cuts while still blocking kalin1972->21872 against3152source. No tolerance/quality/serialization safeguards removed.
Inspected original zoom PNGs: plus crop includes adjacent fragments and truncated plus; minus crop includes a button edge. CSS cannot recover missing pixels. Use complete native SVG plus/minus within the existing controls; preserve original approved raster hashes. Fix selected-only compound normalization to exclude unselected source objects. Re-run all native/JS/WASM/browser/real-file checks before publishing. Private EPS remains ignored.

### alpha.37 actual-file verification before CI
Windows Chromium with actual8048531 EPS PASS: complete diagnosis43->0, real439->396nodes; Union was applied, not silently cancelled. Four-tolerance matrix with Union off/on: .005 guard retained387nodes/16issues (too dense after Union); .02 accepted396/0; .046 accepted312/0; .1 accepted249/0. Union-off at .02 retains272/16. Preserved strict original-node ceiling; did not loosen fit tolerance or bypass safety when tighter settings could not satisfy it.
Independent reference filled silhouette check (Clipper normalization vs refit) retained20outer components/10holes; XOR0.2115301734mm² against perimeter/tolerance budget15.7998427253mm². Pipeline stage timings: repair3ms, smooth/optimize137ms, Union170ms, refit414ms, finalWASM9ms (~0.73s excluding file conversion/network). Both EPS modes exactly compared to AFTER; outline EPS reimport396nodes,0issues, complete coverage and same nested-hole geometry. Saved verified contour EPS locally to outputs, never put private geometry in Git.
Initial independent roundtrip topology assertion incorrectly treated each unpainted wire as a separately filled solid, reporting0holes. EPS outline mode carries geometry without ink; recovery legitimately splits rings into separate objects. Corrected test to classify the aggregate nested wires using even-odd containment; retained complete diagnostic, real-node equality and all10holes assertions. No product export code was changed to hide this test error. Source-owned CI fixture now includes a negative-winding hole.
198JS tests PASS and eight-mode browser matrix PASS. Zoom PNGs were inspected directly and demonstrably contain truncated/adjacent UI pixels. Native full SVG signs tested at1440/1024/820/390, plus/minus clicks alter/restore actual canvas viewBox. Approved PNG files unchanged. All new release versions/cache URLs synchronized. New Rust/WASM CI and publication still pending.

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

## 0.2.0-alpha.38 — covered retrace repair (2026-10-23)
Base main d0f1518204405fdea3fc4b9d3074e96e6a03a079. Branch fix/covered-segment-retraces-alpha38. Actual supplied min EPS:3146anchors,134sampled issues partial; alpha37 AFTER1970anchors and3overlap issues, whole Union21861rejected. Reproduced a closed M A L B L A Z contour lying entirely on a surviving boundary line inside the same filled compound path. New algorithm verifies exact collinearity and full projected interval coverage by nondegenerate surviving subpaths before removing the duplicate zero-area contour; supports adjacent covering segments and truly collinear Bezier hulls. No sampling or user-tolerance snapping licenses removal. Uncovered/near-parallel/curved/stroked/unsupported/standalone rings preserved. Native coordinates, paint, translations, source and Undo retained. Tests/CI/live publication pending.

### alpha.38 actual-example postcondition evidence
205JS tests PASS. Real min EPS browser import+processing2995ms versus alpha37 baseline3111ms, not an asserted universal performance improvement. BEFORE3146anchors/134sampled issues partial; AFTER1967anchors/0sampled issues partial, one covered retraced contour/three anchors removed. Clipper whole-document attempt still exceeds original-node budget and is rejected; the native exact retrace repair succeeds independently of that attempt. Real affected optimized object has1875sampled points; isolated full WASM check confirms3overlaps->0 with complete coverage. Each individual final object also checks complete/0; cross-object relationships across diagnostic batches remain unverified.
Exact helper-only repair compared through independent winding-aware Clipper XOR:0mm² filled silhouette difference; surviving native commands/controls preserved. Both EPS choices match actual AFTER geometry; outline reimport1967anchors/0issues. Verified contour-only output saved to local outputs/min_result.eps, private geometry never committed. New fixture checks exact three-overlap pattern, conservative non-removal cases and UI Apply/Undo/export. Initial issue inspection used a global contour index as a path-local index; cumulative contour prefix identified the correct local retrace. Do not change mapping merely to hide that distinction. CI/freshWASM/publication pending.

## 0.2.0-alpha.38 — covered segment retraces PUBLISHED and LIVE verified (2026-10-23)
- Functional PR53 https://github.com/tohaa28/relief-forge/pull/53 merged db3ce8180f8bc458200aed4571db01038f0e598a; source checkpoint3b95875c316c60518095407eb7a6932305fde365. PR CI https://github.com/tohaa28/relief-forge/actions/runs/39995831886 SUCCESS:206JS/17Rust/freshWASM, new covered-retrace fixture3overlaps->0complete and XOR0, browser actual repair count/BEFORE-AFTER/Apply/Undo/EPS, existing8-mode/node-editor/project/PDF and true-Union/hole gates. Main Pages https://github.com/tohaa28/relief-forge/actions/runs/39996031307 build SUCCESS and deploy SUCCESS.
- Live https://tohaa28.github.io/relief-forge/?v=alpha38 independently checked with the actual supplied min EPS in Windows Chromium. Original3146anchors -> AFTER1967, reported remaining3overlaps->0; exactly1covered repeated closed line/3nodes removed. Both actual saved EPS modes contain1967anchors; live outline bytes EXACTLY equal the independently verified local contour-only output. Confirmed partial-coverage warning remains before export, explicit user-style override in browser test; no pageerrors. Actual Undo restores3146original anchors and Redo restores1967applied anchors, checked through saved project geometry. Live cold import+processing6782ms; local2995ms vs previous3111ms, no universal speed claim.
- Algorithm F-032: same-object native closed linear return contour may be removed only if every projected collinear interval is already covered by nondegenerate surviving boundary geometry; numeric roundoff bound independent of user diagnostic tolerance. Straight Bezier control hull may provide coverage; curved loops, strokes, unsupported paint/masks, standalone/uncovered/near-parallel/gapped traces retained. Degenerate contours do not justify deleting each other.2Mnative comparisons budget; incomplete proof leaves contour unchanged and records skipped limit. Source, paint, controls, translations, selected scope and exact AFTER/EPS/Undo contract preserved.
- Actual helper-only filled silhouette XOR0mm². Isolated affected optimized object1875sampled points: complete WASM3overlaps->0; all individual final objects independently complete/0. Whole-document interaction coverage across batches remains PARTIAL, never advertised complete. Whole Clipper Union21861still correctly rejected vs original3146; native local repair succeeds while preserving original-node guard.
- Prior cases:8048531 still439->396/0complete,20outer/10holes and prior refit XOR bound preserved. Prior kalin now3152->1969/0sampled issues partial, removing the same1covered return contour, while21872Union growth remains blocked. Old alpha36/37 notes saying3residuals are historical.
- Verified contour-only user output outputs/min_result.eps is local-only, not committed or uploaded. No private input/vector bytes in Git. Regression inputs are source-owned synthetic rectangles/return paths. Full method and conservative skip cases in web/covered-retraces.js, tests/covered-retraces.test.mjs and scripts/verify-retraces.mjs. All release/cache versions synchronized to alpha.38; approved raster assets and native +/- signs retained.
- Next independent work: full cross-batch relationship verification and optional handling of uncovered/stroked retraces require separate semantic decisions; do not silently remove guide lines or weaken original-node/tolerance/coverage gates. Firefox/user external CAM importer not newly verified. Canonical runtime merge db3ce81; documentation-only follow-up can advance main without changing runtime.

## 0.2.0-alpha.39 — curve clearance (candidate)
Native bounded L/Q/C pairwise minimum distance in Worker, separate default0.1mm setting, pink circles behind vectors.12unit and Chromium BEFORE/AFTER/threshold/export regression locally passed. Real min clearance97ms source/63ms optimized. Main CI/publication pending; complete status relates only to nonadjacent segment-pair search, not existing batch diagnostics. No geometry/stroke-thickness/self-within-one-segment modification or measurement.

Alpha39 checkpoint:220localJS/14new tests incl F-033 exact-return seam, actual min ORIGINAL2287/AFTER136clearance; PR55 initial219test CI40000316968 SUCCESS17Rust/freshWASM/all browser, latest-head CI40000511482 pending; not published yet.

## 0.2.0-alpha.39 published/live verified
PR55/fa1d256, finalCI40000669760 and main build+deploy40000825101 SUCCESS220JS/17Rust/freshWASM/all browser. Native curve clearance default0.1mm, pink display-only disks under vectors, exact thresholds/BEFORE-AFTER/EPS exclusion live verified. Actual min ORIGINAL2287/AFTER136pair locations complete; both EPS1967/Undo3146/Redo1967. Adjacent joins/single-segment self approach/stroke thickness outside scope;2Mwork/3000markers/unsupported/precision explicit incomplete; legacy cross-batch WASM remains partial. User external-browser confirmation separate.

## 0.2.0-alpha.40 — whole-contour clearance minimum candidate
Fix F-034 nearby-node false marks via incident-direction checks and topology-connected zones with native shared-boundary clearance proof.20distance tests and real Chromium dense BEFORE0/parallel neck1/.05mm/separated necks2 passed; source min2287->18zones complete106ms. Default0.1mm, pink-background/EPS/Undo semantics preserved.226fullJS/freshRustWASM/remaining browsers/PR/deploy still pending; alpha39 remains published until green main release.

## 0.2.0-alpha.40 published and LIVE verified
PR57/c50ef64/source7e014b3; PR40004099807 and main40004283241 build+deploySUCCESS,226JS/17Rust/freshWASM/all existing+new browser gates. Native whole-contour minima and proof-connected narrow zones replace per-node markers: LIVE dense81nodes0marks, denseparallel1true0.05mm mark, separated necks2marks; private min18original/16AFTERcomplete. Default0.1mm, pink below vectors, unchanged EPS1967exactbytes/Undo3146Redo1967.2Mwork/50kraw/3kzones explicit incomplete; old WASM cross-batch stayspartial. Immediate native neighbors/single-native self approach/stroke width remain outside scope; user external-app verification separate.

## 0.2.0-alpha.41 — PDF named-layer namespace candidate
PDF-only self-contained layer namespace fixes strict browser "Некорректный SVG" on supplied PDF. Shared SVG/EPS/repair/narrow algorithms/UI untouched except synchronized version/cache keys.3realMuPDF unit and new Worker browser layered/text/scale/paint/images/multipage/Undo/EPS/project/invalid input checks locallyPASS; actual396source anchors/unchanged optimizer245, visual20/342400pixels. All existing229JS/Rust/freshWASM modes, PR and main publication pending.

## 0.2.0-alpha.41 published / LIVE verified
PDF-only named-layer namespace fix, all old non-PDF logic identical after version/cache normalization. PR59/6a0557f, PR40013897510/main40014070205 build+deploySUCCESS229JS/17Rust/freshWASM/all old+new browser. SuppliedPDF396source/49.789856x26.65857mm, valid paint/C, visual20/342400pixels; existing optimizer245, exact UndoRedo/EPS/project; real Unicode/layers/font/text/multipage/cancel/image/invalid input tests. Old neck LIVE0/1/2cases and minEPS18/16zones/1967exact output unchanged. F-036 first manual coldEPS120s timeout preserved, causeUNKNOWN; samebuild traced retry8072msPASS with no failed requests, no code change. SourcePDF/privategeometry not committed; user confirmation separate.

## 2026-10-26 gerb investigation — no release change (0.2.0-alpha.41)
F-037 native/proxy marker mismatch, F-038 wholeUnionrollback restores35copies, F-039 aggregatequalitycap identified on real gerb.229JSbaseline passes but known cases not covered;5sourceowned reproductions added as diagnostic tool. Runtime unchanged/noalpha42. Actual11493->11170,3284->2642partial,35copies/19pairschecked,all5AFTERselfcross false on native intervals,57protectedtiny parts; EPSroundtripidentical. Full evidence GERB_DIAGNOSTIC_INVESTIGATION_20261026.md.
