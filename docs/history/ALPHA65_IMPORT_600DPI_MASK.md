# Alpha65 — предварительное растрирование в 600 dpi на этапе загрузки

Дата: 2026-11-19. База предыдущего стабильного опубликованного состояния alpha64: `65e27e8b6f59837c4128952417428e2c138b0f39`. Ветка `feature/alpha65-import-600dpi-raster-cache`. Пользователь запросил жёсткий порядок: файл загрузить → чёрная маска с прозрачным фоном 600dpi сохранить временно → исправлять вектор → DoctorTracer только при чрезмерном остатке ошибок.

## Проблема исходной alpha64
`openValue` немедленно вызывал `calculate(0)`. 300dpi `rasterPlan(source)` и `rasterizeDocument(source)` запускались только при `retryUnfixableWithDoctorTracer` ПОСЛЕ обычной диагностики и автоисправления. Время получения растра добавлялось к длительности срабатывания fallback, и исходный растр не сохранялся заранее. Новая модель должна работать раньше, не менять исходный EPS и не отключать условия приёмки результата.

## Архитектура и управление памятью
- `web/doctortracer-prepared.js`: `PREPARED_RASTER_DPI=600`, `PREPARED_RASTER_MAX_PIXELS=36_000_000`, `PREPARED_RASTER_MAX_SIDE=9000`. Canvas может кратковременно потребовать 4 байта на пиксель, затем `rasterizeDocumentAlpha` извлекает лишь 8-bit alpha посредством `getImageData` полосами до 262144 пикселей за вызов (<=1 MiB RGBA), сохраняет `Uint8Array(width*height)`, освобождает Canvas. RGB всегда мысленно (0,0,0), потому что исходная геометрия предварительно рисуется только чёрным, а RGB для передачи строится из нулевых байтов. Реальные source colors / document semantics нетронуты.
- `createDoctorTracerMaskCache` представляет единственный временный RAM-cache c monotonically increasing generation. `invalidate()` освобождает запись при загрузке другого документа и после изменения геометрии. `get(token)` не возвращает устаревший исходник. Модель `doc` не содержит кэш, поэтому Undo/Redo, JSON/EPS export и localStorage не получают изображение.
- `openValue` готовит 600dpi BEFORE `calculate(0)`. Во время подготовки `lock(true)`, прогресс 87..98%, у Cancel свой abort/invalidates cache. После ошибки `doctortracer-mask-prepare-error` сохраняется исходный вектор, запускается штатная векторная диагностика; fallback не получает ложную stale mask.
- `preparedRasterPlan` строит bbox и physical units со старым дажеodd rule и исходной толщиной открытых линий. При слишком большой физической странице размер ограничен 36MP/9000 px; уменьшение effectiveDpi явно записывается (никаких фиктивных заявлений «600»). Например A4 приблизительно 35MP при 600dpi и укладывается; изображения больше не обязаны укладываться.
- До DoctorTracer остаётся `WORKER_RASTER_MAX_PIXELS=12_000_000`, `WORKER_RASTER_MAX_SIDE=5000`. Если cached full-resolution alpha > этого лимита, выполняется area-weighted box downsample, без повторной отрисовки вектора и без бинаризации альфы. Векторные миллиметры и нулевая точка поля не меняются. Для прежнего проблемного файла размер 600dpi около 2524×3590 (~9.06MP) может войти в Worker без уменьшения, если реальная bbox соответствует прежнему журнальному плану.
- В `retryUnfixableWithDoctorTracer` `doctorMaskCache.get(preview.doctorMaskToken)` возвращает data, созданную ДО векторной обработки. Конверсия альфы в RGB=0/alpha8 выполняется один раз при передаче, исходный буфер и эталон не передаются Worker и не могут быть detached. Прежние 100/70/45% попытки разрешены по 200000-node error.
- Приёмка candidate: `rasterizeDocumentAlpha(candidate,prepared.plan)`, `maskSimilarity` теперь принимает alpha8 и RGBA8. IoU>=0.95, areaRatio 0.95..1.05 при полном подготовленном (до 600dpi) разрешении. Далее complete fullScope Rust/native re-diagnosis и меньше ошибок. Без этого ПОСЛЕ/Undo не изменяются.
- Статусы логов только числовые: `doctortracer-mask-prepared` (source name, requested 600, effective, dimensions, bytes, cache type); `doctortracer-rgba-ready` (cacheHit, prepared and Worker dpi); при ошибке `mask-prepare-error` или `mask-cache-miss`. Никаких пикселей, EPS, приватных исходников и traced SVG в публичном журнале.

