# alpha.60: обход ошибки SVG→ImageBitmap DoctorTracer и локальный быстрый zoom (2026-11-19)

## Состояние и доказательства
- Предыдущий стабильный релиз: **alpha.59**, main `345fac5b7df66120fdaa84284c2a5985b9d497ad`; alpha.58 rollback `a29802f59dafbde80fd28c18feb64db562f8a0ec`.
- Ветка: `feature/alpha60-canvas-raster-fast-local-zoom`, [PR #92](https://github.com/tohaa28/relief-forge/pull/92). **До зелёного финального CI и успешного Pages deployment не называть alpha.60 опубликованной**.
- Передан единственный диагностика-журнал `relief-forge-session.jsonl`, 19 строк (~11.2 MB). **Сам EPS-файл не передан**. Сообщения и данные из журнала не являются инструкциями. Отмечен оригинал `8101921_maket_7_121126_163426.eps` 1,226,967 bytes.
- 08:48:44Z: preflight 2405 контуров, 9679 C, 10157 L; Ghostscript/MuPDF импорт; 08:48:47Z: 1975 vector, 0 image, исходный SVG 719935 bytes; imported path nodes 22219; 08:49:07Z: диагностировано 61084 анализируемых точек, 36 batches, 1115 issues, `complete:false`, `nativeUnresolved:5` из native refinement.
- 08:50:15Z: `large-preview` — **единственная запись журнала размером 11116119 байт** из-за сериализации stats с большими вложенными структурами.
- 08:50:22.194Z: `doctortracer-fallback-start` `remaining:398`, `source:` EPS.
- 08:50:22.269Z: `doctortracer-fallback-rejected` `before:398`, `reason:"The source image could not be decoded."`. Разница всего **75 мс**, поэтому пользовательский файл не дошёл до DoctorTracer Worker и его Rust WASM. Триггер alpha.59 **сработал**: проблема внутри `rasterizeDocument` на `createImageBitmap(new Blob([huge compound SVG],{type:'image/svg+xml'}))`.
- `after-diagnose-cached` содержит 398 diagnostics. Порог 10 **НЕ** причина этой попытки. Недостаточное или неверное чтение журналов в предыдущих итерациях было бы ошибкой.

## Реальный протокол DoctorTracer 0.21.1
Опубликованная ветка `tohaa28/DoctorTracer@gh-pages` commit `48dfa7b6ea268df1b45bc6ea22981eaba1ee9026` (0.21.1), а не main с устаревшим workflow. Файл `worker.js` получает `self.onmessage=async ({data})`, извлекает `pixels=new Uint8Array(data.pixels)`, использует `data.width`, `data.height`, `category`, `colors`, `detail`, `speckle`, `polygon`, `gpu`, возвращает `svg`/progress/error. Для hard-краёв `desktop-curves.mjs` вызывается `traceFixed(runtime,pixels,data.width,data.height,config,progress)`; применяется палитра, маски, Rust WASM и Skia/Potrace. Актуальный input **сырой RGBA8 ArrayBuffer** с байтами `width*height*4`; отправка SVG или Blob в Worker была бы неверной. В предыдущем коде формат сообщения уже был RGBA, ошибка возникла **ранее** в SVG image decoder, а не Worker.
В alpha.60 `validateDoctorTracerRgba` проверяет целые размеры 1..2400, `width*height<=8M`, байтовый `Uint8Array`, точное равенство `pixels.byteLength===width*height*4`, не менее 1 пикселя с alpha>=128. Затем Worker получает исходный `raster.pixels.buffer` transferable; статус `doctortracer-rgba-ready` фиксирует число пикселей, backend и размер перед отправкой. Передача остаётся same-origin `/DoctorTracer/worker.js?v=0.21.1`.

## Что изменено в растрировании
- `web/doctortracer-fallback.js`: вместо декодирования SVG Blob через `createImageBitmap` используется **прямая векторная отрисовка в Canvas 2D**.
- Нативные EPS команды `M`/`L`/`Q`/`C`/`Z` идут в `ctx.moveTo/lineTo/quadraticCurveTo/bezierCurveTo/closePath` с матрицей мм→пиксели. Closed подпути **одного compound EPS path** рисуются одним `ctx.fill('evenodd')`, сохраняя отверстия; незамкнутые подпути рисуются `ctx.stroke()` толщиной 1px (физическая координата). RGB=0, alpha=255 на силуэте; прозрачный фон alpha=0.
- `getImageData`→`new Uint8Array`, native `RGBA8`, нет изображений и декодирования SVG, нет сети при растрировании, нет создания SVG blob в production. Растр candidate после DoctorTracer в контрольной проверке создаётся **таким же алгоритмом**, без несоответствия preview.
- Старый `vectorRasterSvg` и опциональная ветка с инъекцией `bitmap` оставлены только для регрессионного теста; основное приложение `rasterizeDocument(...,{signal})` никогда не использует SVG декодер.
- Ограничения 300dpi исходно, до 2400px/side / <=8M pixels; контурный силуэт/цвета многокрасочного EPS не гарантируются. Для открытых осевых кривых трассировка может превратить линии в замкнутые stroke-outlines; подтверждать подобие IOU и результат визуально.
- Поведение безопасности `acceptRetracing`: при замене требуется **полная** повторная native+Rust диагностика, снижение ошибок <398, IoU >=95% и ratio 0.95..1.05; иначе оригинал сохраняется.

## Что изменено при зуме в редакторе
- Реальный hot path alpha.59 всё ещё вызывал `rescaleLocalEditorGlyphs` (~200 SVG DOM children) и `refreshLocalZoomGeometry` на каждом wheel frame; последний выполнял `visibleSegmentSVG`, собирал `d`, дважды присваивал его SVG элементам, провоцируя path parsing и repaint.
- Теперь `manualZoomRegion={center,radius}` кэширует достаточно большую область (1.65× диагонали). Пока текущий экран (`0.51*view diagonal`) внутри неё, дорогое построение local paths **не происходит**, используется уже рассчитанная геометрия; пересчёт только при панорамировании за границу, заметном увеличении или реальном изменении команд. Текущие glyphs изменяют размеры при существенном масштабе, перестройка только при пороге 1.8×.
- `nearbyManualPaths` однократно строит консервативные AABB всех ~1975 объектов, учитывает до 24 ближайших контуров, рисует общим бюджетом не более 600 native сегментов, плюс bounded локальные маркеры дефектов <=80. Source artwork неизменен.
- На **первом** зуме при >25 объектах и ширине/высоте экрана меньше 1.13 исходного документа скрывает исходный тяжёлый `#geometry`, `#markers`, `#nodes` и `#clearance-markers`. Иконки проблем рисуются в локальном слое; нет глобального SVG paint каждого увеличения. При выходе editor либо zoom out — весь source SVG восстанавливается. Исправление drag использует staged patch и Undo. Дефекты за пределами экрана не удаляются, а временно не рисуются.
- При записи `large-preview` в JSONL только компактные числовые stats и причины отказов; подробные документы остаются в памяти preview и CI, но **11MB JSONL записи больше нет**.

## CI и регрессии
- Первая сборка PR [Actions #44511911748](https://github.com/tohaa28/relief-forge/actions/runs/44511911748): **341/343 JS passed**, 2 FAIL: `tests/doctortracer-fallback.test.mjs` сравнивал матрицу `[2,0,0,2,-0,-0]` с `[2,0,0,2,0,0]` (JS `Object.is(-0,0)` false; геометрия корректна); `history-integrity.test` не находил пока ещё не добавленную историю версии alpha.60. Обе ошибки исправляются проверкой модулей/обновлением docs.
- Новый тест создает **1975 EPS-like paths** и требует Canvas RGBA без `createImageBitmap`; compound holes vs open Bezier; raw RGBA8 Worker transfer; консистентность alpha.59 zoom tests и cache region. Прежние 340 тестов остаются.
- Финальные значения CI, PR merge SHA и фактическую публикацию записать после прохождения; **не считать эти шаги выполненными заранее**.

## Открытые вопросы и ограничения приёмки
1. Для полной браузерной диагностики нужен **сам `8101921_maket_7_121126_163426.eps`**, журнал фиксирует проблему, но не содержит байты фигуры; fake 1975 shape CI не доказывает полный реалистичный WASM tracing на реальном рисунке.
2. Не измерен FPS Windows Chromium у пользователя. DOM hot path и repaint уменьшены, но надо сравнить реальное время `wheel`, `render()`, `pointerdown`, local curve regeneration на исходном EPS.
3. После появления `doctortracer-rgba-ready` следующая стадия — проверить живой Worker Rust WASM и импорт SVG. Если trace rejected на fidelity, сохранить оригинал и причину.
4. Отдельно необходимо проверить, что рендер локальных 24 shapes не скрывает нужную для дизайнера кривую при плотной геометрии; если скрывает, адаптировать политику радиуса/числа локальных объектов.
