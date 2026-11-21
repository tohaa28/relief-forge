
## M-069.1 · проверенное испытание EPS, геометрическая и визуальная верификация
- На приложенном CorelDRAW EPS независимый прототип безопасного выбора (контрольный hull и подписанная площадь) удалил 603 сегмента при 0.05 мм; 24 попытки отменены. 600dpi IoU 99.9891%, 195 пикселей изменилось из 9 069 800. Это не тот же JS-код, что production. Исходник и растры не публиковать в публичном repo.
- Реальный браузерный тест native weld с коротким угловым сегментом прошёл на GitHub CI #44711546203. 391/391 JS, 17/17 Rust, WASM и все браузерные проверки, 1975-объектный синтетический стресс PASS. Только он подтверждает реальную интеграцию staged UI, геометрии ПОСЛЕ и Apply.
- Вступившая в силу функция не изменяет исходное изображение до Apply; возврат из ручного редактора не запускает общую диагностику. Нельзя выдавать 603 независимых PS-удаления за 603 вылеченных диагностированных проблемы.
## M-069 · 2026-11-20 · геометрически проверяемое слияние близких контуров
- Пользовательский EPS впервые реально доступен и проанализирован, 1975 объектов, 2405 заполненных замкнутых подконтуров, 19836 native C/L сегментов, 22241 узел, 658 коротких контрольных hull при 0.05 мм. Два объекта содержат 606 из них; не принимать их автоматически за ошибку.
- Новый web/nearby-curve-merge.js: отдельно настраиваемая близость, подбор минимальной сварки соседних узлов (без flattening), независимый exact-native topology veto, подписанная площадь по полиномиальному интегралу, индекс контрольных hull. Дедупликация почти одинаковых самостоятельных непрозрачных фигур и соединение уникальных открытых незалитых цепочек.
- Strict ON по умолчанию: не объединять искусственно две разных заполненных фигуры даже при зазоре < tolerance, не терять отверстия и не ломать штрихи текста. Сложные / слишком плотные области остаются в untouched, прогресс и stats skipped/limited сохраняются.
- UI: checkbox + число merge-nearby-distance (мм) + strict checkbox. Только явное «Применить изменения» в normal/large preview; ручная правка не запускает автоматический перескан.
- Откат к опубликованной alpha68: f428f8ab9f7f73195e944a460de8a3cc95e4fb9d. Реальный EPS анализирован отдельно в Python/Ghostscript, не сохранять оригинал в публичный репозиторий.
- Подробная запись docs/history/ALPHA69_PROXIMITY_EPS.md. Не представлять обнаруженные близкие пары как уже исправленные дефекты.

## M-068 · 0.2.0-alpha.68 · 2026-11-20 — верифицируемое исправление самопересечений
- Ветка feature/alpha68-self-intersection-surgery; PR https://github.com/tohaa28/relief-forge/pull/100. Предыдущий main alpha67 2cd4afbf4db611c49ae8076d5f1bbe121e54764e — точка для отката.
- Решение: точные witness по кривым Безье (segment/time), локальное изменение C-ручек с приоритетом, затем разрезание петли по де Кастельжо и касательный C-мост для открытых контуров, если геометрия проверена. Никаких полилиний вместо кривых, нет растеризации.
- Пользовательские настройки: гибридный / ручки / петли, микро / мелкие / все, обязательная строгая защита заливки по умолчанию, on/off checkbox. Применение только через кнопку, два пути расчёта (обычный/большой), финальный EPS/ДО/ПОСЛЕ/Undo использует один кандидат.
- Veto: новые пересечения, отказ ядра, изменение числа/замкнутости подконтуров, изменение площади заполненного объекта, взаимодействие с чужими контурами, предел 720 сегментов, 24 соседей — безопасно пропустить и записать статистику.
- CI https://github.com/tohaa28/relief-forge/actions/runs/44699199391 FAILED 378/382 JS: устаревшие 4 теста версий/VM/снимка. Новые 5 геометрических тестов PASS. Поправлены тесты без ослабления требований, повторная проверка ожидается. Русский журнал F-068; полный отчёт docs/history/ALPHA68_SELF_INTERSECTION_REPAIR.md.
- На реальном gerb2.pdf не проверено. В manual mode никакой автоматической диагностики после «Готово» согласно alpha67.

## M-067. Коммит ручных M/L/C/Q без поиска, явная диагностическая команда (2026-11-19)
- finishDeferredCurveCommands формирует изменённые векторы из DeferredCurveEditor; checkpoint выполняется один раз на транзакцию. exitDeferredCurveEditor использует changed('curve-session-commit',{skipDiagnostics:true}); при отсутствии изменённых путей — только render. При любом выходе отключается clearance worker и диагностика по таймеру.
- changed(action,{skipDiagnostics}) сохраняет штатные расчёты для остальных путей. При skip инвалидирует mask cache DoctorTracer, сбрасывает сравнение, очищает stale issues/metrics, устанавливает manualReviewPending=true и diagnosticComplete=false, отменяет settingsTimeout и worker зазоров, возвращает управление без requestRecalculation.
- После ручной правки Undo/Redo используют skipDiagnostics:manualReviewPending. При пустом выходе manualClearancePaused=true предотвращает измерение зазоров, но подтверждённые прежде дефекты остаются видимыми.
- Реальное действие «Проверить дефекты» запускает calculate(0,{diagnosticsOnly:true}) и runProgressiveDiagnostics. После завершения проверка обновляет маркеры и обнуляет stale state; ранний return до buildUnifiedPreview исключает автооптимизацию и запасную трассировку.
- Проверки должны включать выход с правкой, пустой выход, Ctrl+Z/Ctrl+Y, интервальную паузу более 180 мс, явную проверку и полноценную сборку Rust/WASM. Не считать просмотр в Windows на исходном EPS/PDF проверенным без файла.

## M-066. Опциональный DoctorTracer и управление viewport при сложном ручном зуме (2026-11-19)
- Новая настройка `doctortracer-enabled` — default=false и часть `appliedSettings`, изменяемых только по кнопке. `retryUnfixableWithDoctorTracer` сначала проверяет opt-in; при off возвращает неизменённый report и не трогает Worker. Import-time `prepareImportBlackMask` выполняется только при on, off запускает обычный `calculate(0)`. Включение после импорта не создаёт тяжёлый bitmap немедленно: fallback on demand `rasterizeDocumentAlpha` создаст актуальную маску при выполнении порога. Существующие safety gates: >10 подтверждённых residual, full scope, IoU>=.95, площадь .95–1.05, <=200k узлов, уменьшение ошибок, full Rust/native diagnosis, Undo.
- `web/manual-viewport-performance.js`: `heavyManualScene(paths)` суммирует `commands.length` с fallback на `points.length` (порог 600) и считает векторы (порог 25). Комплексность вычисляется и кэшируется один раз за сеанс; не выполняется при каждом wheel. `screenToDocumentPoint` чистая математика viewBox xMidYMid/meet, с cached rect в UI и инвалидизацией на изменения размеров. Исходная geometry сохраняется в DOM до выхода.
- `refreshLocalZoomGeometry` выполняется синхронно на первом входе в глубокий зум до следующей отрисовки полного SVG. Обычные wheel — rAF и повторное использование bounded native paths; панорамирование пересоздаёт viewport-соседние anchors, не всю фигуру.
- Тестовый цикл: unit+static checks и CI, затем реальный Windows Chromium профайл на `gerb2.pdf` при ×8–×20, wheel FPS, pointermove latency, точность клика, сохранение EPS/Undo/ПОСЛЕ. Синтетические тесты не заменяют браузерную приёмку.

