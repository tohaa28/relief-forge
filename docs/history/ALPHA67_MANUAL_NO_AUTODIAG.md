# Alpha67 — Завершение ручной правки без автоматической проверки
Дата: 2026-11-19. Исходная опубликованная alpha66 main: 2d41b4fce1436b51b392157b991b97356d0a0cec. Безопасный откат — этот SHA. Ветка feature/alpha67-manual-edit-no-automatic-diagnosis.

## Первопричина
Функция exitDeferredCurveEditor после правки запускала changed('curve-session-commit'), которая через requestRecalculation → 180 мс вызывала calculate(0), полный диагностический Rust/native pipeline и новый preview. При пустом закрытии тоже вызывался requestRecalculation. Кроме того, сброс clearanceKey запускал фоновый clearance Worker из render.

## Исправление
Ручной commit собирает только исправленные команды M/L/C/Q, сохраняет Undo checkpoint, не проверяет весь документ и не пересчитывает preview. Выход без изменений не запускает анализ. После изменённой геометрии прежние маркеры снимаются, счётчик «—», явно написано, что проверка не выполнялась. Зазоры и автоматические сканы заблокированы. Undo/Redo тоже работают без полной проверки, пока результаты stale. Новая кнопка «Проверить дефекты» выполняет только поиск дефектов; не исправляет, не запускает автоматическую оптимизацию/DoctorTracer.

## Контроль
tests/alpha67-manual-no-auto-diagnosis.test.mjs: статические ограничения вызовов, явный запрос, stale-индикация, Undo/Redo и clearance. scripts/browser-manual-node-issues.mjs: открыть SVG с дефектом, исправить его вручную, локальные Undo/Redo, Готово, проверить отсутствие busy/автоматической диагностики после 400ms; глобальный Undo также без скана; явная проверка находит прежний дефект; выход без изменений не запускает Worker.
Нужны npm test, cargo test --locked, wasm build, node scripts/check-wasm.mjs и все браузерные smoke проверки. Эти результаты фиксируются только после CI. Самый сложный пользовательский gerb2.pdf в текущей сессии недоступен, его реальные задержки не измерены.

## Статус
КАНДИДАТ. Не публиковать до зелёного CI. Полная история alpha66 сохранена. При неудаче откат на 2d41b4fce1436b51b392157b991b97356d0a0cec, не менять исходный PDF/EPS и не снижать требования tests/history-integrity.test.mjs.

## CI #44602496526 — 374/377 JavaScript, три совместимости старых тестов
- GitHub Actions https://github.com/tohaa28/relief-forge/actions/runs/44602496526 остановился на npm test (374 pass, 3 fail), до Rust/WASM/browser этапов.
- tests/compact-layout.test.mjs жёстко ожидал три кнопки. Разрешена отдельная кнопка «Проверить дефекты», старые автоматические действия не вернулись.
- tests/large-file-support.test.mjs жёстко ожидал старую сигнатуру runProgressiveDiagnostics(indices,tolerance); обновлён шаблон под необязательный {diagnosticsOnly=false}, сохраняя старые вызовы.
- tests/preview-history.test.mjs исполняет Undo/Redo в VM без нового manualReviewPending: ReferenceError. Добавлен false в изолированный контекст; геометрия и история по-прежнему проверяются, добавлен assert skipDiagnostics=false для обычного Undo.
- Факты неудачного CI сохранены. После изменения повторить полный pipeline, в особенности реальное браузерное испытание завершения ручного редактора.