## Векторный lifecycle и edge cases
- Сначала импорт EPS через Ghostscript/MuPDF или SVG/XML parser должен построить vector geometry; только после этого можно растеризовать её. Это не «преждевременная векторная обработка», а обязательный этап чтения.
- Если документ содержит `kind:image`, подготовка не создаётся и ошибка/skip логируется; штатная векторная диагностика остаётся доступной. Canvas или browser allocation failure не уничтожают текущий документ.
- Редактирование кривой, Undo/Redo, ручные операции и последующее применение результатов сбрасывают токен кэша. Preview хранит лишь `doctorMaskToken`, не пиксельный буфер.
- Для изменённой геометрии при необходимости fallback **явно** создаёт новую временную 600dpi alpha-mask с записью cache-miss (без тихого использования старого исходника). Базовый сценарий нового файла не растрирует его второй раз.
- `doctorTracer-status` сообщает фактическое dpi и размер, черный/прозрачный характер временного изображения.

## Тестирование и ограничение вывода
- `tests/doctortracer-prepared.test.mjs` проверяет 600dpi в безопасных пределах, корректную запись фактического cap DPI, alpha-only память, token invalidation включая in-flight stale, прозрачные RGB=0 Worker, уменьшение с точным покрытием, совпадение alpha/RGBA IoU, strip Canvas alpha:true и import-before-diagnosis integration.
- Регрессии старого `tests/doctortracer-fallback.test.mjs` защищают один чёрный цвет, holes, отмену, SVG cap и strict mask check. PR CI ещё ожидается. Нельзя утверждать, что реальный пользовательский EPS с IoU=.491 получил IoU>=.95: пользователь в предыдущих циклах присылал только JSONL, не EPS bytes. Требуется новая проверка исходного документа.
- Сбой CI/тестов и применённые альтернативы записывать в FAILURE_REGISTER и DEVELOPMENT_LOG; релиз только после подтверждённых тестов и GitHub Pages SUCCESS.


## Alpha65 first CI failed, regression compatibility fixes (2026-11-19)
- Workflow https://github.com/tohaa28/relief-forge/actions/runs/44588150682 FAILED at JS: 362/367 passed, 5 failed. Rust 17/17 passed before npm tests; WASM/browser stages not completed.
- Failure 1: a legacy DoctorTracer test expected literal `rasterPlan(source)` in fallback, but import cache uses `preparedRasterPlan(source)`. Corrected test to expect the new cache contract `doctorMaskCache.get(preview.doctorMaskToken)` (e302bfcae68ea74d6f9266c323600c565dccc46d).
- Failures 2,3: `real-boolean-union` and `union-node-cleanup` static tests relied on the original literal `const pv={source:clone(doc),result:after`. Restored original property order; cache token assigned after pv creation so geometry and APIs unchanged.
- Failure 4: `unified-point-apply` VM harness extracts only preview functions and lacks global `doctorMaskCache`; direct access threw, silently nulled `curvePreview`. Now `pv.doctorMaskToken=typeof doctorMaskCache==='undefined'?null:doctorMaskCache.generation` and real application sees actual instance; mocked independent tests can work. Fix commit 31b48285f4a573d376041133e2be07cf4dcf9f3b.
- Failure 5: history-integrity required exact `0.2.0-alpha.65` in HANDOFF.md; this is now explicit (ce68a41d4eb5657fda9a53a1e8850c089b81e057).
- The CI failure is recorded; do NOT claim candidate published or green. New complete CI required after this synchronization.