## M-065. Import-time immutable alpha cache, 600 dpi → native vector diagnosis → DoctorTracer fallback (2026-11-19)
- `web/doctortracer-prepared.js` устанавливает целевые 600 dpi, bounded 36 MP/9000 px raster cache, capped 12 MP/5000 px Worker. `createDoctorTracerMaskCache` имеет generation-token, invalidate(), prepare(), get(token) — только актуальная маска одного открытого документа.
- `rasterizeDocumentAlpha` рисует black+transparent Canvas2D в прежней физической рамке `rasterPlan`, читает только alpha из полос RGBA (<=262144 px за раз), сохраняет Uint8Array(width*height), освобождает canvas. Толщина открытых линий в мм задаётся исходной шириной пикселя (alpha64 M-064).
- `openValue` вызывает `prepareImportBlackMask` до `calculate(0)`; Cancel abort+invalidate, при ошибке вектор остаётся доступным и диагноз продолжает работу. Для импортированного растра skip, fallback fail closed.
- `preview.doctorMaskToken` присваивается при обоих путях preview (обычный и large). В `retryUnfixableWithDoctorTracer` cache.get(token) возвращает оригинальный 600dpi alpha. Work input чёрный RGBA реконструируется из 600dpi alpha без повторного рендеринга EPS, при необходимости с area-weighted box filter (не бинаризовать края). Worker transfer получает отдельную копию и НЕ может detached буфер cache.
- После трассировки сверять кандидат и исходный alpha на полном подготовленном разрешении, `maskSimilarity` принимает alpha8 и RGBA8; revalidate fullScope Rust+native, residual issue count строго меньше, mask IoU >=0.95, areaRatio в 0.95..1.05. Никаких обходов.
- Исключение: после правок токен кэша инвалидируется, поэтому нельзя использовать маску прежней геометрии; если реконструкция всё же понадобилась, fallback явно повторно готовит 600dpi alpha, пишет cache-miss event.
- Нельзя держать 4-byte RGBA как долгоживущий кэш для 36MP (144 MB). Не хранить PDF/EPS/raster в action журнале, только metadata. Оригинальные цвета и Undo untouched; больше запросов о manual zoom не влияет на эту цепочку.
- Публикацию производить через PR и зелёную CI; обновлять точки отката.

### Alpha64 — verified published checkpoint 2026-11-19
- Alpha63 user EPS JSONL 38 events: one-ink did not solve IoU=.491 / areaRatio=1.797. Alpha64 fixes physical-stroke growth on 45% retry and resamples the immutable original black alpha mask. Independent Worker segmentation mask IoU/area metrics now logged.
- CI first run 44557050466 FAILED 356/357 JS due /длину/ vs /неверная длина/ test assertion. Corrected d2c65c88. Superseded run 44557267989 CANCELLED. Final PR CI https://github.com/tohaa28/relief-forge/actions/runs/44557430633 SUCCESS: 357/357 JS, 17/17 Rust, WASM, browser smoke.
- PR #96 merged 58498bea4bdbab54dd18dcc7b06c14ddc486bbef. Main Pages https://github.com/tohaa28/relief-forge/actions/runs/44557865477 both build+deploy SUCCESS. Public https://tohaa28.github.io/relief-forge/?v=alpha64.
- Previous published rollback alpha63: 2b13e06b54331d20311308d36f152036394128a7.
- User's private source EPS bytes not available. Do not claim improvement in actual IoU or solved tracer geometry until fresh journal. If segmentation IoU is already low, investigate DoctorTracer hard mode; if segmentation good but final low, inspect SVG, compound holes and raster remapping. Retain fail-closed 200k cap/IoU>=95%/native+Rust full validation/Undo.

## M-064. Физически стабильная референсная alpha-маска при уменьшении разрешения (2026-11-19)
- Первичное рендерирование EPS/SVG → Canvas2D RGBA black+alpha. План сохраняет `strokeWidthMm=max(widthMm/width,heightMm/height)`; любые уменьшения разрешения сохраняют эту величину, чтобы 1px в источнике НЕ превращался в 2.22px в физических единицах при retry .45.
- У `app.js` уже имеется неизменяемый `originalMask` как независимый Uint8Array к первичному `firstRaster`. Передать `referenceRaster:originalMask` в `traceDocumentWithNodeBudget`. Для 70% и 45% не пере-рисовать кривые: строить box-filter с точным альфа-покрытием исходного пикселя. Bounded memory, no canvas snapshot, source EPS unchanged.
- Каждый выходной RGBA пиксель имеет R=G=B=0, A=round(sum(sourceA * пересечение пиксельных площадей) / площадь выходного пикселя), поэтому суммарная альфа-площадь сохраняется с погрешностью квантования <=0.5 на пиксель.
- Дополнительная проверка алгоритма DoctorTracer `traceFixed`: Worker 0.21.1 возвращает `segments:ArrayBuffer` с RGBA размеченной маской. Сравнивать binary(alpha>=128) входного растра и Worker segments alpha до парсинга SVG. Хранить только числа (IoU, areaRatio, sourcePixels, segmentedPixels) в `doctortracer-trace-result`.
- Если сегментация уже отличается от оригинала — причина до SVG (WASM stage). Если она совпадает, но конечный EPS отклонён — искать ошибки SVG, fill-rule, compound M..Z, координат или сглаживания. Не модифицировать DoctorTracer приложение без независимого доказательства.
- Guardrails: 200000-node cap, оригинальный bbox в mm, full-resolution IoU>=.95, площадь 0.95..1.05, полная native/Rust диагностика и меньшие остаточные проблемы до commit AFTER; исходные объекты и Undo всегда доступны.
- Bounded defaults unchanged: 100%,70%,45%; отсутствие `referenceRaster` поддерживает прежний rasterize fallback, но новое `strokeWidthMm` предотвращает physical growth и там. Подробнее ALPHA64_STABLE_MASK_DOWNSAMPLE.md.

## M-063. Одноцветная палитра и наблюдаемость качества повторной трассировки (2026-11-19)
- В RGBA8 все RGB=0, непрозрачность A=0..255. ДокторТрассер 0.21.1 трактует `label=255` как прозрачный фон вне палитры, см. `gh-pages/desktop-curves.mjs` `shared=labels.map(v=>v===255?-1:v)`.
- Передавать Worker `category:'hard',colors:1,palette:[[0,0,0]],detail:2,speckle:0,polygon:false,gpu:false`. Не смешивать прозрачность со вторым печатным цветом. 
- Новый callback `onTraced` в ограниченном ретрае 100%/70%/45% пишет число SVG `paths`, размер попытки, `paletteCount` (если доступно) и backend, без исходных данных.
- Подтверждение гипотезы требует исходного EPS и независимой повторной растровой проверки IoU>=0.95, area 0.95..1.05; исходный safety gate сохраняется.
- Альтернативу `category:'aa'` НЕ внедряли: это другой алгоритм и потенциально агрессивное восстановление логотипа, которое потребует отдельного обоснованного теста. Лимит 200000 узлов повышать запрещено.
- Если вновь неудача: сверить `doctortracer-trace-result`, `paletteCount`, SVG paths, mask similarity. Не принимать файл с плохим IoU. Реальный EPS не выкладывать в публичный GitHub.

