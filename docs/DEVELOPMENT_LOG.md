# Журнал разработки

## 2026-10-22 · 0.1.0-alpha.1

1. Принята задача нового проекта: Rust/WASM-аналог ArtCAM, Vector Doctor — обязательный приоритет.
2. Проверены tool inventory, локальные исполняемые файлы, GitHub-профиль и поверхности компьютера. Выявлены блокеры Windows/REA/Ghidra/Rust и отсутствие create-repository.
3. Изучены официальная справка ArtCAM 2018, официальные документы REA Windows Ghidra/CLI, Rust WASM и GitHub Pages. Исследованы кандидаты готовых Rust-библиотек, их код ещё не интегрирован.
4. Создан отдельный репозиторий локально. Другие проекты пользователя не изменялись.
5. Написано ядро полилиний с packed f64 ABI: диагностика, восемь операций/режимов исправления, явная валидация входа и лимиты.
6. Добавлены 15 регрессионных Rust-тестов и интеграционный тест реального WASM. Их выполнение заблокировано отсутствием компилятора.
7. Написан браузерный UI, Worker с отменой, строгий начальный SVG-импорт, сохранение геометрии/undo/redo/журнала в JSON.
8. 7 JS-тестов пройдены; JS-синтаксис проверен. Никакая JavaScript-имитация Rust-расчётов не добавлялась.
9. Подготовлены сборка Windows/Linux, Pages CI и локальный read-only сборщик REA/Ghidra с собственными логами и SHA256 ArtCAM.
10. Добавлены README, матрица покрытия, handoff и правила сохранения истории. Состояние фиксируется Git-коммитом и переносимым bundle в архиве.

11. Локальный HTTP smoke-test прошёл: HTML/JS доступны; отсутствие engine.wasm честно возвращает 404. YAML workflow разбирается. Полная визуальная проверка не выполнялась.
12. Создание репозитория дополнительно проверено через GitHub /new в браузере: требуется вход. Репозиторий не создан.

**Не выполнено:** компиляция Rust/WASM, запуск REA/Ghidra, чтение открытого ArtCAM, Windows-проверка скриптов, визуальный browser QA, создание удалённого репозитория и публикация.


## 2026-10-22 · 0.1.0-alpha.2 · первая WASM-сборка

- Получен запрос перенести работу в Codex и опубликовать. Codex CLI найден, но Cloud API вернул 401; отдельная облачная задача не создана.
- Сохранена Git-история и создан отдельный Sites checkout/проект; ID записан в hosting manifest. Создание GitHub-репозитория не требуется для этого маршрута.
- Восстановлена возможность сборки: официальный rustup-init проверен SHA256, Rust 1.85.1 + wasm32 target установлены изолированно.
- Пройдены 15 Rust-тестов, 7 JS-тестов и проверки реального WASM. Rust исходники отформатированы rustfmt.
- Browser smoke-test подтвердил диагностику, удаление дубликатов, очистку, соединение, выделение петель и undo/redo.
- Подготовлен static dist с обязательной проверкой наличия настоящего WASM; визуально исправлен контраст кнопки.
- Актуальное состояние размещения читать через Sites get_site по project_id; дальнейшие операции публикации сохраняются самим Sites и source workflow.
- REA/Ghidra и Windows runtime пока недоступны; эквивалентность ArtCAM не заявлена.


## 2026-10-22 · перенос на GitHub по указанию пользователя

Создан публичный репозиторий tohaa28/relief-forge. Новому репозиторию выдан доступ существующего ChatGPT Codex Connector, после чего GitHub API подтвердил запись. Переносится полный проект, журнал, готовый проверенный модуль и точная исходная Git-история. Основным источником становится GitHub; размещение выполняется GitHub Actions/Pages. Старый Sites-манифест архивирован, предыдущий Site не удалён.

Проверено завершение переноса: run 39753007526, оба job build/deploy успешны. На GitHub сохранены точные четыре прежних SHA. Живая версия https://tohaa28.github.io/relief-forge/ загружает Rust/WASM и показывает 23 ожидаемых замечания на примере. Подробный протокол — logs/github-publication.json.

## 2026-10-22 — EPS implementation checkpoint

Created feature/eps-import from f236c70. Added browser-local Ghostscript/MuPDF WASM interpretation, lossless SVG artwork/curve storage, binary EPS and physical dimensions, fonts, progress/cancel/timeout, original EPS retention, project/export integration and explicit polyline copies. 15 Rust + 12 JS + compiled Rust WASM checks pass. Browser and deployment pending. See EPS_IMPORT_CONTRACT.md and THIRD_PARTY_NOTICES.md. Windows collaborator reports ArtCAM window capture error 0x80004002; no visual parity established.

Browser QA: imported 11 EPS objects at 101.6×50.8 mm; visual curves/text/clip/colors; Rust diagnosis; save/new/reopen with original-byte equality; binary EPS file picker; malformed EPS refusal and infinite-loop cancellation preserve prior 11 objects; explicit healing copy creates 65 sampled nodes while retaining original. Local-only preview copy used; no Sites publication. Build log: logs/eps-build.txt. MuPDF npm gitHead equals upstream 1.28.1 tag (20061bd4).
