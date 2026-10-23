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