## M-062. Канонизация RGBA8 «чёрный + прозрачность» перед трассировкой (2026-11-19)
- Силуэт чёрный RGB(0,0,0) в КАЖДОМ пикселе, включая alpha=0. Истинный фон alpha=0; полное покрытие 255; fractional 1..254 сохранить без квантования для точности краёв.
- Сначала paintDocumentSilhouette Canvas 2D c alpha:true, даже если исходный EPS бесцветный/цветной. Затем blackTransparentRgba8 после getImageData и ещё раз перед Worker postMessage, чтобы защитить будущие пути внедрения.
- Worker передаёт tightly-packed Uint8Array RGBA8 width*height*4. Для slice byteOffset >0 выделять собственный packed buffer; нормальный полноценный буфер использовать без лишней копии.
- Не использовать белый маттинг / пороговый бинарный alpha / изменение исходного материала. Отверстия compound paths сохраняются через evenodd. Режим DoctorTracer 0.21.1 hard и параметры worker пока не изменять (минимизация регрессий).
- Те же строгие acceptance gates для реструктуризации: IoU, площадь, полная диагностика, Undo. Методы и тесты описаны в ALPHA62_BLACK_TRANSPARENT_TRACER_INPUT.md.

## M-061. Bounded re-trace of dense DoctorTracer 0.21.1 SVG (2026-11-19)
- Source vector stays immutable; three resolution levels 100%, 70%, 45% preserve source bbox in millimetres.
- Retry only the exact RichSVG 200000-node cap, stop on unrelated errors and cancellation.
- Re-render candidate at original raster resolution and require IoU>=0.95, area 0.95..1.05.
- Require complete Rust+native diagnosis and fewer issues before replacing AFTER; never bypass Undo.
- Reject alternatives: globally raising SVG cap (memory/diagnostic risk) or accepting on Worker response alone.
- Tests and evidence: ALPHA61_ADAPTIVE_DOCTORTRACER.md.

## M-060. Direct native Canvas raster and hysteretic ROI (2026-11-19)
- Для отдельного Worker DoctorTracer 0.21.1 использовать **RGBA8 typed pixel data**, а не SVG Blob. Alpha59 ошибочно пытался декодировать искусственно собранный массивный SVG через createImageBitmap; journal доказал мгновенный отказ до WASM. Canvas 2D → getImageData обходят этот codec. Композитные дыры сохранять `evenodd`, open полилинии рисовать тонким stroke; original EPS неизменен. Validate rgba length/alpha before transferring.
- Для высокочастотного zoom не обновлять каждый `d` и каждый glyph при wheel. Держать `manualZoomRegion`, пересоздать local Bézier only когда viewport покидает ROI или геометрия изменилась; скрыть исходное огромное SVG дерево во время manual zoom. Сохранять Canvas/Undo и восстанавливать геометрию при выходе. 
- Заменить log events с огромными вложенными preview статистиками на компактные числовые summaries; файл пользователя alpha59 11MB из 19 событий. Полная история методов и неудач в `ALPHA60_CANVAS_DOCTORTRACER_PERFORMANCE.md`.

## M-059. Срабатывание на нижней границе дефектов и viewport-local canvas
2026-11-19. Для частично проверенного EPS факт наличия 11 дефектов достаточен **для запуска попытки восстановления**, но недостаточен для утверждения отсутствия других дефектов. Порог принятия трассировки оставлен `after.complete&&after.fullScope&&afterIssues.length<originalCount&&IoU>=.95&&areaRatio 0.95..1.05`. Реальная версия DoctorTracer взята из gh-pages `48dfa7b6`, не из устаревшего main. Для manual zoom вместо полного SVG repaint рисовать только nearby indexed native Bézier segments; на глубоком зуме source SVG скрыть `display:none` (исходный DOM не менять), rAF coalescing, обновлять glyph attributes без destroy/create. См. [ALPHA59_DOCTORTRACER_ZOOM.md](ALPHA59_DOCTORTRACER_ZOOM.md).

### M-058.1. Растровая защита отверстий сложных составных кривых
У исходного EPS/SVG может быть несколько замкнутых подконтуров M…Z в одном объекте. Если при подготовке растра нарисовать каждый путь отдельно чёрным — внутреннее отверстие исчезнет. Исправление alpha.58: собрать все закрытые фрагменты **одного** path в один SVG `<path fill-rule="evenodd">`, а открытые штрихи рисовать независимо, строго одним физическим пикселем в raster ROI. Зафиксирован regression с двумя вложенными прямоугольниками. PR CI 44478991540 PASS.

## M-058. Изолированный внешний DoctorTracer WASM как спасательный маршрут после полного сканирования
Дата 2026-11-19. Триггер строго N>10, если fullScope && complete и объектная область соответствует всему документу; одна попытка на исходный AFTER preview. 300DPI ROI 2400px/8MP, бинарный silhouette по fill-rule даже-нечётное/однопиксельные открытые линии. Обратно в mm сохраняя page size, но не старые EPS/PDF binary stamps. Кандидат должен снизить N и пройти независимую проверку raster IoU>=0.95 и площади 95..105%. До финального commit — только candidate preview; Undo старого файла. Worker DoctorTracer 0.16.0 остаётся в другом приложении под GPL, локальный same-origin URL. Фактическая успешная трассировка отдельного пользовательского EPS требует приёмки. См. [ALPHA58_DOCTORTRACER_FALLBACK.md](ALPHA58_DOCTORTRACER_FALLBACK.md).

### M-057.1 — Валидация контракта результата и versioning (2026-11-19)
- В обработке появились два новых snapshot: `filtered.document` перед геометрическим разведением, `untangled.document` как финальный AFTER. Все места предпросмотра, счётчики и EPS используют последний.
- Release cache-keys нужно менять для **каждого** versioned import в web/, а не только app.js и index.html. Поскольку `tests/module-cache-version.test.mjs` сканирует весь web/, первое частичное обновление не прошло; затем исправлены 32 файла. CI 44468034227 подтвердил синхронность.

## M-057. Точечное разведение несоседних совпадающих опорных узлов
Дата 2026-11-19. Не использовать сам факт совпадения координат как доказательство возможности исправления: в X-образном случае точка пересечения просто переместится. Использовать native C/Q/L и точный intersection kernel для всех сегментов внутри swept control-hull. Старт смещения 1.05 диагностического допуска, до 25% локального сегмента, при доказанном отсутствии новых контактов. Соседние узлы и closed seam исключить. Любая неопределённость => no-op. Вычисление по явной кнопке вне ручного редактора, с EPS/Undo и исходным оформлением. Подробности: [ALPHA57_COINCIDENT_NODES.md](ALPHA57_COINCIDENT_NODES.md).

