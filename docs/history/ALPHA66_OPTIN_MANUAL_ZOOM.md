# 0.2.0-alpha.66 — DoctorTracer opt-in + local zoom on one complex path

Дата: 2026-11-19. Исходный main alpha.65: `9aabfdc6c6314ea287271a0b078f2ae52e47d90b`. Ветка: `feature/alpha66-doctortracer-optin-fast-manual-zoom`. CI/Pages до проверки не подтверждены.

## Требование и конкретная первопричина
На входе alpha.65 всегда строила 600dpi чёрный alpha8 растр до проверки геометрии. Это дорогая, уже не нужная при отключённом DoctorTracer работа. Кроме того, глубокий zoom включал viewport culling только при >25 путях. Файл с одним compound вектором на 7545 командах по-прежнему отрисовывался целиком при смене viewBox. `at(e)` на каждом pointermove обращался к `getScreenCTM().inverse()` большого SVG.

## Что изменено
1. Правый блок настроек: флажок `DoctorTracer: резервная трассировка` без checked; перевод в applied state только через «Применить изменения». Включение для 11+ *подтверждённых* остатков, полного scope и неиспользованной попытки. Отключение блокирует всю цепочку Worker и preimport cache. При off импорт немедленно передаётся обычной векторной проверке; при on сохраняется прежняя последовательность 600dpi mask → diagnosis → conditional fallback. После выключения cache generation сбрасывается.
2. `heavyManualScene` (новый модуль) ограничивает проблему на **суммарных сегментах**, а не count объектов. Единственный 7545-C вектор активирует bounded `visibleSegmentSVG` (≤600 локальных сегментов). Исходный слой временно скрывается только при глубокому зуме в редакторе. Первую активацию local-layer переносим на текущий event до paint.
3. `screenToDocumentPoint` использует cached bounding rect и SVG viewBox с letterbox; за пределами локального режима остаётся прежний DOMPoint / getScreenCTM. При скролле и resize cache сбрасывается. После панорамирования glyph queries смещаются к текущему viewport, а не остаются около прошлого ручного фокуса.
4. Сохранены deferred edits, два соседних Bezé при drag, Undo/Redo, восстановление полного рисунка по «Готово», safety gates DoctorTracer 0.21.1.

## Регрессии и проверка
- Новые тесты: `tests/alpha66-doctortracer-optin-zoom.test.mjs` проверяют отключённый default, gate, отсутствие обязательной маски, one-path 7545 C, 40-path scene, letterbox и stale screen-space assumptions.
- Старые тесты: `tests/alpha55-manual-performance.test.mjs`, `alpha56-deferred-local-editor.test.mjs`, `alpha59-manual-zoom.test.mjs`, `doctortracer-prepared.test.mjs` и полный npm/Rust/WASM/Playwright CI обязательны.
- Не проверено: FPS ×8–×20 и end-to-end на **реальном** `gerb2.pdf`, защищённом EPS `8101921_maket_7_121126_163426.eps`, фактическая скорость CPU/GPU в пользовательском Windows. Исходные файлы доступны только в прежних беседах и не были смонтированы в текущем запуске.
- Если CI/браузер не проходят, не сливать PR; сохранять ветку с протоколом ошибок. Роллбек alpha.65 коммит `9aabfdc6c6314ea287271a0b078f2ae52e47d90b`.

## CI-инцидент и исправление (2026-11-19)
- Первый PR CI [44593345588](https://github.com/tohaa28/relief-forge/actions/runs/44593345588) SUCCESS: 370/370 JS, 17/17 Rust, build WASM и стандартные Playwright gates.
- После добавления нового высокоуровневого браузерного теста [44594348656](https://github.com/tohaa28/relief-forge/actions/runs/44594348656) FAILED **только** на `scripts/browser-alpha66-optin-zoom.mjs:49`, `Timeout 30000ms`: после входа в manual mode *без клика по узлу* `localEditors` оставался пуст, поэтому `scheduleManualZoomRefresh` не мог запустить `drawLocalEditorOverlay` и активировать `manual-local-zoom`. Это реальный ранее пропущенный дефект и особенно важно для пользователя, который увеличивает масштаб **до** выбора узла. Путь обычного редактирования по клику в старом stress browser проходил.
- Исправлено: `startCurveEditor` инициализирует выбранный вектор через `localEditor(primary)` при входе, выставляет `manualFocus`, создаёт локальную overlay-геометрию до первого wheel; тест увеличивает вокруг настоящего glyph/узла. Предыдущее неудачное CI сохраняется для диагностики. Повторное браузерное испытание ожидается, вывод FPS не заявлять до результата.

## Второй CI-инцидент: сохранение интерактивности простых документов
- CI [44595019558](https://github.com/tohaa28/relief-forge/actions/runs/44595019558) FAILED в **старом** `scripts/browser-manual-node-issues.mjs:48`: после безусловной инициализации localEditor на входе CSS `.local-editor-active #geometry .curve-node {display:none}` скрыл обычные точки небольшого 3-сегментного SVG; тест-клик по старой видимой точке из `#geometry` превратился в `Timeout 30000ms`. На высокосложном контуре локальные точки нужны, на простом — должна остаться прежняя разметка. Исправление: предварительно создавать localEditor и glyph overlay **только** при `heavyManualScene(doc.paths)`; в малых файлах оставлять прежний rendering/click target. Два неудачных CI сохранены в истории.
