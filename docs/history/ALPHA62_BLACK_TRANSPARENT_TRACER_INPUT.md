# Alpha.62 — принудительное чёрное изображение на прозрачном фоне DoctorTracer

Дата: 2026-11-19. Исходная рабочая версия alpha.61, main 2035f00eaaa654ca1e1780997be5933e5827fd2b.

## Проблема / входящие данные
Пользователь требует окрашивать изображение в чёрный цвет на прозрачном фоне **перед** повторной трассировкой. До изменения `paintDocumentSilhouette` уже рисовал Canvas 2D чёрным, а `getImageData` передавал RGBA. Но `validateDoctorTracerRgba` контролировал только длину/альфу; RGB-пиксели на границе Worker не нормализовались, поэтому нельзя было подтвердить единый цвет для входа от разных производителей растра. Это обнаружено по исходникам; факт наличия цветных пикселей именно в пользовательском EPS не подтверждён.

Проверен реальный опубликованный DoctorTracer `gh-pages` 0.21.1: `worker.js` принимает `pixels` как ArrayBuffer и `width`/`height`; `desktop-curves.mjs` получает RGBA, формирует палитру и метки. Не переносить GPL-модули в Relief Forge и не изменять DoctorTracer без отдельного запроса.

## Реализация
- `web/doctortracer-fallback.js`: `blackTransparentRgba8(pixels)` обнуляет R,G,B **во всех пикселях** без изменения A. Это O(N) без дополнительной аллокации для типичного tightly-packed canvas-буфера.
- `rasterizeDocument`: `getContext('2d',{alpha:true,willReadFrequently:true})`, отказ при достоверно opaque Canvas; Canvas исходно рисуется чёрным `fill` и `stroke`, с `source-over` и `globalAlpha=1`; `getImageData` нормализуется перед возвратом, включая инъецируемый bitmap.
- `traceWithDoctorTracer`: повторная проверка чёрного RGB непосредственно перед передачей. Для полноценного Uint8Array transfer без копии; для `subarray` с ненулевым `byteOffset` создаётся tightly-packed copy до transfer, чтобы Worker не получил соседние байты.
- Alpha=0 остаётся фоном/дырой; 255 — полное покрытие; диапазон 1..254 неизменен ради субпиксельной точности. Нет бинаризации и белой подложки. Исходный вектор не перекрашивается.
- `web/app.js`: поле `mask:'black-transparent-rgba8'` фиксируется в диагностическом событии без сохранения пикселей.

## Регрессии
`tests/doctortracer-fallback.test.mjs`: RGB любых исходных значений → чёрный, точное сохранение alpha=0,1,63,127,128,254,255; Canvas с цветными fringe data; Worker получает only-black packed transfer из offset view; подтверждение применения той же нормализации при retry.

Сохраняются старые проверки: compound evenodd holes, EPS source immutable, high-resolution mask IoU>=0.95, area 0.95..1.05, full native/Rust diagnostic, undo, node cap 200000 и безопасный повтор 100/70/45%.

## Альтернативы и ограничения
Не стал выбирать белую подложку или alpha threshold — потеряются мелкие детали и антиалиасинг. Не изменял параметры `hard/colors:2` Worker до отдельного live сравнения на реальном EPS, чтобы не создавать непроверенную регрессию. Прозрачные RGBA-пиксели с RGB=0 не меняют видимый итог, но устраняют неоднозначность при чтении буфера.

Нет исходного файла `8101921_maket_7_121126_163426.eps`, только JSONL предыдущей сессии. CI/npm/Rust/WASM/Pages статусы должны подтверждаться отдельно; до тех пор это кандидат alpha.62. Базовый rollback: `2035f00eaaa654ca1e1780997be5933e5827fd2b`. PR #94.