## M-056 — приёмка и геометрическая защита, 2026-11-19
После общего CI на alpha.56 добавлены тесты топологии, в которых обнаружено, что naive-размыкание закрытого подконтурa простым удалением Z теряло смысл выбранной точки. Размыкание реализовано через циклическую перестановку реальных L/Q/C управляющих сегментов и преобразование неявного Z-звена в явный L без изменения рисунка; при изменении порядка C/Q/L сохранять сохранённые типы исходных узлов по пространственному соответствию, не по старым командным индексам. Нагрузочный браузерный тест подтверждает 0 перестроений основного SVG во время 7 mouseup и 40 pointermove; snapshot оригинала и общий Undo только после «Готово». Финальная сборка: [CI 44464521648](https://github.com/tohaa28/relief-forge/actions/runs/44464521648), 318 JS + 17 Rust, main `1e9ff2b`, [полный журнал](ALPHA56_DEFERRED_LOCAL_EDITOR.md). Исходный PDF пользователя не публиковать; живую Pages-сборку не считать проверенной без отдельного факта.

## M-056. Транзакционный command buffer, инкрементальная геометрия и атомарное завершение
Дата 2026-11-19. Установлено: alpha.55 исправила O(N) работу в pointermove, но оставила полную SVG сериализацию, snapshot всего документа, full render и повторную диагностику в pointerup. При составном PDF с 7545 кубическими Bézier-кривыми это основная остаточная задержка. Решение alpha.56: локальный буфер нативных команд M/L/Q/C/Z; изменяются только управляющие команды смежных сегментов, с локальным Undo/Redo; исходная фигура остаётся неизменной до выхода. Пространственный индекс control hulls используется при поиске ближайшего сегмента, а SVG-патчи хранятся и обновляются по ключу затронутого сегмента, не удаляются пачкой при каждом клике. Отдельное сохранение через существующий writer один раз на выходе обеспечивает сохранность paint/clip/transform/EPS и единый Undo checkpoint. Любой отказ финальной сериализации не должен менять исходные данные. Диагностика проблем и clearance Worker во время правки не активны; предыдущие маркеры не объявляются исправленными до полной повторной проверки. [Подробности](ALPHA56_DEFERRED_LOCAL_EDITOR.md).

## M-055. Составной Bézier-вектор и производительность интерактивного редактора
Дата 2026-11-18. Объект `gerb2.pdf` содержит 7545 C внутри одного PDF Drawing. Исключено ложное предположение «редактировать только один объект = O(1)»: для 7545 C это почти весь рисунок. Измеряется горячая область в экранных пикселях и используются пространственно ограниченные SVG-якоря, кэшируемые по ссылке на неизменённый path. Во время перетаскивания обновляется только SVG-патч до двух сегментов, без мутации документа и DOM-rebuild; при отпускании применяются существующие точно проверенные алгоритмы с Undo. Обновление за пределами текущей области и полная диагностика отложены до выхода из ручного режима. Оставшаяся O(N) работа на commit зафиксирована как отдельный следующий цикл, но исчезла из mousemove. Все тесты, опасности и откат: [ALPHA55_LARGE_PDF_PERFORMANCE.md](ALPHA55_LARGE_PDF_PERFORMANCE.md).

# Alpha.54 — committed settings snapshot and bounded manual diagnosis (2026-11-18)
- Never let an `input/change` event call full-scene `calculate()`, Union, optimizer or clearance Worker: settings from the form are a draft, `appliedSettings` is the single source of truth. Pressing «Применить изменения» validates inputs, commits them and runs one deliberate calculation; a clearance-only threshold applies measurement without any geometric edits. A preview and confirmed EPS must be taken from a single immutable result, with Undo after geometry apply.
- In manual Bézier edit mode, only run `diagnoseLocalNodeArea` around the action's original/current cursor neighbourhood (36 CSS pixels, at least 3× diagnostic tolerance). Iterate native curve commands, select local anchors/segments, use a bucketed proximity comparison; do not flatten the whole document for rechecking. Preserve issues outside the neighbourhood; retain prior issues when native parsing or local budgets fail. Only open/short/coincident/near_node can be locally reverified. Crossing, overlap and duplicates remain warning markers until explicit full-document inspection.
- A local success is **NOT** a complete-document certificate. Never set `diagnosticComplete=true` from a bounded cursor task. During node editing, suspend full-document clearance worker; the ordinary `render()` only paints geometry. Original C/Q control points, EPS source appearance, DO/AFTER and Undo stay intact.
- Cursor 'Удалить' renders a 32px transparent SVG containing a central red X with no long crosshair arms and no opaque circle. Change only visual cursor, not the actual hit-test and node snapping geometry.
- Detailed experiment and failure chronology: [ALPHA54_EDITOR_SETTINGS_WORKLOG](history/ALPHA54_EDITOR_SETTINGS_WORKLOG.md). Rollback alpha53 `ccbe0a8`.

# 0.2.0-alpha.43 CANDIDATE — 2026-10-26, NOT PUBLISHED
- Source branch `feature/alpha43-scoped-union-webgpu` based on published alpha.42 (`b454bcf`). Do not claim publication or CI success before evidence.
- Real WebGPU WGSL compute broadphase for native Bézier convex-hull AABB candidate pairs (high-performance adapter, conservative f32 padding). Device/readback buffers are disposed. CPU fallback for unsupported browsers, documents outside limits or device errors. GPU only filters candidate pairs; CPU f64 sampling, Clipper Union, Bézier post-refit, quality checks and EPS snapshot remain authoritative.
- Group-scoped Union acceptance: every independent group and each compound path is refitted/checked before commit. Invalid, node-inflating or over-budget groups stay original, while other approved groups and exact opaque source-copy removals remain. Overall input-node ceiling remains; no disabling topology/hole/paint guards.
- Both ordinary and large EPS preview use new GPU candidate prefilter, then Union -> smoothing -> optimization -> AFTER diagnostics -> EPS from one snapshot.
- Explicitly **not** implemented: full f64 analytic curve-curve Boolean tracing, guaranteed elimination of every unnecessary new node, full cross-batch diagnostic coverage, GPU Clipper/geometry kernel, hardware speedup proof on GTX 1080 or RTX 3050.
- Verification TODO: static/238+ JS, 17 Rust, compiled WASM, real Chromium EPS/PDF/Undo/Export parity, CPU/WebGPU candidate identical output, release Pages push and live user checks. No private `gerb.eps` committed; actual screenshot and exported file remain outside repo.
- Pre-existing alpha42 checkpoint: PR #62 merged `3dd7099`; final publication with history PR #63 `b454bcf`, Pages CI40308614388 SUCCESS. Preserve this rollback target.

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

## 2026-10-27 · alpha48 native Boolean certificate and responsive jobs
Preserve alpha42–47 Union-first, independent exact dedup/per-group rollback, WebGPU conservative candidate hint with4500ms deadline, CNCfilter, original importDO/defaultAFTER and curve toolbar. Paper0.16.0 MIT is only candidate topology. Independently reconstruct every output L/Q/C from source parameter intervals with de Casteljau; coalesce same-source continuations. Extended straight edge requires exact collinear source interval coverage and no internal nodes. Added noninherited anchors must be verified branch junctions at2e-8mm. Persist recomputable source/ring certificate; modified commands or unavailable source input cannot authorize node growth. Local growth and document growth bounded by actual certified necessary cuts; legacy unproven polygon rules retained. Dominant original shortcut allowed only if native candidate proof covers every source segment fully and exclusively, not sampled containment alone.
Independent Clipper verification uses finite-chord control-hull bounded0.0005mm sampling/1e-6mm integer grid, strict sampled hole count and explicit perimeter discretization XOR allowance. Stored/output geometry always native. Numerical uncertainty fails closed per group. Native classifications evaluate paired cubic witnesses, native coincident nodes/short control hulls; unresolved contacts explicit incomplete, existing sampled duplicate/open scope flag remains honest. Optimizer source-anchor subset, no newly located native contact/overlap or new short spans; alpha43 scoped fallback retained for explicit budgets.
Heavy Boolean/native diagnostic tasks run in cancellable module Worker; GPU hint still computed on browser with its timeout. Generation guards discard stale output. EPS writer unchanged: exact cached approved ПОСЛЕ coordinates in both modes; real Export/Apply/project/Undo test. GPU actual hardware speed not measured; no claim replacing robust CPU topology with float32 compute. Corel, Ghostscript, PDF, CMYK, M/L/C/Q real-node, Undo and paint/hole safety remain.

## 2026-10-27 · alpha49 startup versus processing and asset transport
Keepnativegeometryinvariantsfromalpha48. ThepageimportsinterfacewithoutPaper; nativequalityproviderispreparedbeforeprocessingwith20sdeadline. NodeanddedicatedWorkersawaitprovideratmoduleinit; versionedlocalESMgraphmustshareoneproviderinstance. Workerreadyendsstartupdeadline;actualgeometrycomputetimehasnothenew20slimitandremainsoperatorcancelable. No silentqualityacceptanceifkernelmissing. Independentnon-modulewatchdogderivesversionfromrequestedscriptandruntime, markswaitingratherthanfatalwhennoerror, snapshotsreportondemandanddismissesonready(event+pollfallback).
EPStransport: streamGSandMuPDFbinariesconcurrently, reset45sidleabortonlyonactualdata; rejectHTTP/HTMLmagic/oversizebeforeinstantiation. Byteprogresscountsdecodedresponsebody;gzipContentLengthisNOTthetotal. Buildgeneratedversionsmanifestprovidesexpecteddecodedbyteswithoutblockingdownloads(metadatafailurefallsbacktounknowntotal). MuPDFsupportedglobalModulewasmBinaryhookconsumessamealreadydownloadedbytes, verifiedonebinaryrequestinactualbrowser. Nativeenginesunmodified,licenses/provenancedigestsretained. Workerkeepswarmenginesbetweenfiles/freshGhostscriptFSperdocument.120sparentguardisnowidleprogress,notarbitrarytotaldurationduringactivedownloads. FastpathEPSstillneverloadsengines; PDFonlyloadsMuPDF. Originalvectors/paint/CNCfilter/Undo/ПОСЛЕ=EPSremainunchanged.

## 0.2.0-alpha.50 candidate — 2026-10-27T12:10:13.741Z
Base main3732bfe1b50eb098dc1ad4ebf34ae4a864f4a5c1, alpha49 PR76 published: CI40498160209 and main40498713198 build/deploy SUCCESS. Live gerb11493->9668,29 remaining protected diagnostics; both EPS identical geometry/paint to alpha48.
Live alpha49 startup regression exposed Cancel/new import before restarted Rust ready: old suppressNextDiagnostic flag suppressed NEW document preview. Clear suppression on explicit changed(action), reset readiness/header on spawnWorker, version worker URL. No geometry/paint/Undo/export algorithm changes. Deterministic browser holds restarted Rust, imports new SVG, releases Rust and requires automatic preview3->2. Positive PASS; removing suppression reset alone fails at30s with document parsed but no preview.
Harness attempts preserved: initial LF/CRLF replacement missed and query-only route missed bare worker URL, so first negative unexpectedly passed without exercising race. Corrected wildcard and explicit blocked precondition; immediate unroute raced pending route.continue (already handled), corrected with continuation acknowledgment. Final negative FAIL is expected evidence; good app restored. Full qualification and publication pending.

## 0.2.0-alpha.51 candidate — 2026-11-11T08:11:51.589Z
Base main b2f811613f9685d1c379480d9e03b528fc1d76e7, alpha50 Pages build/deploy40502471017 SUCCESS. User reports Doctor highlights close points ArtCAM does not. Exact user case and ArtCAM settings unavailable; no claim of ArtCAM parity.
Reproduced old native pass treating any nonadjacent anchors within repair tolerance as coincident, including separate subpaths and two ends of a dense local run. Renderer also removed all healthy anchors within tolerance of each marker. Synthetic baseline: three coincident/two short; candidate: zero coincident/two short. For different subpaths nonzero gaps belong to native curve clearance; true coordinate equality (8 machine eps scaled by coordinate magnitude, capped 1e-8 mm and actual tolerance) still counts as coincident. Different branches of same subpath within tolerance get near_node, with unrounded Euclidean distance and two exact native witnesses; a short local arc certified by the Bézier control polygon length upper bound, including reverse seam distance, is not a branch pair. Adjacent anchors use existing short classification; actual short spans and native contacts unchanged. Spatial grid and 2M pair/10k marker budgets preserved. No changes to repairs, export geometry, curve clearance or threshold defaults. If native worker fails, DO hides unwitnessed sampled Rust point markers and remains explicitly incomplete.
Renderer only substitutes the named owner+coordinates for point witnesses; both anchors marked, precise distance displayed in marker tooltip/list, unrelated healthy anchors retained. Current geometry and repair safeguards preserved. Synthetic boundary tested within ~1e-9 mm on either side; exact threshold inclusive; translated Q/C witness. Previous module direct comparison on private gerb source 612 coincident -> 552 exact/17 near; after14 ->1 exact/9 near; other native counts unchanged. Native after 130/128ms single sample, not a performance claim. Private files not committed.
First edit script missed marker import token due to named import order and stopped; corrected explicitly. First browser fixture lost one intentionally tested anchor to correct collinear optimization on AFTER, so it was invalid as a persistent-witness case. Replaced with non-collinear anchor and unequal-length parallel paths to isolate node class from legacy duplicate diagnostics. Browser passes DO/AFTER, measured .006mm and both dots. Unit4/4 targeted, broad CI/publication pending.

### Alpha.63 — verified published checkpoint 2026-11-19
- PR #95 MERGED: https://github.com/tohaa28/relief-forge/pull/95, main `ea698f7089277ffbcae1a3561f75d3869529dd10`.
- CI https://github.com/tohaa28/relief-forge/actions/runs/44546808673 SUCCESS 352 JS, 17 Rust, WASM/browser. GitHub Pages https://github.com/tohaa28/relief-forge/actions/runs/44547200595 build+deploy SUCCESS.
- URL https://tohaa28.github.io/relief-forge/?v=alpha63 ; rollback alpha.62 `b461a5fd1df0d043e27f721c32c3f3a7c516e7cf`.
- This is a targeted single-ink palette hypothesis based on alpha.62 session log and DoctorTracer transparency handling; actual private EPS result/IoU still UNVERIFIED. Never claim 0.491 fixed before a new run.


### 0.2.0-alpha.65 — verified published checkpoint 2026-11-19
- User requested 600dpi black image on transparent background computed and temporarily cached ON IMPORT, then native vector healing; DoctorTracer 0.21.1 only after >10 residual confirmed issues.
- Implementation: temporary alpha-only mask (1B/pixel), 36MP/9000px ceiling, 600dpi when safe; reconstruction of black RGBA8 for Worker at <=12MP/5000px, using cached alpha with no EPS re-rasterization on fallback. Source and Undo unchanged; original-resolution IoU >=.95 + area .95..1.05 + full Rust/native diagnostic unchanged.
- Merge PR #97 https://github.com/tohaa28/relief-forge/pull/97, commit `a9cbec14c5832eb5150fb6e32bfab0f8a54dc146`.
- PR final CI https://github.com/tohaa28/relief-forge/actions/runs/44588775856 **SUCCESS 367/367 JS, 17/17 Rust, WASM and browser smoke**. GitHub Pages https://github.com/tohaa28/relief-forge/actions/runs/44589267391 **build+deploy success**.
- Public: https://tohaa28.github.io/relief-forge/?v=alpha65 . Rollback previous published alpha64: `65e27e8b6f59837c4128952417428e2c138b0f39`.
- Failed interim CI: 44588150682 (362/367 JS, 5 compatibility tests), 44588335827 (intermediate fixes incomplete); canceled 44588593552/44588631954 because commits superseded them. Kept in history.
- Note: real original user EPS `8101921_maket_7_121126_163426.eps` is NOT uploaded. Do not claim IoU improvement on it; fresh test journal needed to check import-prepared 600dpi, cacheHit and accuracy.
- Full entry: `docs/history/ALPHA65_IMPORT_600DPI_MASK.md`, F-065/M-065, `logs/actions.jsonl`.



### 2026-11-20 · ограниченный локальный ремонт

Считать только объекты, отправленные на поиск пересечений, и прерывать весь проход при общем лимите правок. Для следующего эксперимента ранжировать объекты по нативным свидетелям пересечений с координатами, параметрами обеих дуг и признаком полноты. Касание, совпадающий интервал, внутренний стык и поперечное пересечение требуют разных решений. Проверить отсечение Безье (Sederberg–Nishita, DOI 10.1016/0010-4485(90)90039-F) с делением де Кастельжо при слабом сужении. При неразрешённом контакте оставлять локальную геометрию. Начинать с обратимого разбиения или склейки кубик без отклонения, затем проверять ограниченные смещения, ориентацию, правило заливки и вложенность. На приватном EPS эти варианты ещё не проверены.


### 2026-11-20 · одиночная ручка и обрезка микропетли в точке пересечения

Одиночное смещение оценивается по коэффициенту Бернштейна 4/9, смещение двух точек — по сумме коэффициентов не более 3/4. Для микропетли открытого контура разбиение создаёт кандидат без моста, допустимость удаляемой дуги ограничена контрольной оболочкой и расстоянием до нового стыка. Приоритет по нативным свидетелям расходует ограниченный бюджет ремонта на объекты, где уже обнаружено самопересечение. Полнота и сохранность по-прежнему проверяются при принятии каждой правки.

### 2026-11-20 · сохранить обе дуги микропетли

Вместо удаления петли можно разделить траекторию по двум нативным параметрам одного пересечения и развести два стыка. Для ограничения отклонения меняется только стык петли. Сохранение заливки при разделении не доказано, поэтому действие доступно для незалитой геометрии. Кандидаты с подтверждённым новым контактом и неполной локальной проверкой отклоняются. Замкнутый подконтур сохраняет петлю в EPS и не объединяется с основной дугой.

### 2026-11-20 · разведение распознанной пары и сварка рассчитанного шва

Для близкой несоседней пары искать небольшой сдвиг, начиная с недостатка расстояния до диагностического допуска. Короткой ветвью того же контура и соседними точками не считать отдельный контакт. Для близких концов одного открытого подконтурa брать середину, чтобы уменьшить максимальное смещение. Тип open определяется исходными векторными командами независимо от полилинейного отчёта.

### 2026-11-20 · точная компенсация дуг, обратное деление, проверенные неполные Union

Для пустой по winding экскурсии проверяется совпадение контроля в обратном порядке и отсутствие видимой обводки. Для короткого разбиения верифицируются оба набора контрольных точек через обратное деление без геометрического допуска аппроксимации. Для двусторонней правки узлов проверяются обе изменённые ветви, в том числе внутренние петли одной кубики. Нормаль другой дуги даёт новую степень свободы с консервативной границей Бернштейна. Для отклонённой группы Union пробуются соседние пары с прежней нативной проверкой и сохранением порядка наложения. Если проба не доказана, объект остаётся прежним. Диагностика узких зазоров не вызывает ремонт.

### 2026-11-20 · геометрическое замыкание для CNC и сварка численного шва

Фильтр CNC признаёт точный возврат к началу с явным Z или без него. Применяются прежние независимые пороги ширины и высоты и настройка удаления микроэлементов. Замыкание Z короче 1e-8 мм можно совместить в самой кривой с проверкой локальных контактов и площади. Эти операции не изменяют порог диагностики зазоров и не исправляют узкие места по одному лишь расстоянию.

## M-072. Диагностировать объединённую копию до любого ремонта

Пользователь изменил порядок 2026-11-20. Накопленные старые описания «diagnose original → point repair → Union» являются историческими. Новый normal и large маршрут использует prepareAfterCopy/prepareWorkingCopy: immutable original → native Union → compatible compound → Rust/WASM и native diagnosis копии → point repair/refit/smoothing/прочие исправления → cached AFTER diagnosis → Apply/Undo/EPS.

ДО и подготовленная копия имеют независимые массивы объектов и замечаний; не переносить path indices между ними. preparedDoc/preparedIssues отображаются отдельной вкладкой. Подложка ПОСЛЕ строится по ВСЕМ beforeDoc.paths, никогда по after index. Разные цвета, маски, прозрачность, неоднозначный Union не разрешают ложное объединение; причины явные. Compound хранит точные мировые M/L/C/Q/Z, поддерживает независимые подконтуры и отверстия. При различном fill-rule допустима только повторная native нормализация с Clipper silhouette/holes и source-provenance контролем. При выключенном Union не соединять перекрывающиеся заливки в evenodd path.

Защита бюджета ремонта использует диагностированную копию как baseline, иначе необходимые подтверждённые узлы пересечения будут ошибочно считаться ростом от оптимизации. После изменения количества объектов нельзя откатить геометрию к старой индексации и продолжить применять новые indices.

Проверки новой схемы: tests/after-preparation.test.mjs и обязательный scripts/browser-alpha72-pipeline.mjs. Реальный пользовательский файл в этой сессии не предоставлен. Полная история решений/неудач/проверок: history/ALPHA72_UNION_DIAGNOSE_REPAIR.md.

## M-073. Зум без синхронного SVG-перестроения; проверка сглаживания в мировых координатах

Manual zoom накапливает manualPendingView относительно курсора каждого события и применяет его одним RAF. Не изменять doc, команды Безье, Undo или диагностику на wheel. Ограниченный heap выбирает nearest K по закешированным world hulls; SVG сериализуется лениво только для выбранных сегментов. Move/Undo инвалидирует incident segments; структурные изменения штатно перестраивают индекс. Кеш с truncated/limited покрытием нельзя повторно использовать неограниченно при увеличении. Границы соседей включают controls и translation, а не только local anchors. Оригинал и источники EPS остаются точными.

curve-quality сравнивает geometryCommands (world M/L/C/Q/Z) у source и candidate. Сглаживание вправе записать offset в commands, сохранив мировые якоря. Не прибавлять offset снова в combine/bounds и не принимать offset-only translation как unchanged. Защита native intersections, закрытых площадей и sharp corners сохраняется. UI-проверка доказывает изменение handles и EPS, а не только текста/счётчика. Измерения 20k синтетической сцены/CPU4 отделены от пользовательской производительности. Детали, failed tests и лимиты: history/ALPHA73_EDITOR_ZOOM_SMOOTHING.md.

## M-072 · alpha74: острые углы становятся native C

## 0.2.0-alpha.74 — скругление острых углов (кандидат, 2026-11-20)

Запрос пользователя: «сглаживание Безье должно работать иначе. оно должно сглаживать острые углы». База main 19da7d2328ac8d32656cee5bf63dd1bae0e2a01f (опубликованная alpha.73); ветка feature/alpha74-sharp-corner-smoothing. Новый модуль web/corner-rounding.js вызывается в native-worker последним этапом после nearby merge в обычном и большом preview. DO неизменен; Apply/Undo/EPS используют AFTER.

Причина подтверждена: прежний smoothSegments исключал стыки dot<.90 и линии. Новый roundBezierCorners подрезает точные L/Q/C интервалы de Casteljau и вставляет реальные кубические C с согласованными касательными; обрабатывает шов замкнутого контура. Оптимизатор продолжает защищать углы; это правило отменено пользователем только для инструмента сглаживания. 0 = отключено. Скругление намеренно добавляет узлы, независимо от прежнего общего запрета необоснованного node-growth; тот запрет не ослаблен, отдельный этап имеет лимит 4000 углов и доказательство локального отклонения. Сильнее допуск — больше скругление.

Бюджеты: прежнее мягкое сглаживание получает .3 заданного допуска, окончательное скругление .7. Каждая удаляемая часть и все управляющие точки дуги лежат в шаре .45 от выделенного допуска вокруг старой вершины; выпуклая оболочка ограничивает симметричное отклонение .9 выделенного допуска. Вне шара точные подинтервалы исходных Безье. Общая сумма < заданного допуска сглаживания; отдельная оптимизация имеет собственный допуск. Угол поворота >25.84° (dot<.90), точные развороты 180° пропускаются. Открытые концы, число/замыкание частей, знак площади колец и новые пересечения проверяются. Неоднозначная топология/исчерпание строгого intersection budget → полный откат скругления с причиной, а не неподтверждённая геометрия. paint сохраняется, устаревший nativeUnionProof удаляется после изменения геометрии.

Проверки: шесть новых unit-сценариев PASS (L-L/G1, closed seam, off/limit, масштаб допуска, Q-Q+offset+paint, новая помеха→rollback). Новый uninstrumented Chromium gate PASS: staged/off, реальная C, свободные концы, EPS==AFTER, Undo/Redo, 151 острый угол в большом маршруте. Первое npm test: 422/426, четыре устаревших static/VM ожидания; VM вызов Worker при 0 устранён, assertions обновлены для финального rounded.document и .3 бюджета. Второй npm:424/426, ещё два regex исправлены; итог426/426 PASS до version bump. Первое полное browser выполнение остановилось на covered-retrace: ожидало7→4, получило7→9 из-за четырёх новых скруглений и явного замыкания. Тест изолирован smoothing0 через реальный Apply, геометрические проверки и EPS assertions сохранены. Полный финальный Rust/WASM/browser после bump ещё выполняется. Пользовательский EPS не предоставлен, только синтетические fixtures; GitHub PR/CI/Pages пока не выполнены. Публикация не заявлена.

## M-073 · alpha75: камера отдельно от документа; единый источник defaults

Viewer reuse full native SVG + one RAF virtual camera; cache decoration refs once per render, no native parsing/spatial traversal/clearance Worker on wheel. Editor remains bounded native segment cache because its local editing needs differ; do not cull opaque fills or raster images in viewer. DOM-free meet mapping preserves moving-cursor anchors. Reset uses HTML defaults to avoid divergence of initial and restored controls, stages settings until existing Apply, includes range/check/select, smoothing0. See history/ALPHA75_VIEW_ZOOM_DEFAULTS.md for budget, failure and test evidence.

## M-074 · Один move, маршрутизация по цели жеста

Anchor glyph → existing moveAnchor; data-curve-handle → existing moveHandle in same move tool. Keep deferred local patch/Undo/session commit and node-kind constraints. V/H aliases same tool; Add/Remove remain distinct and never drag handles. Avoid changing the unrelated repair-self-intersection handles option. Real pointer tests and EPS compare in history/ALPHA76_UNIFIED_MOVE_OPEN_RESET.md.

## M-075 · Open resets before file selection, keeps previous document in Undo

Shared resetWorkspace for New/Open commits valid local edits first, checkpoints nonempty previous model, clears stale generations/timers/overlays/comparison/report, creates300×200 empty doc and Fit before file.click. Cancel remains empty per explicit user request; settings and file history are retained. Failed import after Open stays empty; direct drop error recovery is preserved. Caption must not call export basename fallback for a missing source. Full browser picker/cancel/same-name/Undo tests required before publication.

## 0.2.0-alpha.77 · Вкладка DoctorTracer

База 6bd106f, опубликованная alpha.76 (PR #108, Pages 44881094487). При включении и применении настройки вся векторная работа получает вкладку DoctorTracer с подготовленным силуэтом, прогрессом и отменой. Вкладка использует существующий Worker DoctorTracer 0.21.1 с передачей RGBA. Порог 11 больше не препятствует запуску. Обработка выделенной части не заменяет весь документ. Полученный SVG возвращается в основную область и проходит проверку силуэта, Rust и нативную диагностику. Требуется полная проверка и строго меньше дефектов, поэтому чистый исходник не заменяется только ради трассировки. При отмене и сбое остаётся результат векторной обработки. Первые тесты выявили CRLF в app.js и устаревшее ожидание вызова проверки без аргумента threshold. Исправлены окончания строк и ожидание. Кандидат, публикация ожидается.

## 0.2.0-alpha.78 · Маркеры после редактора, 2026-11-21

База 6174189, alpha.77, Pages 44882012498. Раньше выход с правками очищал список дефектов. Теперь сохраняет его и откладывает только диагностику всего документа, когда были известные дефекты. Только полная проверка заменяет прежние отметки. При частичной проверке или сбое прежние свидетели остаются, интерфейс отмечает отсутствие подтверждения. Диагностика не запускает автоисправление и DoctorTracer. Выход без правок оставляет существующие отметки без запуска проверки. Отложенная работа проверяет актуальность документа.

Браузерный тест на двух открытых контурах подтвердил исчезновение отметки закрытого контура и сохранение второго. Первые три статические проверки ожидали старую сигнатуру и сброс списка. Ожидания обновлены под новый контракт. Тестовые данные синтетические. Публикация ожидается.

## 0.2.0-alpha.79 · Контуры и отметки при выходе из редактора

База main 035dab9, alpha.78, Pages 44882980563. Пользователь сообщил, что устранённый дефект может оставаться отмеченным, а часть векторов после «Готово» отображается с заливкой. При закрытии всех подконтуров отредактированного объекта его маркер открытого контура снимается сразу. Если полная диагностика частичная, выполняются независимые проверки до восьми групп объектов, связанных с отредактированными маркерами. Полная проверка такой группы заменяет её нативные отметки, неполная сохраняет их. Сохранены отмена по поколению, команды M/L/C/Q/Z и диагностика без автоисправления.

При выходе включается контурное отображение для всех векторов, а растровые объекты используют прежний вывод. Оригинальная заливка остаётся в документе и экспорте, обычный вид доступен в «Проверка рабочего поля». Причина смешанного отображения воспроизведена синтетическим SVG с двумя открытыми контурами и залитым прямоугольником. Браузер подтвердил три контура без заливки и один маркер неисправленного контура. Первое статическое ожидание ветки artwork обновлено для сохранения показа растра. Публикация ожидается.

## 0.2.0-alpha.80 · Точки и быстрая проверка при выходе

База main 234b71e, alpha.79, Pages 44883996282. Причины пропадающих узлов в редакторе: сохранённый hidden на слое узлов, ограниченное окно вокруг последнего клика и устаревшая ячейка индекса после перемещения. Рабочие узлы отделены от переключателя здоровых точек, видимая область имеет приоритет, активный узел закреплён, перенос обновляет только затронутую запись. Число экранных узлов по-прежнему ограничено при общем масштабе.

После «Готово» вместо обхода рисунка, выборки кривых для Rust и повторной глобальной проверки выполняется нативная проверка существующих маркеров по связанным объектам. Передаётся только геометрия этой группы. Общий бюджет проверок 3 секунды, включая запуск Worker. Непроверенные маркеры сохраняются. Полная проверка доступна кнопкой «Проверить дефекты». Диагностика не меняет геометрию. Проверки синтетические. Локальные браузерные сценарии передачи узла между режимами, Undo/EPS, маркеров и переключателя точек прошли. Публикация ожидается.

## 0.2.0-alpha.81 · Розовые метки поверх результата ПОСЛЕ

База main 21b1e29, alpha.80, Pages 44885281533. Анализ зазоров уже получал геометрию видимой стадии, но розовый слой выводился под результатом и исходной подложкой. Для ПОСЛЕ слой переносится поверх геометрии, ниже узлов и остальных дефектов. На прежних стадиях сохраняется прежний порядок. Перестановка идемпотентна, экспорт не использует этот слой. Chromium проверяет расстояние 0,05 мм, порядок отрисовки до и после, переключение стадий и EPS. Кандидат, публикация ожидается.

## 0.2.0-alpha.82 · Удаление узлов и отзывчивый выход

База main 63245a4, alpha.81, Pages 44919754986. По просьбе пользователя измерена ручная правка на предоставленном локальном EPS, без переноса файла в GitHub. В отдельной сессии после импорта 30 объектов, выбран самый плотный контур с 1230 узлами. Один одинаковый прогон до/после: обработчик удаления 23,4 → 9,6 мс, выход 32,9 → 26 мс. Измерены синхронные участки JS, без времени отрисовки и без обобщения на все операции.

Построение индекса использует числовые команды без выделения массивов контрольных точек каждого сегмента. Чтение узлов использует временные ссылки на команды вместо их полной копии. Запись SVG применяет обратную аффинную матрицу к нативным координатам, сохраняет обёртки, оформление и геометрию. Отображение нативных команд не разбирает строку SVG заново. Маркеры проверяются фоновым Worker с бюджетом предыдущего выпуска. Результат устаревшей проверки игнорируется при смене документа, редактора или диагностики. Обновление маркеров использует уже смонтированную геометрию. Первые два статических теста ожидали прежнюю сигнатуру render, контракт обновлён. Публикация ожидается.

## 0.2.0-alpha.83 · Видимый индикатор при выходе из редактора

База 336ea6a, alpha.82, Pages 44921690127. Пользователь уточнил, что выходит повторным нажатием «Редактор». Ранее обе кнопки вызывали синхронную фиксацию правок и перестройку SVG в обработчике клика, до следующего кадра. Теперь «Редактор» и «Готово» включают индикатор без процента и дают браузеру показать кадр до сохранения. Завершение запланировано через два animation frame, резервный таймер обслуживает скрытую вкладку. До фиксации правок отмена сохраняет черновик, а старый callback не завершает новый выход. При разблокировке снята промежуточная полная перерисовка, итоговый вид строится один раз. Текущая сериализация и отрисовка всё ещё занимают время.

В отдельном локальном Chromium на предоставленном EPS после удаления узла из контура с 1230 узлами первый callback кадра увидел индикатор и всё ещё открытый редактор. Кадр просмотра достигнут примерно за 46 мс в одном прогоне. Точное время зависит от устройств и макета. Синтетический Chromium покрывает повторное нажатие «Редактор», отмену, первый кадр индикатора, фиксацию узлов и обновление маркеров. Частный EPS не публикуется. Публикация ожидается.

## 0.2.0-alpha.84 · Первый зум после редактора

База 77626a1, alpha.83, Pages 44923017847. Повторное нажатие «Редактор» открывает короткую фазу сохранения. Теперь колесо, прокрученное в этой фазе, накапливается для следующего режима просмотра и воспроизводится с учётом его размеров. После фиксации кадр зума переживает фоновое обновление маркеров. Обновление только маркеров не отменяет камеру. Чтение размеров SVG перенесено перед записью viewBox, чтобы не запрашивать принудительную синхронную раскладку сразу после масштабирования.

Браузерный сценарий прокручивает колесо в обработчике повторного клика «Редактор», проверяет итоговое изменение масштаба ровно в 1,15 раза, сохранённый вектор, Undo и маркеры. На локальном пользовательском EPS проверено 12 шагов после выхода, примерно 23–40 мс до и 23–45 мс после до второго callback кадра. Многосекундная задержка на этом окружении не воспроизведена, ускорение отрисовки по этим измерениям не установлено. Проверка устраняет подтверждённые потери ввода. Частный файл в GitHub не передаётся. Публикация ожидается.

## 0.2.0-alpha.85 · Серии зума в режиме просмотра

База 6e15c23, alpha.84, Pages 44924121729. Каждая прокрутка продолжает обновлять камеру по animation frame. При серии событий перезапускается пауза 100 мс. Маркеры, числа и здоровые точки получают итоговый экранный размер одним обновлением после паузы. Во время жеста они масштабируются вместе с рисунком. Изменение режима сбрасывает таймер, устаревшие слои не обновляются. Геометрия и подложка сохраняются, поиски дефектов и геометрические операции не запускаются.

Локальный пользовательский EPS после выхода из редактора, 12 шагов: 120 записей атрибутов меток и точек на alpha.84, 0 во время серии и 10 после на alpha.85. До второго callback кадра около 21–42 мс до и 24–42 мс после. Эти замеры не показывают заметного выигрыша длительности кадра, но подтверждают исключение повторных обновлений декораций. Браузерная проверка проверяет 8 кадров камеры и ровно одно обновление кольца после. Первое фиксированное ожидание 180 мс оказалось ненадёжным, заменено ожиданием фактического восстановления размера кольца. Частный EPS не публикуется. Публикация ожидается.
