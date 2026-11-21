## 0.2.0-alpha.69 — ОПУБЛИКОВАНА, 2026-11-20
- PR #101 https://github.com/tohaa28/relief-forge/pull/101 MERGED. Merge commit main 2e6a2e7a09a86c8b65731f40db412e70ef97c499, PR HEAD bf5c9ae3f87db8ac75d3bfd38109d6fc09599250.
- Финальный PR CI https://github.com/tohaa28/relief-forge/actions/runs/44712420243 SUCCESS: 391/391 JavaScript, 17/17 Rust, WASM release и ABI, реальные браузерные тесты EPS/ПОСЛЕ/Apply/Undo/ручной режим и специальный alpha69, синтетический стресс 1975 объектов/около 20 тысяч сегментов.
- GitHub Pages main workflow https://github.com/tohaa28/relief-forge/actions/runs/44712763739 SUCCESS: build + deploy. Публичная версия: https://tohaa28.github.io/relief-forge/?v=alpha69
- Новый модуль web/nearby-curve-merge.js объединяет соседние близкие точки с контролем нативных кривых и топологии, почти одинаковые непрозрачные самостоятельные кривые и однозначные окончания открытых незалитых линий. Не объединяет наугад соседние замкнутые заливки, различные цвета и отверстия.
- В правом блоке «Объединять близкие кривые и точки» ON, «Близость объединения, мм» default 0.05 (0.0001–1), «Защищать заливку и отверстия» ON. Настройки применяются по «Применить изменения»; ручное закрытие не запускает повторную диагностику. Работает на normal и large preview; ПОСЛЕ/Undo/EPS используют один результат.
- В исходном приложенном EPS CorelDRAW самостоятельно установлено 1975 объектов, 2405 closed paths, 19836 сегментов, 22241 anchors. ОТДЕЛЬНЫЙ Python/PostScript эксперимент при 0.05 мм удалил 603 коротких сегмента, 24 отверг по площади, EPS результат из чата Ghostscript PASS, 600dpi IoU 99.98908% / 195 отличающихся пикселей на 2525×3592. Это НЕ полный импорт этих байт в браузерный модуль, нельзя приравнивать 603 к подтверждённым исправленным проблемам приложения.
- Пользовательский исходник EPS и растры не публиковались в открытом GitHub. Детали и контрольные ограничения: docs/history/ALPHA69_PROXIMITY_EPS.md, методы M-069, неудачи F-069, logs/actions.jsonl.
- Неудачные промежуточные CI #44710159158, #44710457881, #44710516992 исправлены и описаны; старые tests не отключали.
- Проверенный откат: alpha68 main f428f8ab9f7f73195e944a460de8a3cc95e4fb9d. Новый чат начинать от main 2e6a2e7a09a86c8b65731f40db412e70ef97c499 плюс документационный commit с этим подтверждением.

## 0.2.0-alpha.69 — ПРОВЕРЕННЫЙ PR #101 (2026-11-20), Pages ещё не опубликован
- PR https://github.com/tohaa28/relief-forge/pull/101; branch feature/alpha69-proximity-curve-merge. Предыдущий подтверждённый релиз alpha68 main f428f8ab9f7f73195e944a460de8a3cc95e4fb9d; сохранить для отката.
- Функция «Объединять близкие кривые и точки» со значением «Близость объединения, мм» (по умолчанию 0.05, диапазон 0.0001–1) и опцией «Защищать заливку и отверстия» включена в обычный и большой ПОСЛЕ. Конкретное изменение геометрии выполняется после явного «Применить изменения», не в ручном редакторе.
- Способ: точная локальная сварка коротких соседних native C/Q/L, дедупликация почти одинаковых непрозрачных самостоятельных контуров и соединение только уникальных открытых неокрашенных концов. Проверяется signed area и новые native crossings; результаты неопределённой проверки отвергаются.
- CI https://github.com/tohaa28/relief-forge/actions/runs/44711546203 SUCCESS: 391/391 JS, 17/17 Rust, WASM release и ABI, все браузерные тесты, включая alpha69 реальный маленький угловой дефект, Apply и ручной Done, синтетический стресс 1975 объектов.
- РЕАЛЬНЫЙ приложенный EPS: оригинал 1975 объектов, 2405 закрытых подконтуров, 19836 сегментов; независимый Python/PS эксперимент удалил 603 коротких сегмента (24 площадь veto), Ghostscript 600dpi IoU 99.98908%, 195 отличающихся пикселей на 2525×3592; экспериментальный файл 8101921_maket_7_121126_163426_result.eps предоставлен в чате. **Это НЕ production JS**, который на исходных байтах этого EPS в браузере пока НЕ проверен. Пользовательский EPS не был выложен в открытый GitHub.
- Первые CI 44710159158, 44710457881, 44710516992 FAILED из-за синтаксиса и устаревших/ошибочных тестов; все исправлены, подробности F-069, M-069 и docs/history/ALPHA69_PROXIMITY_EPS.md, logs/actions.jsonl.
- Дождаться green CI финального HEAD и main Pages build + deploy после merge; лишь затем считать версию опубликованной.

## 0.2.0-alpha.69 — КАНДИДАТ, 2026-11-20 · объединение близких точек и кривых
- PR/branch: feature/alpha69-proximity-curve-merge. ПРЕДЫДУЩАЯ ОПУБЛИКОВАННАЯ alpha68: main f428f8ab9f7f73195e944a460de8a3cc95e4fb9d. Не сливать/публиковать до зелёных npm/Rust/WASM/real browser проверок.
- Пользователь попросил: объединять близкие кривые и точки в одну; расстояние выбирается отдельным числом в правых настройках. Реальный пользовательский EPS 8101921_maket_7_121126_163426.eps предоставлен В ЭТОМ чате (не включать исходные байты и изображение в публичный GitHub без отдельного разрешения).
- Независимый анализ CorelDRAW EPS 1 226 967 байт: 1975 объектов, 2405 подконтуров, все замкнуты, 19836 L/C сегментов и 22241 опорная точка. При 0.05 мм: 658 коротких сегментов (контрольный hull) и 573 пары ближайших точек разных объектов. Последние числа — КАНДИДАТЫ, а не подтверждённые ошибки. 448 L и 210 C коротких сегментов; 477 в одном объекте и 129 во втором — вероятно плотный нижний блок с мелкими элементами, особенно важна защита деталей.
- Новая геометрия web/nearby-curve-merge.js: точная сварка только соседних узлов с hull <= допуск, локальная проверка точных пересечений и подписанной площади, пространственный индекс нативных сегментов, ограничения по ресурсу; дедупликация практически одинаковых независимых закрытых фигур с одной непрозрачной окраской; соединение только уникальных пар открытых незалитых цепочек с согласованными касательными/оформлением. Не соединять произвольные близкие заполненные контуры: так пропадают отверстия/буквы.
- Опции панели: merge-nearby ON; merge-nearby-distance=0.05 мм (min 0.0001 max 1); merge-nearby-strict ON. Настройки staged, действуют только после «Применить изменения», и обе ветки normal/large AFTER используют одно и то же значение. Редактор узлов «Готово» не запускает авто-диагностику как в alpha67.
- Тесты: tests/nearby-curve-merge.test.mjs (сварка/заливка/EPS, tight tolerance, недопущение схлопывания мелких колец, near duplicates, selection, open chain, неоднозначные стыки и UI). Реальный EPS диагностирован из сырых PS-команд и Ghostscript; полный браузерный прогон с этим EPS пока НЕ проводился. Подробности docs/history/ALPHA69_PROXIMITY_EPS.md и M-069.
- Публиковать после полного CI + браузерного теста и обязательно записать все ошибки, включая неудачные тесты, в FAILURE_REGISTER.md и logs/actions.jsonl.

## 0.2.0-alpha.68 — ОПУБЛИКОВАНА · 2026-11-20
- PR #100 https://github.com/tohaa28/relief-forge/pull/100 объединён с main. Merge commit 83582f9e81de1edd129529a2470ff2185c5ff9b3; проверенный PR HEAD 0df07a5f880bf33ce83af301e810b2024487c6b1.
- Полный финальный PR CI https://github.com/tohaa28/relief-forge/actions/runs/44700104863 SUCCESS: 382/382 JS, 17/17 Rust, release WASM ABI, браузерные проверки импортов/Undo/ручного редактора/масштабирования + новая browser-alpha68-self-intersection.mjs. Реальный браузерный SVG fixture: правильные настройки, обнаружена ошибка, удалена петля, различие ДО/ПОСЛЕ, явное применение; скрипт PASS.
- GitHub Pages на main https://github.com/tohaa28/relief-forge/actions/runs/44700396158 SUCCESS (job build + job deploy). Адрес https://tohaa28.github.io/relief-forge/?v=alpha68
- Алгоритм: локальные native witness для двух участков Безье, сначала бережная правка управляющих C-ручек, далее удаление реальной открытой незалитой петли с точным de Casteljau и гладким кубическим мостом. Жёсткий veto на новые пересечения, незащищённое изменение площади/закрытия, взаимодействие с соседними объектами; сложные случаи пропустить. Без растеризации и потери исходника.
- Настройки справа: «Исправлять самопересечения» ON, «Способ исправления» гибридный, «Размер петель» все с проверкой, «Строго сохранять заливку» ON, применяются только кнопкой «Применить изменения». Два пути обычного/большого preview, ПОСЛЕ соответствует экспорту, Undo сохраняет ДО.
- CI 44699199391 FAILED 378/382 старых JS из-за устаревших ожиданий; CI 44699450272 также failed на промежуточной версии. Исправления тестов, документирование и новый браузерный сценарий выполнены до green #44700104863. Промежуточные CI 44699587185/44699654542 cancelled новыми коммитами. Не скрывать историю неудач.
- Сохранять исходную опубликованную alpha67 как rollback: main 2cd4afbf4db611c49ae8076d5f1bbe121e54764e. На реальном пользовательском gerb2.pdf измерение производительности и лечебный эффект НЕ проверены — исходник отсутствует.
- Полная история реализации и ограничений docs/history/ALPHA68_SELF_INTERSECTION_REPAIR.md; M-068/F-068; журнал logs/actions.jsonl. Новый чат начинать с main 83582f9e81de1edd129529a2470ff2185c5ff9b3 и последующего docs-only commit.

## M-068 · 0.2.0-alpha.68 · 2026-11-20 — верифицируемое исправление самопересечений
- Ветка feature/alpha68-self-intersection-surgery; PR https://github.com/tohaa28/relief-forge/pull/100. Предыдущий main alpha67 2cd4afbf4db611c49ae8076d5f1bbe121e54764e — точка для отката.
- Решение: точные witness по кривым Безье (segment/time), локальное изменение C-ручек с приоритетом, затем разрезание петли по де Кастельжо и касательный C-мост для открытых контуров, если геометрия проверена. Никаких полилиний вместо кривых, нет растеризации.
- Пользовательские настройки: гибридный / ручки / петли, микро / мелкие / все, обязательная строгая защита заливки по умолчанию, on/off checkbox. Применение только через кнопку, два пути расчёта (обычный/большой), финальный EPS/ДО/ПОСЛЕ/Undo использует один кандидат.
- Veto: новые пересечения, отказ ядра, изменение числа/замкнутости подконтуров, изменение площади заполненного объекта, взаимодействие с чужими контурами, предел 720 сегментов, 24 соседей — безопасно пропустить и записать статистику.
- CI https://github.com/tohaa28/relief-forge/actions/runs/44699199391 FAILED 378/382 JS: устаревшие 4 теста версий/VM/снимка. Новые 5 геометрических тестов PASS. Поправлены тесты без ослабления требований, повторная проверка ожидается. Русский журнал F-068; полный отчёт docs/history/ALPHA68_SELF_INTERSECTION_REPAIR.md.
- На реальном gerb2.pdf не проверено. В manual mode никакой автоматической диагностики после «Готово» согласно alpha67.

## 0.2.0-alpha.67 — ОПУБЛИКОВАНА, 2026-11-19
- PR #99 https://github.com/tohaa28/relief-forge/pull/99 объединён в main; merge SHA eff9b15b7551b940853db336eb249da0148dd495. Исходная опубликованная alpha66 для отката — 2d41b4fce1436b51b392157b991b97356d0a0cec.
- Финальный PR CI https://github.com/tohaa28/relief-forge/actions/runs/44603335673 SUCCESS: 377/377 JavaScript, 17/17 Rust, проверка WASM ABI, реальные браузерные тесты EPS/AFTER/Undo, 2300-C редактирование и масштабирование.
- Main GitHub Pages https://github.com/tohaa28/relief-forge/actions/runs/44603634021 SUCCESS: job build и job deploy успешны. Публичная версия https://tohaa28.github.io/relief-forge/?v=alpha67
- Новое поведение: «Готово» после ручной правки сохраняет M/L/C/Q и Undo, но не пересчитывает дефекты или зазоры; пустой выход не инициирует диагностику; старые маркеры после изменения геометрии удаляются как недостоверные, счётчик «—». Отдельная кнопка «Проверить дефекты» выполняет только проверку по запросу пользователя и не запускает автоматическую оптимизацию или DoctorTracer.
- Проверенный браузерный сценарий: после ручного закрытия 400 мс без фонового Worker, Undo без проверки, затем явный поиск корректно восстанавливает прежний разрыв, выход без изменений не инициирует проверки.
- Первый CI 44602496526 FAILED 374/377 JS (устаревшие UI/signature/VM-ожидания), исправлен и сохранён в F-067, не замалчивать. Подробности docs/history/ALPHA67_MANUAL_NO_AUTODIAG.md и M-067.
- На реальном пользовательском gerb2.pdf фактическая задержка zoom не замерялась в этом цикле, исходного файла нет в доступном окружении. Не заявлять пользовательскую приёмку.
- При новом чате исходить из source main eff9b15b7551b940853db336eb249da0148dd495 и учитывать этот поздний документационный commit. Проект: только tohaa28/relief-forge. Далее проверить производительность на пользовательском PDF и сохранить сравнительные замеры при необходимости.

## alpha.67 — ПОДТВЕРЖДЕНА СБОРКА И БРАУЗЕРНАЯ ПРОВЕРКА (2026-11-19), публикация main ожидается
- PR #99: https://github.com/tohaa28/relief-forge/pull/99; проверенная голова ветки 0ef532a13cd99c5f5e9ae77d8497f4b981023aff.
- GitHub Actions CI https://github.com/tohaa28/relief-forge/actions/runs/44602918279 SUCCESS: 377/377 JS, 17/17 Rust; Cargo wasm32 --release, реальный engine.wasm ABI, Playwright EPS/AFTER/Apply/Undo, редактор 2300 C, 40 pointermove + 7 mouseup и высокократный zoom.
- Новый браузерный сценарий PASS: после «Готово» не запускается диагностика, 400 мс без busy, старые недостоверные дефекты сняты, Undo без повторного Worker, «Проверить дефекты» явно находит восстановленный разрыв, пустой выход без фоновой проверки.
- На CI графическая проверка high zoom на синтетическом 2300-C контуре: 20 wheel событий, до 600 локальных сегментов, максимальное время одной операции 60 мс в этом прогоне. Это НЕ замер на gerb2.pdf.
- Промежуточный CI 44602496526 FAILED: 374/377 JS (старые ожидания числа кнопок, сигнатуры diagnostic API и VM-контекста Undo). Исправлено без отключения тестов и записано в F-067.
- Этап: подтверждённый PR, НЕ опубликован на GitHub Pages до зелёного workflow на main; исходная опубликованная alpha.66 и откат 2d41b4fce1436b51b392157b991b97356d0a0cec сохранены.

## 0.2.0-alpha.67 — КАНДИДАТ, 2026-11-19: ручная правка без автоматической повторной диагностики
- Пользователь потребовал: после нажатия «Готово» в редакторе кривых НЕ запускать поиск дефектов. exitDeferredCurveEditor сохраняет правки векторных M/L/C/Q с Undo checkpoint, затем изменяет документ с параметром skipDiagnostics=true. Без изменений просто выходит из режима.
- Прежние проблемные маркеры после правки очищаются как недостоверные; issue-count показывает «—», а не ложные 0 ошибок. Информация «Проверка после ручного редактирования не выполнялась» остаётся до явной проверки.
- В правой панели новая кнопка «Проверить дефекты»: calculate(0,{diagnosticsOnly:true}) выполняет только Rust/native диагностику, не запускает автооптимизацию и DoctorTracer. Undo/Redo при устаревшей диагностике также не запускают проверку.
- manualClearancePaused отключает фоновый Worker зазоров после выхода как с правками, так и без них. Очередь таймеров сброшена; suppressNextDiagnostic блокирует автоматический рестарт Rust Worker.
- База для отката: alpha.66 main 2d41b4fce1436b51b392157b991b97356d0a0cec; main GitHub Pages CI 44596504295 SUCCESS. Ветка feature/alpha67-manual-edit-no-automatic-diagnosis. Проверки и публикация alpha.67 пока ожидаются.
- Регрессии: tests/alpha67-manual-no-auto-diagnosis.test.mjs и реальный Playwright scripts/browser-manual-node-issues.mjs; 400 мс без Worker на выходе, Undo без скана, ручное обнаружение разрыва, выход без изменений. Браузерный стресс на исходном gerb2.pdf не выполнен (файл не доступен в этой сессии).
- Протокол docs/history/ALPHA67_MANUAL_NO_AUTODIAG.md, сбой F-067 и решение M-067.

## 0.2.0-alpha.65 — ОПУБЛИКОВАНА 2026-11-19
- При открытии EPS/PDF/SVG/JSON программа сначала строит black+transparent alpha raster при **целевых 600 dpi**, временно хранит alpha8 только в RAM и запускает `calculate(0)` (векторную проверку) ПОСЛЕ завершения подготовки.
- При >10 подтверждённых остаточных проблемах после автоисправления и полном scope DoctorTracer 0.21.1 получает black RGBA8, восстановленный из заранее сохранённой маски (без повторного растеризования импортированных исходных кривых). На высоком разрешении сравнивается candidate; исходник/Undo сохраняются до принятия по 200k node cap, IoU>=.95, площади .95..1.05, complete Rust+native и уменьшению ошибок.
- Cache: 1 байт alpha/px, предел 36MP/9000 px, Worker <=12MP/5000 px; фактические preparedDpi/workerDpi и cacheHit логируются. Если 600dpi превышает лимит памяти, **не заявлять 600**: записывать фактический DPI. Смена файла, ручные изменения, Undo и отмена инвалидируют stale-cache.
- PR #97 https://github.com/tohaa28/relief-forge/pull/97 merged main: `a9cbec14c5832eb5150fb6e32bfab0f8a54dc146`.
- Final PR CI https://github.com/tohaa28/relief-forge/actions/runs/44588775856 SUCCESS: **367/367 JavaScript, 17/17 Rust, WASM build/ABI, browser EPS/AFTER/Apply/Undo smoke tests**.
- Main GitHub Pages https://github.com/tohaa28/relief-forge/actions/runs/44589267391 SUCCESS: build+deploy. Public URL: https://tohaa28.github.io/relief-forge/?v=alpha65
- Baseline / rollback: previously published alpha64 main `65e27e8b6f59837c4128952417428e2c138b0f39`. Do not delete rollback.
- Interim PR CI 44588150682 FAILED 362/367 JS: legacy static/VM tests and exact HANDOFF version; subsequent 44588335827 FAILED before all fixes; 44588593552 and 44588631954 superseded/cancelled by newer commits. All failures and fixes recorded. Final run passed.
- Source EPS `8101921_maket_7_121126_163426.eps` was NOT uploaded, only earlier JSONL; actual IoU on this input remains UNVERIFIED. Next cycle: open this EPS in alpha65 and confirm `doctortracer-mask-prepared` before `diagnostics`, `cacheHit:true`, preparedDpi, IoU and residual issues.
- Details: docs/history/ALPHA65_IMPORT_600DPI_MASK.md; F-065/M-065; logs/actions.jsonl.

## Alpha65 — 600 DPI cached at import BEFORE vector work (candidate, 2026-11-19)
- Requirement: import EPS/PDF/SVG/JSON, paint black on transparent at target 600dpi and keep an in-memory temporary silhouette before diagnostics / auto-repair. If >10 residual errors after native check and whole-document scope, pass cached raster to DoctorTracer 0.21.1.
- Implemented in `web/doctortracer-prepared.js` and `web/doctortracer-fallback.js`: 600dpi Canvas2D -> read only alpha strips and keep Uint8Array (1 byte/pixel), 36MP / maxSide9000 cap. Transparent background is alpha=0, black objects are alpha=1..255; original EPS colors and Bézier source untouched.
- `web/app.js` changed import sequence: openValue -> prepareImportBlackMask (with progress, cancel, per-document generation) -> calculate(0). Worker gets materialized black RGBA from already computed high-res alpha, capped 12MP / maxSide5000; full original alpha remains for strict fidelity at prepared resolution.
- After user edits, invalidate source mask and do not use it for new preview. Cache miss is explicit in journal, with safe on-demand rebuild from current changed vectors if necessary. Source is not persisted to Git, logs, disk, history or exports.
- Actual effective resolution may be below 600 if limits exceed; record requestedDpi, effectiveDpi and workerDpi. Do not misrepresent.
- Original guards: 200k SVG node cap, retries 100/70/45%, IoU>=0.95 / areaRatio 0.95..1.05, full Rust/native diagnosis with fewer issues, source and Undo preserved.
- Baseline published alpha64 `65e27e8b6f59837c4128952417428e2c138b0f39`; feature `feature/alpha65-import-600dpi-raster-cache`; publication CI and GitHub Pages pending. This doesn't prove alpha64 failure IoU=.491 has been fixed on private user EPS.
- Unit tests: `tests/doctortracer-prepared.test.mjs` and existing `doctortracer-fallback.test.mjs`. Full log: `docs/history/ALPHA65_IMPORT_600DPI_MASK.md`, F-065/M-065, `logs/actions.jsonl`.

## 0.2.0-alpha.64 — ОПУБЛИКОВАНА · 2026-11-19
- Пользовательский журнал alpha.63 `relief-forge-session (2).jsonl` (38 событий): original EPS `8101921_maket_7_121126_163426.eps` не загружен. 1975 объектов, 398 остаточных ошибок, raster 1262×1795; one-ink DoctorTracer 0.21.1 3 попытки: 2×200000 узлов и последняя IoU=.491 / areaRatio=1.797, отказ сохранён.
- Подтверждённый в коде дефект alpha.61-63: при retry 70%/45% 1px stroke перерисовывался в другом физическом масштабе (~2.22× шире в мм на последнем разрешении). Исправление alpha64: стабильный `strokeWidthMm`, area-weighted downsample исходной независимой RGBA-маски вместо повторного рендера EPS. RGB=0, исходная alpha остаётся без порога.
- Новый журнал `doctortracer-trace-result.segmentation`: сравнение исходного alpha>=128 с alpha фактической сегментации Worker 0.21.1 ДО SVG, только IoU/areaRatio/количества пикселей, без содержимого EPS/SVG.
- PR #96 https://github.com/tohaa28/relief-forge/pull/96 MERGED, main `58498bea4bdbab54dd18dcc7b06c14ddc486bbef`.
- Final PR CI https://github.com/tohaa28/relief-forge/actions/runs/44557430633 SUCCESS: 357/357 JS, 17/17 Rust, WASM compile/ABI and browser smoke.
- Main GitHub Pages https://github.com/tohaa28/relief-forge/actions/runs/44557865477 SUCCESS (build + deploy). Public URL: https://tohaa28.github.io/relief-forge/?v=alpha64
- Previous published rollback alpha63 `2b13e06b54331d20311308d36f152036394128a7`.
- Failed initial candidate CI 44557050466 (356/357 JS, wrong Russian test regex) documented; intermediate 44557267989 cancelled due superseding push; final CI green.
- Actual IoU on private EPS cannot be claimed fixed from this JSONL alone. Need rerun same EPS in alpha64 and supply new journal/actual source for confirmation. Keep 200k-node cap, IoU>=0.95, area 0.95..1.05, complete full native/Rust diagnosis and Undo intact.
- Full analysis: docs/history/ALPHA64_STABLE_MASK_DOWNSAMPLE.md, F-064, M-064, logs/actions.jsonl.

## 0.2.0-alpha.64 — stable-alpha retries and true DoctorTracer segmentation audit (CANDIDATE 2026-11-19)
- Source journal: `relief-forge-session (2).jsonl`, 38 alpha.63 records; real `8101921_maket_7_121126_163426.eps` not attached. 1975 imported paths, 398 remaining; 1262x1795 and 883x1256 exceed 200k nodes; 567x807 fails high-res silhouette IoU=.491, area=1.797. One-ink change (alpha.63) did NOT change these figures.
- Confirmed code defect: independent 1px open strokes at every retry DPI changed physical thickness by factor ~2.22 at 45%. Preserve original full-res alpha via area-weighted box filter for downscales (using immutable `originalMask` already present) and fix mm stroke width in plan.
- New Worker segmentation stage audit compares alpha>=128 of each input RGBA with returned label RGBAs. Logs only alpha IoU, area ratio, 2 pixel counts, pixel dimensions/engine. No bitmap/SVG/input EPS persisted.
- Keep black on transparent, hard 1-ink DoctorTracer 0.21.1, 200k parser safety cap, original bbox, full resolution IoU>=95%, area 95..105%, complete Rust/native diagnosis, Undo and source immutable.
- New unit tests cover exact fractional box weights, conservation of alpha coverage, mm-scale stability, data privacy, Worker segmentation audit and retry independence. PR/CI/Pages status pending verification; never claim real EPS geometry improved until new source run.
- Baseline/rollback: published alpha.63 main `2b13e06b54331d20311308d36f152036394128a7`. Feature `feature/alpha64-stable-mask-downsampling-segmentation-audit`.
- Detailed journal: `docs/history/ALPHA64_STABLE_MASK_DOWNSAMPLE.md`, F-064, M-064; `logs/actions.jsonl`.

## 0.2.0-alpha.63 — ОПУБЛИКОВАНА 2026-11-19
- Journal alpha.62: black-transparent 1262x1795 OK; 398 residual; retries 1262x1795 and 883x1256 hit RichSVG 200000 nodes; 567x807 failed IoU .491 / area 1.797; rejected correctly, original preserved.
- DoctorTracer gh-pages 0.21.1 traceFixed treats transparency label255 as background (-1), not an ink. Alpha.63 sends `category:'hard', colors:1, palette:[[0,0,0]]`, retaining alpha and all safe gates. This is a hypothesis-driven fix; no actual user EPS bytes available.
- Per-attempt event `doctortracer-trace-result` includes attempt pixel dimensions, path count, reported paletteCount, backend. No SVG or bitmap logged.
- PR #95 merged main `ea698f7089277ffbcae1a3561f75d3869529dd10` https://github.com/tohaa28/relief-forge/pull/95
- PR CI SUCCESS https://github.com/tohaa28/relief-forge/actions/runs/44546808673 (352/352 JS, 17/17 Rust, WASM compile, generic browser smoke).
- Main Pages SUCCESS both build and deploy: https://github.com/tohaa28/relief-forge/actions/runs/44547200595
- Public URL: https://tohaa28.github.io/relief-forge/?v=alpha63
- Rollback to previously published alpha.62: `b461a5fd1df0d043e27f721c32c3f3a7c516e7cf`.
- Limitations: CI synthetic fixtures, NOT private EPS 8101921_maket_7_121126_163426.eps. Needs fresh session JSONL and/or EPS to confirm IoU improvement and complete native/Rust diagnosis.
- Full investigation: docs/history/ALPHA63_MONOCHROME_TRACER_LOG.md, F-063 / M-063, logs/actions.jsonl.

## 0.2.0-alpha.63: one-ink DoctorTracer after alpha.62 IoU rejection (CANDIDATE 2026-11-19)
- Source log `relief-forge-session (1).jsonl`: 33 events, version alpha.62, source EPS 8101921_maket_7_121126_163426.eps was NOT uploaded (only metadata log).
- Black/transparent RGBA input ready 1262x1795, DoctorTracer started 398 issues; node limit >200000 first two attempts; final 567x807 returned geometry but failed high-res mask IoU=.491, areaRatio=1.797. The refusal correctly preserved source.
- Code inspection: DoctorTracer gh-pages 0.21.1 treats label 255 as background/outside ink palette; fix from hard colors=2 (two ink clusters) to hard colors=1 with explicit palette=[[0,0,0]].
- Each trace attempt now logs only path count, reported palette count and backend; no SVG or private raster leaked. Tests for forced single palette and retry/alpha invariants.
- Acceptance remains 200k node cap, IoU>=.95, 0.95..1.05 area ratio, full native+Rust diagnosis, original source and Undo retained.
- This change is a hypothesis based on code and JSONL, NOT verified on actual EPS; no claim that the original job is cured.
- PR #95 https://github.com/tohaa28/relief-forge/pull/95 ; initial rollback published alpha.62 main b461a5fd1df0d043e27f721c32c3f3a7c516e7cf. GitHub Pages publication pending until CI and deploy succeed.
- Detailed investigation and test limitations: docs/history/ALPHA63_MONOCHROME_TRACER_LOG.md, F-063 / M-063.

## 0.2.0-alpha.62 — опубликована 2026-11-19
- Изменение: DoctorTracer 0.21.1 получает только чёрный RGB(0,0,0) при исходном alpha 0..255 (прозрачный фон, отверстия и сглаженные края сохраняются). Source EPS/PDF не перекрашен.
- PR #94 https://github.com/tohaa28/relief-forge/pull/94 merged main: 850bf1f6e284cd439ee6257a8470b5197db7de7d.
- Финальный PR CI https://github.com/tohaa28/relief-forge/actions/runs/44534174806 SUCCESS: 350/350 JS, 17/17 Rust, WASM build, generic browser smoke tests.
- Главный Pages build+deploy https://github.com/tohaa28/relief-forge/actions/runs/44534559435 SUCCESS (обе jobs).
- Public URL: https://tohaa28.github.io/relief-forge/?v=alpha62
- Откат до предыдущей опубликованной alpha.61: 2035f00eaaa654ca1e1780997be5933e5827fd2b.
- alpha.62: blackTransparentRgba8 после getImageData и перед Worker, alpha:true Canvas, packed transferable RGBA8; color/opacity User EPS source, Undo and >200k SVG retry safety gates unchanged.
- Реальный пользовательский EPS 8101921_maket_7_121126_163426.eps не был загружен; фактическая точность трассировки именно на нём и Windows zoom FPS остаются НЕ ПРОВЕРЕНЫ.
- Документация: ALPHA62_BLACK_TRANSPARENT_TRACER_INPUT.md; F-062 / M-062; журнал logs/actions.jsonl.

## 0.2.0-alpha.62 — чёрный RGBA8 с прозрачным фоном для DoctorTracer (кандидат, 2026-11-19)
- Фиксируется обязательная канонизация входного растра перед Worker: каждый RGB=(0,0,0), alpha остаётся точным 8-bit покрытием (0, 1..254, 255), без белого фона, маттинга или жёсткого порога.
- Прямой Canvas renderer по-прежнему использует исходные M/L/Q/C/Z, fill evenodd для отверстий и stroke для незамкнутых линий. Canvas создаётся с alpha:true.
- Маска нормализуется дважды: после getImageData и на границе postMessage. Для Uint8Array с byteOffset!=0 передаётся собственный packed буфер.
- Исходный EPS/PDF, исходные цвета, допуски, Undo, ретрай 100%/70%/45%, IoU и Rust+native safety gates сохранены. DoctorTracer 0.21.1 не модифицируется.
- Новые тесты: RGBA цветные пиксели с alpha=0/127/255, сохранение градиентной alpha, проверка Canvas alpha:true, Worker transfer из subarray, integration пути ретрая.
- Базовый опубликованный main alpha.61: 2035f00eaaa654ca1e1780997be5933e5827fd2b; откат на него.
- PR #94 https://github.com/tohaa28/relief-forge/pull/94 ; до успешных CI, merge и GitHub Pages не называть alpha.62 опубликованной.
- Реальный пользовательский EPS не предоставлен, точность на нём и Windows FPS не проверены.
- Подробности: docs/history/ALPHA62_BLACK_TRANSPARENT_TRACER_INPUT.md, F-062, M-062.

## 0.2.0-alpha.61 — опубликована 2026-11-19
- PR #93 merged into main: f594e38e5aeb3466dc468c29862774fc2ad69dad.
- Final PR CI 44524863713 SUCCESS: 346/346 JS, 17/17 Rust, WASM compilation and browser smoke.
- Main Pages 44525261601 SUCCESS: both build and deploy jobs completed successfully.
- Public URL: https://tohaa28.github.io/relief-forge/?v=alpha61
- Rollback to previous published alpha.60: 94cc59b1b92519642452ad2b932f1a25f0e9ebb2.
- New fallback retries original EPS raster at 100%, 70%, 45% only if DoctorTracer 0.21.1 SVG exceeds 200000-node limit.
- Original-resolution IoU>=95%, area 95..105%, complete native/Rust diagnosis and fewer residual errors remain compulsory.
- Browser smoke was generic CI, NOT the private user EPS 8101921_maket_7_121126_163426.eps;
  real-user SVG result and zoom FPS are still unverified because EPS bytes were not uploaded.
- Intermediate PR runs during version-key migration failed/cancelled (44524487570, 44524562343,
  44524626582, 44524688389, 44524752903); final synchronized version run passed.
- Full documentation: docs/history/ALPHA61_ADAPTIVE_DOCTORTRACER.md; F-061 and M-061.

## 0.2.0-alpha.61 — CANDIDATE (2026-11-19)
- Branch feature/alpha61-adaptive-doctortracer-node-budget, draft PR #93.
- Safe rollback to published alpha.60, main commit 94cc59b1b92519642452ad2b932f1a25f0e9ebb2.
- New 29-event user journal: 398 residual, Canvas RGBA 1262x1795 ready, then SVG import rejected (200000-node cap).
- New bounded DoctorTracer retry 100%/70%/45% only for the exact node-cap error.
- Required acceptance remains high-resolution IoU>=95%, area 95..105%, complete Rust+native validation and reduced issues.
- Real input EPS was NOT supplied; browser/WASM fidelity and zoom FPS not verified.
- ALPHA61_ADAPTIVE_DOCTORTRACER.md, F-061, M-061. PR CI/deployment pending.
- Do not claim alpha.61 published before green PR CI, main merge and successful Pages build+deploy.

## 0.2.0-alpha.60 — опубликованная версия (2026-11-19)
- **PR [#92](https://github.com/tohaa28/relief-forge/pull/92)** объединён с main, merge commit `9d461a5180907e532c7e4fd4607ae773418d1e4d`. **Предыдущая alpha.59** для отката: `345fac5b7df66120fdaa84284c2a5985b9d497ad`.
- Финальная CI ветки [44513193512](https://github.com/tohaa28/relief-forge/actions/runs/44513193512) **SUCCESS**, **343/343 JS**, **17/17 Rust**, WASM release build + check.
- Главный workflow после merge [44513537447](https://github.com/tohaa28/relief-forge/actions/runs/44513537447) **SUCCESS**: jobs `build` и `deploy` завершены успешно. Опубликован URL **https://tohaa28.github.io/relief-forge/?v=alpha60**.
- Корневая причина из приложенного JSONL: `8101921_maket_7_121126_163426.eps`, 1,975 EPS vectors, после лечения 398 проблем. `doctortracer-fallback-start` был, но через **75 мс** `doctortracer-fallback-rejected` с `The source image could not be decoded.`: ранний `createImageBitmap(SVG Blob)` отказал до DoctorTracer Worker. Исправление — **прямое Canvas 2D** рисование нативных `M/L/Q/C/Z` EPS→RGBA8 `Uint8Array`, `fill('evenodd')` для дыр, stroke для открытых линий. Проверка точного RGBA8 payload до передачи `ArrayBuffer` Worker DoctorTracer **0.21.1 WASM**, журнал `doctortracer-rgba-ready`.
- Оптимизация ручного редактора: кэшированный `manualZoomRegion` предотвращает пересборку SVG-геометрии на каждом `wheel`, начальное скрытие тяжёлого SVG при zoom, до 24 близких объектов/600 сегментов/80 маркеров, исходный документ и Undo неизменны. Размер записи журнала `large-preview` уменьшен (ранее до 11,116,119 байт).
- Сохранены **три неудачные** предварительные попытки CI: [44511911748](https://github.com/tohaa28/relief-forge/actions/runs/44511911748) (341/343 JS, -0 vs 0 и release docs), [44512543000](https://github.com/tohaa28/relief-forge/actions/runs/44512543000) (341/343, -0 и exact version), [44512930495](https://github.com/tohaa28/relief-forge/actions/runs/44512930495) (342/343, отсутствовал full version header в HANDOFF). Финальная сборка проверила все исправления.
- **Не проверено браузером на самом EPS**: передан только диагностический JSONL, а не байты `8101921_maket_7_121126_163426.eps`; не измерен реальный FPS и не подтверждён конец-to-конец Worker DoctorTracer WASM на этом изображении. Внешняя UI приёмка: открыть именно EPS; после 11+ residual появится `doctortracer-rgba-ready`, Worker progress; сравнить до/после, маску IoU, Undo и экспорт. Для zoom сравнить ×5–×20 на 1,975 shapes. Исходный документ не перезаписывается при отклонённой трассировке.
- Полный план/методы `docs/history/ALPHA60_CANVAS_DOCTORTRACER_PERFORMANCE.md`; провалы F-060, методы M-060, события `logs/actions.jsonl`.

## alpha.60 — Canvas RGBA / DoctorTracer 0.21.1 / zoom performance (2026-11-19)
**Новый PR #92:** https://github.com/tohaa28/relief-forge/pull/92. База alpha.59 `345fac5b7df66120fdaa84284c2a5985b9d497ad`.
**Доказательство из присланного `relief-forge-session.jsonl`:** EPS 1.226MB, 1975 paths, 1115 initial errors, 398 remaining; событие `doctortracer-fallback-start` затем через 75ms `doctortracer-fallback-rejected` `The source image could not be decoded.`. Значит триггер уже сработал; падала `createImageBitmap(SVG Blob)` **до вызова** DoctorTracer WASM.
В `web/doctortracer-fallback.js` production использует `CanvasRenderingContext2D` для нативных M/L/Q/C/Z напрямую→RGBA8 `Uint8Array`, отверстия через `evenodd`, открытые stroke; валидирует буфер 4*width*height и opaque pixels; Worker 0.21.1 получает прежний контракт `ArrayBuffer`. В `app.js` журналируется `doctortracer-rgba-ready`; исходник только после полного accept с IOU.
**Zoom**: `manualZoomRegion` кэширует ROI между wheel frames, снимает большую часть path-d reparse; скрывает исходные 1975 SVG path/markers почти сразу при зуме; локально до 24 соседних shapes / 600 segments / 80 issue markers; исходные кривые сохраняются в памяти и Undo.
**История:** `docs/history/ALPHA60_CANVAS_DOCTORTRACER_PERFORMANCE.md`, F-060/M-060, `logs/actions.jsonl`. Первый CI #44511911748: 341/343 JS; два тестовых сбоя: JS -0 vs 0 и ещё не обновлённый файл релизной истории. **Не утверждать успешный окончательный CI/деплой, пока не проверено**.

## 0.2.0-alpha.59 — подтверждены PR CI и успешная публикация GitHub Pages (2026-11-19)
- **PR [#90](https://github.com/tohaa28/relief-forge/pull/90)** объединён в `main`, merge commit `68c32504bf12afb84711763b8723447c277ab9cb`.
- Финальная проверка PR head `593f73f329c26b7af3791c151f450eaf21c7e4f4`: [Actions 44487102555](https://github.com/tohaa28/relief-forge/actions/runs/44487102555) **SUCCESS**, **340/340 JS**, **17/17 Rust**, релизная WASM-сборка + check.
- Реальный workflow основного репозитория [Actions 44487505352](https://github.com/tohaa28/relief-forge/actions/runs/44487505352) **SUCCESS**: `build` SUCCESS и `deploy` SUCCESS. Страница **https://tohaa28.github.io/relief-forge/?v=alpha59** опубликована. **Внешняя приёмка в браузере и измерение FPS на `gerb2.pdf` не подтверждены**, UI-публикация не доказывает, что 0.21.1 Worker успешно оттрассировал пользовательский PDF.
- Поведение: строго **>10 подтверждённых** оставшихся проблем даже после *частичной* проверки большого файла → DoctorTracer отдельный Worker `/DoctorTracer/worker.js?v=0.21.1` → растр импортированного вектора → новый SVG → размер в мм → принятие только если новый результат полностью диагностирован, число ошибок уменьшилось и IoU >=.95/площадь 95–105%. Ошибку/причину отсутствия запуска видно справа.
- Manual zoom: при глубоком увеличении и >1800 команд вместо полной 7k-кривой отрисовки браузер видит ≤600 native Bézier, 12px невидимый hit-контур, лёгкие glyphs in-place и coalesced requestAnimationFrame. До/Undo и оригинальные кривые не заменяются. Вне локальной области при сильном zoom временно скрыты другие объекты — это **визуальная изоляция**, не удаление.
- CI неудачи не стёрты: [44485981560](https://github.com/tohaa28/relief-forge/actions/runs/44485981560) FAILED 339/340 JS из-за несинхронизированного NEXT_CHAT_START release string; исправлено, затем [44486446090](https://github.com/tohaa28/relief-forge/actions/runs/44486446090) SUCCESS 340/340, финальный 44487102555 SUCCESS после исправления области захвата.
- Возврат к alpha.58: commit `a29802f59dafbde80fd28c18feb64db562f8a0ec` (проверенный успешный main Pages).
- Подробности: `docs/history/ALPHA59_DOCTORTRACER_ZOOM.md`; журналы `docs/history/FAILURE_REGISTER.md`, `docs/history/METHODS_AND_DECISIONS.md`, `logs/actions.jsonl`. **Следующая задача: браузерная приёмка реального сложного файла и live Worker**.

## Кандидат 0.2.0-alpha.59 — DoctorTracer 0.21.1 / ручной zoom (2026-11-19)
- **PR #90:** https://github.com/tohaa28/relief-forge/pull/90. Alpha.58 rollback main `a29802f59dafbde80fd28c18feb64db562f8a0ec`.
- Исправлен прошлый недостижимый триггер: при >=11 **подтверждённых** остаточных дефектах даже в *частичном* большом документе запускать новый векторизатор, если выбрана вся геометрия. **Приёмка нового SVG всё равно только после полной Rust+native диагностики + улучшения количества ошибок + IoU >=95%.** Все стадии/причины отказа показывать справа.
- Фактическая DoctorTracer `gh-pages` 0.21.1, commit `48dfa7b6ea268df1b45bc6ea22981eaba1ee9026`; старый main/workflow не отражает live release. Использовать independent `/DoctorTracer/worker.js?v=0.21.1`.
- Редактор: local viewport ≤600 native Безье, оригинальная тяжёлая фигура скрывается **только на глубоком zoom**; 1 rAF за кадр, маркеры обновляются in place; исходник/Undo/EPS сохраняются.
- CI первая попытка #44485981560 339/340 JS: единственный FAIL — ещё не обновлённые документы версии; исправление в этом коммите. **Не говорить, что итоговый CI/деплой завершены, пока не проверили.** Подробности в `docs/history/ALPHA59_DOCTORTRACER_ZOOM.md`.

## 0.2.0-alpha.58 — ПОДТВЕРЖДЕНО ИСХОДНИКАМИ, CI И GITHUB PAGES (2026-11-19)
- **Функциональная публикация:** [PR #89](https://github.com/tohaa28/relief-forge/pull/89) merged main `e940da99b0f91f117bbb20d7c44857ec343b04b9`.
- **Проверка финального PR head:** [GitHub Actions 44479387420](https://github.com/tohaa28/relief-forge/actions/runs/44479387420) **SUCCESS**, 336/336 JavaScript, 17/17 Rust, релизный wasm build/check.
- **Реальный main build + GitHub Pages deploy:** [GitHub Actions 44479645492](https://github.com/tohaa28/relief-forge/actions/runs/44479645492) **SUCCESS**, оба jobs build/deploy успешны. Страница: https://tohaa28.github.io/relief-forge/?v=alpha58. Независимое внешнее открытие страницы через браузер/тест реального пользовательского PDF **не подтверждены**, не выдавать публикацию за пользовательскую приёмку.
- **Алгоритм:** из импортированного original path построить 300DPI-силуэт ROI, ≤2400 px/8MP; отдельный установленный на том же origin DoctorTracer Web 0.16.0 Rust WASM Worker `/DoctorTracer/worker.js`; трассировка; возврат SVG в исходные миллиметры; проверка IoU ≥0.95, площади ±5%, полной native+Rust диагностики и строго меньшего числа остаточных дефектов. Автозапуск при **>10** только после полной диагностики ПОСЛЕ и обработки всего вектора. Ошибки/неопределённость не изменяют исходник; DO/Undo и EPS сохранены.
- **Проверенные неудачи:** CI 44478801368 335/336 JS (двойной пробел между Z и M), исправлено нормализацией, тестом compound evenodd отверстия и green 44478991540/44479387420. Пакет GPL DoctorTracer НЕ скопирован в MIT Relief Forge.
- **Rollback:** 0.2.0-alpha.57, main commit `9449e4d409ba8ec339d8fb066100d30e0ca18283`. Не публиковать пользовательский PDF.
- **Следующая приёмка:** реальный бракованный EPS/PDF с >10 подтверждёнными остаточными ошибками в браузере, Worker loaded/самое точное raster silhouette, mm bounding, контрольная печать EPS, undo и отсутствие петли при повторных настройках. В этом цикле фактический запуск DoctorTracer Worker **не проверялся браузерно** — CI использует mocked Worker и API контракты релиза.

---

## Alpha.58 — подтверждённый PR CI после защиты отверстий (2026-11-19)
- PR [#89](https://github.com/tohaa28/relief-forge/pull/89), ветка `feature/alpha58-doctortracer-fallback`, code-head `eec23540a1de7c4f6f43107590c088282030de59`.
- **GitHub Actions [44478991540](https://github.com/tohaa28/relief-forge/actions/runs/44478991540): SUCCESS** (336/336 JavaScript, 17/17 Rust, release WASM compiled and verified). Это PR build; GitHub Pages/браузерный Worker на реальном `gerb2.pdf` и пользовательский acceptance отдельно не проверены. **Не утверждать опубликованным до main deploy.**
- Предыдущий [44478509889](https://github.com/tohaa28/relief-forge/actions/runs/44478509889) SUCCESS 335 JS, 17 Rust: до добавления отдельной проверки сохранения отверстий составного контура. Сборка [44478801368](https://github.com/tohaa28/relief-forge/actions/runs/44478801368) FAILED 335/336 JS из-за **одного пробела** в тесте SVG `/Z M5 5/`, тогда как реальный результат имел `Z  M5 5` (двойной разделитель). Поведение отверстий правильное; нормализация `.map(f=>f.trim())` сделала один пробел, добавив постоянный тест, CI стал зелёным. Ошибку не скрывать/не стирать из истории.
- Метод безопасности: составные M…Z одной фигуры растрируются **единым evenodd-path**, чтобы внутренние отверстия не закрашивались, а открытые сегменты остаются одномиллиметровыми? **Нет** — имеют ширину **один пиксель растра**, не 1 мм.
- Источник для отката: main alpha.57 `9449e4d409ba8ec339d8fb066100d30e0ca18283`. Независимость DoctorTracer 0.16.0 и GPL лицензии сохранена.

## 0.2.0-alpha.58 CANDIDATE — DoctorTracer fallback (2026-11-19)
- Порог строго >10 после завершённой диагностики ПОСЛЕ. Запуск внешнего same-origin DoctorTracer Web 0.16.0 Rust WASM Worker, но не копирование GPL-кода в Relief Forge.
- Импортированный вектор → растр локально в Canvas (300 DPI, <=2400px, ROI в мм) → новая векторная трассировка → обратное преобразование в мм. Принимать кандидат только после полной повторной диагностики с уменьшением дефектов и IoU >=0.95 при стабильной площади.
- Исходник и Undo, ДО/ПОСЛЕ и EPS защищены; противопоказания: частичная проверка, отдельное выделение, raster, недостаточное совпадение, недоступный DoctorTracer, открытые осевые линии (трассировка превращает штрих в контур).
- База для отката alpha.57 `9449e4d409ba8ec339d8fb066100d30e0ca18283`. Ветка `feature/alpha58-doctortracer-fallback`. Source/tests written; **CI/browser/deployment not verified**. [Подробный журнал](history/ALPHA58_DOCTORTRACER_FALLBACK.md).

## 0.2.0-alpha.57: ПРОВЕРЕНА СБОРКА MAIN И УСПЕШНЫЙ DEPLOY (2026-11-19)
- **Исходники:** PR #88 объединён в `main` коммитом `9d211f05f22ec4bc696c5dc21f7c3a4f750d445f`, последующий docs checkpoint `ba39ca4286a364e06202f78445577cb21e0eb2f9`. Основной функциональный PR CI `44468034227` — SUCCESS: 325/325 JS, 17/17 Rust, свежий релизный WASM. 
- **Опубликовано GitHub Pages:** основной workflow [44468646086](https://github.com/tohaa28/relief-forge/actions/runs/44468646086) на head `ba39ca4286a364e06202f78445577cb21e0eb2f9` завершён **SUCCESS / build SUCCESS / deploy SUCCESS**. Адрес приложения: https://tohaa28.github.io/relief-forge/?v=alpha57. **Независимый внешний web-open не смог получить страницу**, поэтому browser-smoke из внешней сети и фактическое пользовательское открытие остаются не подтверждены; не приравнивать успешный Actions deploy к browser acceptance.
- **Функция:** правая опция «Разводить наложенные несоседние узлы», отдельный staged switch, реальное сохранение через Apply; native Bezier local-safe moves/no new intersections/unchanged on ambiguity. Никаких ручных перерасчётов при pointermove. Стандартные EPS/Undo/DO/AFTER не затронуты.
- **Неудачные циклы:** GitHub Actions 44467633646, 44467807182 (версия URL-модулей, история, устаревшая проверка after assignment) документированы в F-057. Исправление подтвердили 325 JS / 17 Rust / WASM.
- **Восстановление и следующий шаг:** baseline rollback alpha.56 `252e57e39d9ec499750db384447332744062028f`; частный `gerb2.pdf` не выгружался в GitHub. Следующая приёмка — проверить настоящие совпадающие несоседние узлы и визуальное качество на пользовательском файле в браузере, включая экспорт EPS и возврат по Undo.

## Alpha.57 — исходники объединены с main, проверки кода пройдены (2026-11-19)
- **PR #88:** https://github.com/tohaa28/relief-forge/pull/88 — merged 2026-11-19, commit `9d211f05f22ec4bc696c5dc21f7c3a4f750d445f`. Проверенная голова функциональной ветки `59ea17f4afd5aa18a04a4a8659147f26e53b4772`.
- **PR CI успешно:** https://github.com/tohaa28/relief-forge/actions/runs/44468034227 (325/325 JavaScript, 17/17 Rust, `cargo build --locked --release --target wasm32-unknown-unknown`, `node scripts/check-wasm.mjs`, сборка web-artifact). Это **не** независимый browser smoke или пользовательский тест на `gerb2.pdf`.
- **Main workflow:** https://github.com/tohaa28/relief-forge/actions/runs/44468487398 — запуск после merge; факт deploy необходимо проверить отдельно, не путать успешный PR build с публикацией сайта.
- **Неудачные CI:** https://github.com/tohaa28/relief-forge/actions/runs/44467633646 и https://github.com/tohaa28/relief-forge/actions/runs/44467807182 — устаревшие URL cache keys `alpha.56`, проверка версии в NEXT_CHAT_START и устаревшая текстовая проверка `const after=filtered.document` после добавленного этапа. Исправлено изменением всех 32 versioned imports, docs и явной проверкой нового after snapshot. Последующие jobs 44467960468 и 44467999889 отменены автоматическим concurrency из-за новых push, это не геометрические сбои.
- **Поведение:** отдельная настройка справа `Разводить наложенные несоседние узлы`, применяется после нажатия «Применить изменения». При точном совпадении несоседних опорных узлов смещается один с локальными управляющими ручками C/Q, выбирается минимальный допустимый перенос, новые пересечения veto; исходные C/Q и SVG paint остаются. Ручной editor alpha.56 не менялся.
- **Приёмка:** зелёный unit/Rust/WASM CI; прямой браузерный smoke новой сборки **не выполнялся**; `gerb2.pdf` в публичный репозиторий не выгружался и на новой версии не тестировался. Неразрешимые X-crossing и плотные/неоднозначные места пропускаются без изменения.
- **Восстановление:** исходный rollback alpha.56 `252e57e39d9ec499750db384447332744062028f`. Подробности: [ALPHA57_COINCIDENT_NODES.md](history/ALPHA57_COINCIDENT_NODES.md).

## 0.2.0-alpha.57 CANDIDATE — 2026-11-19 (не опубликовано)
- Запрос: отдельная опция справа для безопасного разведения совпадающих несоседних узлов кривой.
- PR: https://github.com/tohaa28/relief-forge/pull/88; ветка `feature/alpha57-separate-coincident-nonadjacent-nodes`. Основная контрольная alpha.56 main `252e57e39d9ec499750db384447332744062028f`.
- Код: spatial hash узлов, 16 направлений, наименьший безопасный сдвиг с переносом двух инцидентных ручек C/Q, точное сравнение локальных пересечений Bézier; риск новых/неустранённых пересечений => пропуск. Приоритет — сохранение топологии и оформления, Undo, отсутствие полного расчёта при ручном редактировании.
- Статус на момент записи: source committed / tests written; PR CI ещё не подтверждён; браузер и Pages не проверены. Требуется реальный PASS CI (Rust, JS, WASM, Chromium), затем принятие/публикация. Подробно: [ALPHA57_COINCIDENT_NODES.md](history/ALPHA57_COINCIDENT_NODES.md).

## Alpha.56: локальный редактор с транзакционным сохранением — проверено и объединено в main
- В alpha.55 pointermove уже использовал mini-patch, но pointerup копировал весь путь, пересоздавал SVG и проверял фигуру. В alpha.56 **ни pointermove, ни pointerup** не обновляют основной `doc` или `#geometry`. Все ручные изменения держатся в собственном буфере M/L/Q/C/Z и постоянном SVG-слое исправленных участков.
- Добавление/удаление/сглаживание точек, ручки и локальные Ctrl+Z/Ctrl+Y работают в транзакции; single final materialization + global Undo + full diagnosis только при «Готово», сохранении, экспорте или выходе.
- Не более 200 ближайших SVG-якорей; консервативный spatial hash Bézier control bounds для добавления точки. Начальное построение индекса, топологические изменения и финальная запись всё ещё O(N), но не происходят на каждом движении/отпускании мыши.
- **Подтверждено:** PR #86 merged в main `1e9ff2b617c7b1df57f3d4bf96ac870eba12a80d`, CI [44464521648](https://github.com/tohaa28/relief-forge/actions/runs/44464521648) SUCCESS — 318 JS, 17 Rust, fresh WASM и браузерный тест 2300 C / 40 pointermove / 7 pointerup без перестройки основной фигуры. Исходный `gerb2.pdf` отдельно не был полностью проверен в браузере. [Подробный технический журнал](history/ALPHA56_DEFERRED_LOCAL_EDITOR.md).

# Alpha.55: инкрементальный редактор узлов (кандидат)
- Нагрузочный gerb2.pdf: единственный составной вектор, 7545 C; 1 объект нельзя считать локальной единицей обработки.
- Быстрое экранное представление: <=240 ближайших SVG-якорей; per-frame patch только для до двух инцидентных C/Q/L сегментов; полная сериализация кривой один раз после pointerup; полная диагностика на выходе из редактора.
- Исходные CorelDRAW PDF/EPS, ДО, Undo, Union, CNC и экспорт не изменены. [Отчёт alpha55](history/ALPHA55_LARGE_PDF_PERFORMANCE.md).
- CI и production пока не подтверждены.

# Alpha.54 candidate — one compact settings card, button-only calculation and cursor-local node recheck
- **Implemented, CI pending:** right-side inspector grouped into one section, tooltip help for every input; draft/committed settings separated; no onchange background recalculation; local Bézier anchor/segment scan around mouse radius, global clearance worker suspended in edit mode, unobstructed X delete cursor.
- **Not certified:** full cross-window diagnosis from the local scan, third-party sample acceptance, production deploy. [Worklog](history/ALPHA54_EDITOR_SETTINGS_WORKLOG.md).

# 0.2.0-alpha.52 candidate — large EPS batch continuity (not yet published)
- Preflight warnings for complex binary DOS EPS; multi-subpath diagnostic sampling fixes old 20k-per-object overflow; processed/checked counters detect failed batches. Preserves all original native cubic commands, BEFORE import geometry, cached AFTER and EPS parity; incomplete global cross-batch verification remains honestly marked. See PR #79 and docs/history/ALPHA52_LARGE_EPS_WORKLOG.md.

# 0.2.0-alpha.47 PUBLISHED — 2026-10-27
- User-reported alpha46 file-opening stall addressed by two scoped liveness guards. Source PR [#72](https://github.com/tohaa28/relief-forge/pull/72) merged to `main` at [1c555f7](https://github.com/tohaa28/relief-forge/commit/1c555f75c4dee615d503ffe1f35ec47f6faf653b).
- Full source-head [CI40474000366](https://github.com/tohaa28/relief-forge/actions/runs/40474000366) SUCCESS (263 JavaScript, 17 Rust, compiled WASM, browser EPS/PDF/Undo/CNC). Earlier [40473671985](https://github.com/tohaa28/relief-forge/actions/runs/40473671985) SUCCESS includes real Chromium never-resolving `navigator.gpu.requestAdapter()` injection: 18 object SVG completes CPU fallback AFTER; synthetic complex 2650-node import, EPS export, Undo also complete.
- Production GitHub Pages build and deploy [40474213728](https://github.com/tohaa28/relief-forge/actions/runs/40474213728) SUCCESS; site https://tohaa28.github.io/relief-forge/?v=alpha47 .
- Import safety: real WebGPU asynchronous stage has a 4500ms deadline and honest CPU fallback; when Rust first diagnostic has more than 2500 sampled points or more than 150 objects, automatically choose progressive/cooperatively yielding preview regardless of Rust completeness. This does NOT prove a hardware-specific fix on the user's NVIDIA driver or absolute bounds on pathological synchronous Clipper geometry.
- UX: "Сведения" icon centered; no popup for manual repairs; eight actions with legacy shortcuts permanently form a second row under node tools, only when curve editor active. Settings/reticles/default ПОСЛЕ and original ДО diagnosis/ EPS invariants retained.
- Permanent incident F-047 and append-only action log preserve root cause candidates, test attempts and remaining limitations. Earlier alpha46 checkpoint `34de680` available for rollback.
## Earlier working history (retained)
# 0.2.0-alpha.46 PUBLISHED — UI curve editor menu + default AFTER, 2026-10-27
- Functional PR [#70](https://github.com/tohaa28/relief-forge/pull/70) merged to main as [bdf7ea3](https://github.com/tohaa28/relief-forge/commit/bdf7ea3a8c2d131406384e1cb822f941c3b69a51).
- Source branch PR CI [40465207030](https://github.com/tohaa28/relief-forge/actions/runs/40465207030) **SUCCESS**: 259/259 JS tests, 17/17 native Rust tests, fresh WASM and full browser EPS/PDF/Undo checks, actual node editor, eight manual repair buttons, add/delete reticle cursors, responsive toolbar at 1440/1024/820/390px, CNC filtering and mode matrix.
- Main GitHub Pages build/deploy [40465418747](https://github.com/tohaa28/relief-forge/actions/runs/40465418747) **SUCCESS**. Website: https://tohaa28.github.io/relief-forge/?v=alpha46. Live page in user browser not independently inspected; actual user gerb.eps not reprocessed this release.
- UX changes: (1) square icon-only #workspace-check at far RIGHT of nav via flex margin-left:auto, accessible label + tooltip; (2) #curve-edit renamed «Редактирование кривой», hotkey E preserved; (3) #manual-repairs all 8 actions and loop limit moved from sidebar to responsive popup details inside #curve-node-tools; shortcuts & JS actions preserved; (4) computed preview displays ПОСЛЕ by default. Crucial: on import, first raw ДО geometry and Rust issue markers remain immutable and can always be selected manually. Manual selected comparison mode persists through background recomputation; no processor or EPS semantic change; (5/6) removal and addition cursors are pixel-centered red X / teal + SVG crosshair reticles (32×32 hotspot 16,16), not font glyphs or an ambiguous minus sign.
- Explicit supersession: alpha44 defaulted to ДО per the prior requirement. This new user request overrides only the default *visible stage*, not the original import or issue preservation, which remain mandatory.
- CI first run [40465038832](https://github.com/tohaa28/relief-forge/actions/runs/40465038832) failed three preexisting static/VM tests (expected manual repairs in sidebar, always ДО and missing `comparisonSelectionExplicit` in isolated preview VM). Corrected tests to prove new UX and DO integrity; final full CI green. No geometry processor, EPS writer or GPU algorithm altered.
- Remaining: native exact cubic Boolean F-037, cross-batch missing diagnoses, real NVIDIA GPU benchmarks, customer gerb acceptance and CNC path simulation. Rollback alpha45 production checkpoint [4853b96](https://github.com/tohaa28/relief-forge/commit/4853b967b37e795ddd7d9457f139cebb20e23d8d).

## Previous history (still applicable)
# 0.2.0-alpha.45 RELEASED — exact CNC closed micro-contour filter (2026-10-26)
- Request: delete small independent closed elements with bounding width **strictly < 0.1 mm AND height strictly < 0.1 mm**, incl. inner details from compound objects. Switch default ON, width and height configurable separately. Never erase long thin engravings, open paths or exact-at-threshold forms.
- Feature [PR #68](https://github.com/tohaa28/relief-forge/pull/68) merged as [7f1e371](https://github.com/tohaa28/relief-forge/commit/7f1e371c3c67fcf9a3d2611712d44bf6ed8fea5e). Full PR [CI40325111904](https://github.com/tohaa28/relief-forge/actions/runs/40325111904) **SUCCESS** 255/255 JS, 17/17 Rust, WASM/browser tests, real EPS/PDF, 8-mode matrix/Undo. Real Chromium synthetic compound 19×19 mm outer with .04×.05 mm internal subpath confirms DO retains 2 loops, AFTER retains 1, default checkbox/removal, off retains 2, .02 width retains 2, restoring .1 width retains 1, and downloaded unpainted EPS has exactly 1 path.
- Main production [Pages CI40325275316](https://github.com/tohaa28/relief-forge/actions/runs/40325275316) **SUCCESS** build+deploy. Site https://tohaa28.github.io/relief-forge/?v=alpha45 . Live site on the user's machine and private `gerb.eps` not independently re-tested.
- `web/cnc-microfilter.js`: exact analytic derivative extrema for Q/C plus L endpoints (no raster or polygonal approximations); separates native commands at M/Z; deletes ONLY whole closed subpaths whose axis-aligned width AND height are strictly below independent settings, protected by IEEE boundary epsilon. Preserves retained segments, compound fill rule/paint and original DO. For a compound vector with unsupported or heterogeneous/masked SVG decorations: skips partial deletion instead of inventing one style; whole tiny object can safely disappear. Raster/open geometry never removed.
- Placement: after point repair -> group-scoped Union -> refit -> smoothing -> optimization and node-growth fallback, before final AFTER diagnostic. Applies to BOTH ordinary and large EPS preview. Single cached AFTER is the source of displayed result, manual Apply, RGB/outline EPS and final EPS geometry verification. Options participate in preview freshness and save checks; report includes deleted subpaths/objects/real nodes. No deletion occurs during import original DO.
- Tests: `tests/cnc-microfilter.test.mjs` covers compound internal details, cubic exact extrema vs control hull, long narrow closed slot, open lines, exact bound, customizable thresholds, color EPS and source immutability; `scripts/browser-mode-matrix.mjs` contains real user flow to physical EPS download. Stale-browser-test wait race fixed by waiting for recalculated UI results (GitHub CI40324609454 failed once).
- Previous rollback: alpha44 `dfb94dd` (production Pages40321047109). Remaining issues: exact arbitrary cubic Boolean/F-037, per-group topology of problematic source, GPU benchmark on actual GTX1080/RTX3050, and verification on private gerb source. This CNC filter does not claim to fix all unrelated intersection/clearance issues.

## Previous project history (retained in full)
# 0.2.0-alpha.45 CANDIDATE — CNC minimum closed-element filter (NOT published yet)
- User request: remove every independent CLOSED native vector subpath only if its **exact bounding-box width <0.1mm AND height <0.1mm** by default. User-configurable independent width/height thresholds; checkbox ON by default, operator can disable. Delete tiny internal details of compound paths too, retain outer figures, open engraving strokes, narrow-long details and all other source geometry.
- `web/cnc-microfilter.js`: exact analytic quadratic/cubic derivative roots + line endpoints, no sampled preview/chord approximation. Partition original native M/L/Q/C/Z subpaths; preserve each retained command verbatim. Style preserving safe reconstructions with original solid paint/fill rule; reject unsupported mixed decoration rather than silently corrupt colors. Keep filter after approved Union->Bézier smoothing->optimization and safety node budget, before AFTER diagnosis. `stats.micro` reports removed subpaths, entire objects and original nodes.
- `web/app.js`: ordinary and large-document preview both filter only RESULT/AFTER. Import ДО and first-error markers untouched. Normal Apply/EPS settings freshness reject stale filter options. `web/after-result.js` validates options for cached AFTER EPS. `web/index.html` adds enable switch, width and height inputs and CNC explanation.
- Source-owned `tests/cnc-microfilter.test.mjs`: exact cubic extrema, inner compound/hole cleanup, long thin slots, open traces, exact-threshold retention, color EPS and DO immutability. Full JS/Rust/WASM/Chromium/EPS/PDF/Undo verification pending; no private gerb processing claimed.
- Previous rollback point: alpha.44 `dfb94dd`, GitHub Pages workflow40321047109 SUCCESS. Preserve all previous history and failed attempts, never relax Union-geometry topology safety.

# 0.2.0-alpha.44 PUBLISHED — verified checkpoint (2026-10-26)

- User requirement: **ДО** must show the raw document *immediately after import* and its **original diagnosis problem rings**, irrespective of later Union/smoothing/optimization/Apply; no background task may select ПОСЛЕ without an explicit user click.
- Feature PR [#66](https://github.com/tohaa28/relief-forge/pull/66) merged at [74d1e9e](https://github.com/tohaa28/relief-forge/commit/74d1e9e489bf8db506ca9197ef266d295cf2fbe8).
- Full PR [CI 40320220363](https://github.com/tohaa28/relief-forge/actions/runs/40320220363) **SUCCESS**: 248/248 JS, 17/17 Rust, fresh WASM and actual Chromium regression. Synthetic duplicated closed SVG imported as 2 native paths with **17 original error rings**; DO retains exact original geometry, marker count and positions across DO→AFTER→DO. Browser EPS and PDF import, all 8 mode-matrix combinations, node editor, EPS export from cached AFTER, Undo/Redo and reopen tests passed.
- Main production [Pages workflow 40320407500](https://github.com/tohaa28/relief-forge/actions/runs/40320407500) **SUCCESS** build + deploy. Site https://tohaa28.github.io/relief-forge/?v=alpha44. Live user's browser and their private gerb.eps not independently re-run; avoid claiming a user-confirmed visual inspection.
- `web/import-before.js`: independent structured-clone import baseline captured when successful import becomes current. First original Rust/WASM diagnostic issues and completeness cached one time. Subsequent ordinary or large EPS preview always compares imported first snapshot to separately processed AFTER; background AFTER diagnosis no longer forcibly changes tab. New import replaces baseline, new blank document clears it. Export still uses approved AFTER snapshot exclusively.
- Failed CI attempts retained: [40319459488](https://github.com/tohaa28/relief-forge/actions/runs/40319459488) old static AFTER assertion, unsigned docs version, VM harness omitted new importedBefore stub; [40319662440](https://github.com/tohaa28/relief-forge/actions/runs/40319662440) browser-smoke wrongly assumed automatic AFTER; [40319990699](https://github.com/tohaa28/relief-forge/actions/runs/40319990699) mode-matrix wrongly compared saved AFTER to displayed DO. Tests were corrected to assert both stages and actual export parity, **not weakened**.
- Rollback: production alpha.43 is `e3e2c3a`; alpha.42 `b454bcf`. Remaining geometry limitations F-037 exact cubic crossing provenance, arbitrary analytic Bézier Boolean and hardware GPU performance remain separate and unchanged by this UI/data-integrity fix.

## Earlier working notes (historical, NOT the current release status)

# 0.2.0-alpha.43 PUBLISHED — VERIFIED CHECKPOINT 2026-10-26
- Functional PR https://github.com/tohaa28/relief-forge/pull/64 merged into main at `af4c285dd07906e16ecb62d541d7bc6e2a05ed01`.
- PR source-head CI https://github.com/tohaa28/relief-forge/actions/runs/40316932711 **SUCCESS**: 245 JS tests, 17 Rust native tests, freshly compiled WASM, genuine browser/Worker EPS and PDF import, union+holes silhouette, both color/outline EPS modes, actual AFTER export vs preview, Undo/Redo and node editing. Separate simulated WebGPU device exercises adapter request, WGSL dispatch, readback, candidate flags; NO hardware benchmark.
- main production GitHub Pages build and deployment https://github.com/tohaa28/relief-forge/actions/runs/40317131510 **SUCCESS**. URL https://tohaa28.github.io/relief-forge/?v=alpha43. No independent manual visual verification on user browser, no rerun on private source `gerb.eps`.
- Union change: `web/union-group-budget.js` refits/checks EACH group and EACH compound normalization, with local and document-wide node budgets. Rejected group preserves native source while accepted groups continue. Preserves alpha42 exact opaque copy dedup before Boolean, holes/paint, CPU f64 checks, AFTER=EPS snapshot. Can legitimately decline complex curved merges when proof/node-budget unavailable; NOT fully exact Bézier Boolean tracing.
- GPU change: `web/gpu-broadphase.js` real compute shader uses conservative f32 native Bézier control-hull AABBs to select possible overlap pairs, reads flags from GPU; CPU still does actual Clipper, post-refit, geometry diagnostics and EPS. Device failures/browser without WebGPU fall back to CPU and show status. No measured speedup claim on NVIDIA GTX 1080 / RTX 3050; GPU not used for raster tracing or final topology.
- Tests: `tests/scoped-union-gpu-alpha43.test.mjs` plus adapted async VM harness `tests/unified-point-apply.test.mjs`. Initial PR CI https://github.com/tohaa28/relief-forge/actions/runs/40316352394 FAILED two assertions: old cubic test required destructive flattened Union, old VM harness stripped `async`. Follow-up 40316568245 VM source slice still stripped `async`; corrected. Final 40316932711 passes all 245JS/17Rust/real browser gates. Do not remove fail-closed checks or weaken EPS/Undo gates.
- Remaining: exact native Bézier intersection F-037, cross-batch diagnostic gaps, exact arbitrary cubic Boolean, real WebGPU hardware runtime/throughput testing and per-user gerb verification. Version 0.2.0-alpha.42 still rollback checkpoint at commit `b454bcf` and historical successful workflow40308614388.
- The remainder of this file contains historic records, not revoked by this new entry.

# 0.2.0-alpha.43 CANDIDATE — 2026-10-26, NOT PUBLISHED
- Source branch `feature/alpha43-scoped-union-webgpu` based on published alpha.42 (`b454bcf`). Do not claim publication or CI success before evidence.
- Real WebGPU WGSL compute broadphase for native Bézier convex-hull AABB candidate pairs (high-performance adapter, conservative f32 padding). Device/readback buffers are disposed. CPU fallback for unsupported browsers, documents outside limits or device errors. GPU only filters candidate pairs; CPU f64 sampling, Clipper Union, Bézier post-refit, quality checks and EPS snapshot remain authoritative.
- Group-scoped Union acceptance: every independent group and each compound path is refitted/checked before commit. Invalid, node-inflating or over-budget groups stay original, while other approved groups and exact opaque source-copy removals remain. Overall input-node ceiling remains; no disabling topology/hole/paint guards.
- Both ordinary and large EPS preview use new GPU candidate prefilter, then Union -> smoothing -> optimization -> AFTER diagnostics -> EPS from one snapshot.
- Explicitly **not** implemented: full f64 analytic curve-curve Boolean tracing, guaranteed elimination of every unnecessary new node, full cross-batch diagnostic coverage, GPU Clipper/geometry kernel, hardware speedup proof on GTX 1080 or RTX 3050.
- Verification TODO: static/238+ JS, 17 Rust, compiled WASM, real Chromium EPS/PDF/Undo/Export parity, CPU/WebGPU candidate identical output, release Pages push and live user checks. No private `gerb.eps` committed; actual screenshot and exported file remain outside repo.
- Pre-existing alpha42 checkpoint: PR #62 merged `3dd7099`; final publication with history PR #63 `b454bcf`, Pages CI40308614388 SUCCESS. Preserve this rollback target.

# 0.2.0-alpha.42 VERIFIED PUBLISHED — 2026-10-26
Functional PR #62 merged as 3dd7099; CI40307674333 PASS 238JS/17Rust/freshWASM/all browser; main build+deploy40307945350 PASS. Pipeline Union-before-smoothing/optimization/diagnosis, source-dominant original native Bézier reuse, independent native dedup+fallback, scalable bounded verification, snapshot AFTER EPS all covered by new/existing tests. F-037 true native intersection reports, full inter-job diagnostic coverage, arbitrary exact-native Boolean cuts, GPU computing NOT yet implemented. Live public page not independently inspected; do not overclaim. Private gerb input unavailable for this round.

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

## 0.2.0-alpha.48 — candidate source, publication pending
Native L/Q/C Union preserves untouched original segments and reconstructs only necessary intersection subcurves; no generated sample-polyline output/refit. Recomputable provenance + independent finite-sample Clipper XOR/holes check; unproven group rejected independently. Scoped/global node rules admit proven required junctions only. GPU4500ms CPUfallback retained; CPU Boolean/diagnostic geometry off main thread. Native marker witnesses/node classes and optimizer anchor/topology guard. All alpha42–47 CNC/import/UI/Undo/EPS contracts retained. Kernel numerical ambiguity still protected/incomplete; not universal repair.

## 0.2.0-alpha.48 qualification
PUBLISHED PR74 mergeeb7141c, main40484635706 build+deploySUCCESS;276JS/17Rust/freshWASM/allbrowserCI. LIVE nativecuts8->12/proof4/bothEPS/Undo andnativeclearancePASS; actualgerb9668anchors,29issuesPARTIAL/2protectedgroups, bothEPS=AFTER/reimport. Actual804240nodes0complete, min1941nodes0partial, suppliedPDF/Undo/localmodechecksPASS. UserhardwareGPUbenchmark/CNCsimulation/allremaininggerbfixes not claimed.

## 0.2.0-alpha.49 candidate
Startup report usesactualrequested/runtimeversion, distinguishespendingvsfailure anddismissesafterlateready. PageinitializationdoesnotfetchPaper; kernelpreparedonlyforgeometry,20sloaddeadline,Cancel/sourcepreserved. EPSdownloadsGS/MuPDFinparallel, reportsdecodedreceivedbytesusingexpectedbuildsizesratherthancompressedContentLength,45sidleabort,120sappidleprogressguard, cachedenginewarmreuse, noextraMuPDFbinaryfetch. Actualbrowserfault/realpaintedEPSgatePASS;8newunitcasesPASS,finalfullCIpending. No claim offixeduserbandwidth,instantfirstdownloador29gerbgeometryrepairs.

## 0.2.0-alpha.50 candidate — 2026-10-27T12:10:13.741Z
Base main3732bfe1b50eb098dc1ad4ebf34ae4a864f4a5c1, alpha49 PR76 published: CI40498160209 and main40498713198 build/deploy SUCCESS. Live gerb11493->9668,29 remaining protected diagnostics; both EPS identical geometry/paint to alpha48.
Live alpha49 startup regression exposed Cancel/new import before restarted Rust ready: old suppressNextDiagnostic flag suppressed NEW document preview. Clear suppression on explicit changed(action), reset readiness/header on spawnWorker, version worker URL. No geometry/paint/Undo/export algorithm changes. Deterministic browser holds restarted Rust, imports new SVG, releases Rust and requires automatic preview3->2. Positive PASS; removing suppression reset alone fails at30s with document parsed but no preview.
Harness attempts preserved: initial LF/CRLF replacement missed and query-only route missed bare worker URL, so first negative unexpectedly passed without exercising race. Corrected wildcard and explicit blocked precondition; immediate unroute raced pending route.continue (already handled), corrected with continuation acknowledgment. Final negative FAIL is expected evidence; good app restored. Full qualification and publication pending.

# 0.2.0-alpha.50 PUBLISHED — 2026-10-27T12:15:37.441Z
Functional PR77 https://github.com/tohaa28/relief-forge/pull/77 source8a719cb5f25e6a864af46256e7f74f28b2f269fc merged main658076ae069dd1908bad707e3270c77c39175205. PR CI https://github.com/tohaa28/relief-forge/actions/runs/40501808309 SUCCESS284JS/17Rust/freshWASM/all browser gates. Main https://github.com/tohaa28/relief-forge/actions/runs/40502001288 build AND deploy SUCCESS. Site https://tohaa28.github.io/relief-forge/?v=alpha50 .
Alpha49 startup/download changes retained: current-version live watchdog; UI not blocked by optional Paper; Ghostscript/MuPDF parallel real byte progress,45sno-data error, warm reuse and one MuPDFWASM fetch. Alpha50 fixes Cancel->new import while Rust restarting, clears old cancellation suppression and resets actual ready indicator, versioned worker URL. Deterministic positive PASS; removing reset reproduces no-preview30snegative. Local eight-mode/PDF/nativeUnion/clearance/EPS/Undo/DO9markers/full+/-/hungGPUfallback PASS. Geometry algorithms unchanged. Live50 post-deploy verification running; do not confuse first test on old49 during deploying with alpha50 failure.
Existing gerb29diagnostics/two protected Boolean groups remain; never loosen provenance2e-8mm or flatten curves to clear counters. GPU hardware acceleration speedup not proven. All alpha42–48 guards, Union first, native necessary cuts, exact AFTER=EPS, immutable importDO, CNC default.1x.1mm, manual toolbar and Undo retained. Next: complete live50 check and remaining native topology work F048, preserve original geometry. Shared chat URL inaccessible previously; no claim its text read.


# alpha50 LIVE VERIFIED — 2026-10-27T12:16:23.967Z
After main40502001288 build/deploy SUCCESS, production startup gate PASS: delayed native bundle does not block UI; Cancel then new import while Rust held correctly resumes3->2; current version watchdog/late ready; actual EPS parallel engines, one MuPDF fetch, warm repeat and HTTP error preserve prior vectors. Actual private gerb live import+processing14817ms (network included, not isolated CPU benchmark),11493->9668 anchors;1729before->29after diagnostics,26accepted/2protected groups. Project paths incl commands/paint deepEqual alpha49. Actual both downloaded EPS report exportGeometry matching-after9668, diagnostics explicitly partial (verified:false),29remaining; no claim all problems fixed. Private artifacts remain ignored.
PR77 https://github.com/tohaa28/relief-forge/pull/77 merged658076ae069dd1908bad707e3270c77c39175205; PR40501808309 and main40502001288 SUCCESS284JS/17Rust/freshWASM/browser suite. Remaining native topology work F048; current loading/cancellation fix complete.


## 0.2.0-alpha.51 candidate — 2026-11-11T08:11:51.589Z
Base main b2f811613f9685d1c379480d9e03b528fc1d76e7, alpha50 Pages build/deploy40502471017 SUCCESS. User reports Doctor highlights close points ArtCAM does not. Exact user case and ArtCAM settings unavailable; no claim of ArtCAM parity.
Reproduced old native pass treating any nonadjacent anchors within repair tolerance as coincident, including separate subpaths and two ends of a dense local run. Renderer also removed all healthy anchors within tolerance of each marker. Synthetic baseline: three coincident/two short; candidate: zero coincident/two short. For different subpaths nonzero gaps belong to native curve clearance; true coordinate equality (8 machine eps scaled by coordinate magnitude, capped 1e-8 mm and actual tolerance) still counts as coincident. Different branches of same subpath within tolerance get near_node, with unrounded Euclidean distance and two exact native witnesses; a short local arc certified by the Bézier control polygon length upper bound, including reverse seam distance, is not a branch pair. Adjacent anchors use existing short classification; actual short spans and native contacts unchanged. Spatial grid and 2M pair/10k marker budgets preserved. No changes to repairs, export geometry, curve clearance or threshold defaults. If native worker fails, DO hides unwitnessed sampled Rust point markers and remains explicitly incomplete.
Renderer only substitutes the named owner+coordinates for point witnesses; both anchors marked, precise distance displayed in marker tooltip/list, unrelated healthy anchors retained. Current geometry and repair safeguards preserved. Synthetic boundary tested within ~1e-9 mm on either side; exact threshold inclusive; translated Q/C witness. Previous module direct comparison on private gerb source 612 coincident -> 552 exact/17 near; after14 ->1 exact/9 near; other native counts unchanged. Native after 130/128ms single sample, not a performance claim. Private files not committed.
First edit script missed marker import token due to named import order and stopped; corrected explicitly. First browser fixture lost one intentionally tested anchor to correct collinear optimization on AFTER, so it was invalid as a persistent-witness case. Replaced with non-collinear anchor and unequal-length parallel paths to isolate node class from legacy duplicate diagnostics. Browser passes DO/AFTER, measured .006mm and both dots. Unit4/4 targeted, broad CI/publication pending.

# 0.2.0-alpha.51 PUBLISHED AND LIVE VERIFIED — 2026-11-11T08:16:39.016Z
Functional PR https://github.com/tohaa28/relief-forge/pull/78 merged 5c8169a50e319caf92df8170953c8ee4ebef7aa5 (source81a804e). PR CI https://github.com/tohaa28/relief-forge/actions/runs/42985250210 SUCCESS 288JS/17Rust/freshWASM/Chromium suite. Main https://github.com/tohaa28/relief-forge/actions/runs/42985447239 build + deploy SUCCESS. Site https://tohaa28.github.io/relief-forge/?v=alpha51 . Post-deploy Chromium PASS: one 0.006 mm native branch pair on both original anchors in DO and AFTER; parallel contours no coincident point flags.
F-051: true coordinate coincidence separated from near_node; unrelated subpaths rely on pink clearance, densely spaced local runs excluded by control-polygon upper bound. Witness coordinates and distance are double precision in mm, display five significant digits. Near-node marker substitutes only the two actual owner+coordinate anchors. Other diagnostics and repair/export geometry unchanged. Local original gerb project snapshot (not a new EPS import): source1686/after25 vs alpha50 source1729/after29, same 11493->9668 anchors and exact paths/paint, both downloaded EPS matching-after9668. 25 remaining include9near/1coincident and unchanged crossings/overlaps; two Boolean groups still protected. ArtCAM parity and user's exact discrepancy not verified.
Next: if user still sees discrepancy, obtain same file/marked location and ArtCAM settings; do not widen eps, change curve geometry or remove legitimate diagnostics to force count parity. Preserve alpha50 parallel engine download/cancellation fixes, native provenance, exact AFTER exports and Undo. Base rollback b2f8116.


## 0.2.0-alpha.70 — кандидат к выпуску, 2026-11-20

- База опубликованной alpha.69: main 934a99a94cb8e9b7603ed4e16a594742af1493f0, Pages #44713201875. Откат выпуска к этому коммиту.
- Состав: бюджеты ремонта, нативные параметры прямых, локальный ремонт ручками и обрезка, разделение микропетли, разведение близких узлов, сварка настоящих концов, фильтр геометрически замкнутых микроэлементов, проверенные пары Union. Приватный EPS в локальном Chrome: 355 → 321 остаточных замечаний, короткие 12 → 0. Межблочная диагностика остаётся неполной. Отчёт узких зазоров не запускает ремонт.
- Код и версия подготовлены в release/alpha70-repair. Для публикации требуется подтверждение сборки и Pages. Подробные этапы и методы в DEVELOPMENT_LOG.md.

## 0.2.0-alpha.70 — опубликована и проверена, 2026-11-20

- [PR #102](https://github.com/tohaa28/relief-forge/pull/102), merge 9b75794bf1f0ead0dfc998de2f74a4c92948347e. [Проверки PR](https://github.com/tohaa28/relief-forge/actions/runs/44736454615) PASS. [Pages build + deploy](https://github.com/tohaa28/relief-forge/actions/runs/44736860504) PASS.
- [Публичная alpha.70](https://tohaa28.github.io/relief-forge/?v=alpha70) проверена после deploy в реальном Chrome. Видна версия 0.2.0-alpha.70, WASM загружается, при включении разведения и Apply близкая пара исчезает только в ПОСЛЕ. Пользовательский EPS проверен на локальной сборке, 355 → 321, 12 → 0 коротких; межблочная диагностика неполная.
- Откат выпуска к проверенной alpha.69: git revert -m 1 9b75794bf1f0ead0dfc998de2f74a4c92948347e или восстановить публикацию из 934a99a94cb8e9b7603ed4e16a594742af1493f0. Исходные пользовательские файлы не публиковались. Незавершённые эксперименты Union в отдельной ветке, не часть alpha.70.

## 0.2.0-alpha.72 — порядок ПОСЛЕ (2026-11-20)

| Возможность | Реализация / проверка |
|---|---|
| Оригинал ДО сохраняется до Apply, доступен через Undo | implemented, synthetic Chromium normal/large PASS |
| Union и compound независимых совместимых частей до диагностики | implemented, JS native commands/holes + Chromium filled/151 objects PASS |
| Отдельные preparedDoc/preparedIssues | implemented; реальный Worker/WASM, исходные индексы не подменяются |
| Полная контурная подложка ДО после удаления/слияния частей | implemented, Chromium 3 originals / microfilter / Apply PASS |
| Cancel/retry при прерванной загрузке kernel | Chromium startup regression PASS |
| Пользовательский EPS / полная межблочная проверка | не подтверждено; ограничения сохраняются |
| GitHub PR/main deploy | ожидается; последующие записи уточняют фактический статус |

### Alpha.72 — подтверждение выпуска

PR #104 merged main 147298ad35821bdd2ee4b5b4f52f0875845c6365. PR CI 44786123198 и main Pages 44786577224 SUCCESS (build+deploy). 416 JS/17 Rust/WASM/14 browser gates; публичный Chromium alpha72 normal/filled/151-object, prepared defects, full original underlay, Apply/Undo PASS. Пользовательский EPS не проверялся. Подробные ссылки и дальнейшая проверка в NEXT_CHAT_START.md.

## 0.2.0-alpha.73 — кандидат

| Изменение | Проверка |
|---|---|
| RAF-coalesced manual zoom без full source DOM rebuild | implemented; real Chromium 20k C / CPU4 / 60 burst events, одна запись viewBox |
| Nearest-K hull cache / SVG strings / локальная инвалидация | unit source immutability, nearest subset, cache reuse, move and Undo PASS |
| World-space bounds соседей с C/Q handles | unit shifted-arch PASS |
| Bézier smoothing translated objects | reproduced FAIL then PASS; native world anchors preserved |
| UI smoothing + Apply/EPS/Undo/Redo + large 151 joins | Chromium PASS |
| Пользовательский файл/GPU | не проверено, исходник не предоставлен |
| PR CI / Pages | ожидаются, последующие записи уточняют |

### Alpha.73 — подтверждённый выпуск

PR105 source main5d61b690aa9f54b97e30e26c5b72b2307d87f90d; PR CI44798543441 SUCCESS; main CI/Pages44799058271 SUCCESS build+deploy. 420JS/17Rust/WASM/15Chromium PASS. Public app.js zoom benchmark и uninstrumented UI smoothing/translated JSON/EPS/Undo/151joins PASS. Реальный пользовательский EPS/GPU не проверялся. Полные ссылки: NEXT_CHAT_START.md.

## 0.2.0-alpha.74 — скругление острых углов (кандидат, 2026-11-20)

Запрос пользователя: «сглаживание Безье должно работать иначе. оно должно сглаживать острые углы». База main 19da7d2328ac8d32656cee5bf63dd1bae0e2a01f (опубликованная alpha.73); ветка feature/alpha74-sharp-corner-smoothing. Новый модуль web/corner-rounding.js вызывается в native-worker последним этапом после nearby merge в обычном и большом preview. DO неизменен; Apply/Undo/EPS используют AFTER.

Причина подтверждена: прежний smoothSegments исключал стыки dot<.90 и линии. Новый roundBezierCorners подрезает точные L/Q/C интервалы de Casteljau и вставляет реальные кубические C с согласованными касательными; обрабатывает шов замкнутого контура. Оптимизатор продолжает защищать углы; это правило отменено пользователем только для инструмента сглаживания. 0 = отключено. Скругление намеренно добавляет узлы, независимо от прежнего общего запрета необоснованного node-growth; тот запрет не ослаблен, отдельный этап имеет лимит 4000 углов и доказательство локального отклонения. Сильнее допуск — больше скругление.

Бюджеты: прежнее мягкое сглаживание получает .3 заданного допуска, окончательное скругление .7. Каждая удаляемая часть и все управляющие точки дуги лежат в шаре .45 от выделенного допуска вокруг старой вершины; выпуклая оболочка ограничивает симметричное отклонение .9 выделенного допуска. Вне шара точные подинтервалы исходных Безье. Общая сумма < заданного допуска сглаживания; отдельная оптимизация имеет собственный допуск. Угол поворота >25.84° (dot<.90), точные развороты 180° пропускаются. Открытые концы, число/замыкание частей, знак площади колец и новые пересечения проверяются. Неоднозначная топология/исчерпание строгого intersection budget → полный откат скругления с причиной, а не неподтверждённая геометрия. paint сохраняется, устаревший nativeUnionProof удаляется после изменения геометрии.

Проверки: шесть новых unit-сценариев PASS (L-L/G1, closed seam, off/limit, масштаб допуска, Q-Q+offset+paint, новая помеха→rollback). Новый uninstrumented Chromium gate PASS: staged/off, реальная C, свободные концы, EPS==AFTER, Undo/Redo, 151 острый угол в большом маршруте. Первое npm test: 422/426, четыре устаревших static/VM ожидания; VM вызов Worker при 0 устранён, assertions обновлены для финального rounded.document и .3 бюджета. Второй npm:424/426, ещё два regex исправлены; итог426/426 PASS до version bump. Первое полное browser выполнение остановилось на covered-retrace: ожидало7→4, получило7→9 из-за четырёх новых скруглений и явного замыкания. Тест изолирован smoothing0 через реальный Apply, геометрические проверки и EPS assertions сохранены. Полный финальный Rust/WASM/browser после bump ещё выполняется. Пользовательский EPS не предоставлен, только синтетические fixtures; GitHub PR/CI/Pages пока не выполнены. Публикация не заявлена.

## 0.2.0-alpha.74 — ОПУБЛИКОВАНО, 2026-11-20

- Пользователь уточнил: сглаживание Безье должно скруглять острые углы. Выполнено: реальные кубические C на стыках L/Q/C и замыкающем шве, точная подрезка исходных кривых, согласованные касательные. Выполняется последним этапом после nearby cleanup в Worker, одинаково для обычного и большого маршрута. Значение мм ограничивает изменение формы; 0 отключает, увеличение усиливает скругление. Новые узлы допустимы и явно учитываются. DO/контурная подложка неизменны, AFTER=Apply=EPS, Undo/Redo проверены.
- PR [#106](https://github.com/tohaa28/relief-forge/pull/106) MERGED. Source checkpoint `3ecd98f8e852aba91408438bed01a0fe03bf6734`; main merge `9aea7f230bf53cc25c1750523d5cabf8a5cda660`. PR CI [44803240956](https://github.com/tohaa28/relief-forge/actions/runs/44803240956) SUCCESS; main build+Pages [44803806793](https://github.com/tohaa28/relief-forge/actions/runs/44803806793) SUCCESS.
- 426/426 JS,17/17 Rust, fresh locked WASM/ABI, полный16 Chromium gates PASS. Публичная [alpha74](https://tohaa28.github.io/relief-forge/?v=alpha74) отдельно проверена uninstrumented Chromium: sharp corner→real C, staged/off, свободные концы, EPS exact, Undo/Redo и151 угол большого маршрута PASS. Проверка alpha73 zoom20k C/CPU4 сохранила одну viewBox запись/60 wheel и5.6ms burst. Это синтетические fixtures, пользовательский EPS и устройство не предоставлены, user-confirmed пока нет.
- Архитектура/попытки/FAIL→PASS: [ALPHA74_SHARP_CORNER_SMOOTHING.md](docs/history/ALPHA74_SHARP_CORNER_SMOOTHING.md), F-072/M-072. Общий запрет node-growth и оптимизатор углов не ослаблены; разрешён отдельный доказуемо ограниченный corner stage. При новых пересечениях/неопределённости строгой topology проверки этап откатывается. Почти180° развороты, неподдерживаемые masks/filter и лимит4000 углов защищаются. Детальный алгоритм и бюджеты см. историю.
- Непроизводственные сбои публикации: первая gh merge с сокращённым SHA отклонена GraphQL до изменения Git; повтор с полным40-character SHA успешен. Один gh run list получил EOF, повтор успешен. Незавершённых действий/локальных изменений кода нет; открытая сторонняя PR#103 не затронута. Следующий шаг: получить оценку скругления на реальном пользовательском макете.

## 0.2.0-alpha.75 — кандидат: быстрый зум просмотра и настройки по умолчанию, 2026-11-21

Пользователь: сначала опубликовать список изменений на GitHub, затем применить ускорение зума редактора к просмотру. Дополнительно: кнопка настроек по умолчанию; сглаживание Безье0, остальные значения на усмотрение разработчика.

Сначала опубликован отдельный документационный checkpoint `0a79676` (без изменения runtime): docs/history/CHANGES_ALPHA72_ALPHA74.md, список alpha72–74, PR104–106, геометрические инварианты, измерения и проверки. Первая git push зависла в remote-https, остановлен только этот сетевой дочерний процесс и повторена отправка конкретного коммита, удалённый main успешно обновлён. База runtime-ветки feature/alpha75-view-zoom — 0a79676; ранее опубликованная alpha74/Pages44803806793 SUCCESS. Чужие PR103/91/82/16/14 не менялись.

Подтверждённая причина: viewer zoom вызывал render() на каждом wheel; тот заново строил весь SVG/подложку, список объектов, маркеры и clearance key. at() запрашивал getScreenCTM().inverse(), принуждая синхронную геометрию SVG. Измерение baseline на исходном app из git0a79676, Chromium CPU4×,60 событий с движущимся курсором: один compound20kC24935.1ms,1975 объектов с полной подложкой22412.2ms, ДО19957.1ms, ОБЪЕДИНЕНО18593.6ms;60 render и60 viewBox на каждый burst,237120 childList/d mutations для many-after. Это искусственная серия событий и CPU throttle, не измерение FPS/пользовательского GPU.

Принято: viewer накапливает viewPendingBox по всем событиям в double precision, один RAF выставляет viewBox. screenToDocumentPoint с кешем rect и SVG meet letterboxing учитывает виртуальную камеру каждого wheel; at() использует ту же чистую математику. Исходный SVG сохраняется полностью смонтированным: не обрезаем заливки/holes/изображения/подложку как editor local-layer. Кеш web/view-zoom.js хранит только экранные декорации; их радиусы/текст и bounded healthy anchors масштабируются без чтения команд/пересоздания вектора, clearance radius имеет физический floor и7px минимум. Полный render остаётся для изменения документа/стадии/диагностики, а wheel/zoom buttons/Fit/resize камеры его не запускают. Pending camera отменяется перед новым pointerdown, Fit, focusIssue и full render; scroll/resize/ResizeObserver инвалидируют screen rect. Режим редактора сохраняет собственный RAF и кеш сегментов.

Измерение после:20kC5.9ms,1975+подложка2.7ms,ДО2.4ms,ОБЪЕДИНЕНО2.6ms/60events; один viewBox,0render,0geometry mutations, DOM identity и sidebar identity сохранены. Camera error0 против последовательной математической камеры, ring radius7px, модель/история/issues/выделение не изменились. Это время обработчиков, не FPS; browser paint большого SVG всё ещё зависит от устройства.

Кнопка «По умолчанию»: единый источник HTML defaultValue/defaultChecked/defaultSelected, сброс всех18 параметров и optimization-range; документ не изменяет и расчёт не запускает до существующего «Применить изменения». Даже без открытого файла позволяет сбросить форму. Initial/reset smoothing0. Остальные прежние значения сохранены: tolerance.01mm,clearance.1mm,optimization.02mm,selection-onlytrue,merge-overlaps/separate/repair-self/merge-nearby/remove-microtrue,nearby.05mm stricttrue,selfhybrid/all/preservetrue,micro.1×.1mm,DoctorTraceroff. Это прежняя политика ремонта с отдельным отключением намеренного скругления; не меняет скрыто весь набор операций. При повторном сбросе действующих defaults нет новой работы. Настройки не имеют отдельной localStorage-персистенции; перезапуск берёт те же HTML defaults.

Попытки/ошибки harness: первый baseline остановился на1e-7 сравнении SVG animated baseVal (float32), накопленная погрешность7.12e-7; baseline стал сохранять отклонение без скрытия, новый gate сравнивает serialized viewBox double и требует1e-7. Одновременный запуск before/after на одном порту8107 дал EADDRINUSE; добавлен отдельный ALPHA75_PORT, исходный прогон не отменён/не выдан за успешный. Первая npm424/426: ожидаемое увеличение числа кнопок4→5 и render caption source-assert; кнопочный тест обновлён, caption sync сохранён первым в render. Новый unit healthy ошибочно ожидал M в центре окружности, хотя circlePath начинает в x−r; тест проверяет восстановленный центр x+r и неизменность точек. Проверки не ослаблены для геометрии. При default smoothing0 первый Apply у чистого L-L fixture не нужен и может быть disabled; dedicated corner gate пропускает только этот no-op, проверяет последующие реальные Apply/Undo/EPS как прежде.

На данный момент:429 JS ожидаются после добавления3 meaningful cache tests, targeted3/3 cache и viewer camera/gesture/resize/focus PASS; расширенный реальный settings browser reset/all18+slider/idempotence PASS; предыдущие426JS PASS до финального version bump. Следующие шаги: npm/Rust/freshWASM/full17Chromium, PR, CI, main Pages, публичный viewer+settings smoke. Пока НЕ опубликовано, private userEPS/hardware не предоставлены.

## 0.2.0-alpha.75 — ОПУБЛИКОВАНО, 2026-11-21

- **Сначала выполнена документация по запросу:** [сводка изменений alpha72–74](https://github.com/tohaa28/relief-forge/blob/main/docs/history/CHANGES_ALPHA72_ALPHA74.md), отдельный checkpoint `0a79676` опубликован перед runtime-правками. Новый релиз: viewer zoom и reset defaults.
- **Просмотр:** все wheel-события накапливаются в точную virtual camera, один RAF выставляет viewBox; SVG/подложка и список объектов остаются смонтированными. Векторные команды/paint/holes/images/history не меняются на зуме. Кеш экранных декораций поддерживает радиусы/текст/healthy и clearance floor без native parsing/новой диагностики. Fast screen→world учитывает letterboxing и текущую virtual camera. Fit/resize/buttons и отмена pending camera перед новым жестом/focus проверены. Editor local-cache/RAF сохранён.
- **Настройки:** кнопка «По умолчанию» восстанавливает18 параметров и optimization slider из тех же HTML defaults, что используются при старте. Сглаживание Безье0, прежние остальные defaults сохранены (diagnostics.01mm,optimization.02mm,clearance.1mm,nearby.05mm strict,micro.1×.1mm,hybrid/all/preserve,DoctorTracer off). Сброс меняет форму настроек; обработка только существующим Apply, геометрия/Undo при самом сбросе неизменны. Повторный reset идемпотентен.
- [PR#107](https://github.com/tohaa28/relief-forge/pull/107) MERGED; source `47675aacce48937daa7972516cb11e9c39786c96`, main merge `644154406e36474a67d9bdba20cadb97e34ef06f`. [PR CI44879159067](https://github.com/tohaa28/relief-forge/actions/runs/44879159067) SUCCESS; [main build+Pages44879380891](https://github.com/tohaa28/relief-forge/actions/runs/44879380891) SUCCESS. Последующее обновление документации идёт отдельным skip-ci коммитом без runtime-изменений.
- **Локально:**429/429JS,17/17Rust,fresh locked WASM/ABI, полный17Chromium gates PASS; editor zoom/actual sharp rounding151/EPS/Undo/Redo/PDF silhouette0/320000 PASS. Все исходные неудачные harness-попытки сохранены в истории; геометрические guards не ослаблены.
- **Публичная [alpha75](https://tohaa28.github.io/relief-forge/?v=alpha75):** отдельно PASS viewer20kC/1975+underlay/ДО/ОБЪЕДИНЕНО/ПОСЛЕ, moving cursor error0, ring7px, pointer/Fit/resize/focus,0render/1viewBox/0geometry mutations. Public CPU4 burst60:compound7.0ms,many-after2.7ms,before2.5ms,prepared2.7ms. Real UI settings PASS: startup smoothing0, reset всех18+range, staged/no geometry mutation/explicit Apply/idempotence/compact panel. Viewer probe добавляет только измерительные hooks к реально загруженному публичному app; settings проверяет непатченое приложение.
- **Метод и ограничения:** [полная история](https://github.com/tohaa28/relief-forge/blob/main/docs/history/ALPHA75_VIEW_ZOOM_DEFAULTS.md), F-073/M-073, ALPHA75_VIEW_ZOOM_MEASUREMENTS.json. Baseline60wheel20kC24935ms→локально5.2–5.9ms;1975+underlay22412ms→2.6–2.7ms, CPU4 synthetic event-dispatch, НЕ FPS/GPU/пользовательское устройство. Viewer сохраняет полный SVG, поэтому стоимость браузерной отрисовки сложного макета зависит от устройства. Private пользовательский EPS не предоставлен, user-confirmed пока нет. Чужие PR не затронуты, незавершённых изменений кода нет. Следующий шаг: пользовательская оценка просмотра на реальном макете.

## 0.2.0-alpha.76 — кандидат: единый инструмент узлов/ручек и пустая область перед Open, 2026-11-21

Запросы пользователя: «объедини инструмент переместить и ручки углов»; во время работы добавлено «нажатие на кнопку открыть должно сбрасывать рабочую область до пустой и масщтаб». База main34fb2d8 (alpha75), observed main build+Pages44879380891 SUCCESS. Ветка feature/alpha76-unified-node-handles. Чужие PR не затрагиваются.

## Единый инструмент

Удалена отдельная toolbar кнопка node-handles. node-move сохраняет утверждённую иконку и название «Переместить»; title/hint объясняют работу с узлами и ручками. В трёх toolbar loops остались move/add/remove. Pointerdown маршрутизирует data-curve-handle к существующему editor.moveHandle при nodeTool=move, а узлы — к moveAnchor. Структурные операции/типы cusp/smooth/symmetric и математические инварианты ручек не менялись. H — совместимый alias того же move, V тоже move; отдельного режима handles больше нет. Не изменён self-intersection-mode handles — это другой инструмент ремонта. Add/remove не начинают drag ручки. Показ ручек по выбору узла сохранён.

Успешный dedicated uninstrumented Chromium: выбор узла1 у2C, move узла перемещает обе ручки вместе; incoming/outgoing ручки cusp двигаются независимо при неподвижном узле; local Undo/Redo, V/H alias, pointercancel, исходный DOM не пересоздаётся, один commit на «Готово», native2C/endpoints, EPS==AFTER, global Undo/Redo PASS. Первый harness упал на сравнении state после local Undo: тот намеренно снимает activeCurveNode и скрывает ручки. Тест теперь повторно выбирает узел перед чтением позиции, не меняя прежнюю геометрию или поведение Undo. npm429/429 PASS до version bump.

## Открыть: сброс до показа выбора

Выделен общий resetWorkspace для New/Open. Busy блокирует действие; открытый local editor сначала завершается штатным commit, при ошибке завершения сброс и file picker не выполняются. Старый непустой документ получает checkpoint; повторное открытие уже пустой стандартной области не добавляет пустые Undo-ступени. Отменяются старые settings/local/clearance/workspace-check timers и clearance Worker, инвалидируются поколения диагностики/preview; сбрасываются draft/drag/pan/local overlays, source comparison/markers, wireframe, имя файла, остаточный отчёт. Создаётся настоящий пустой документ300×200мм, fit camera[-21,-21,342,242] с обычным floating-point округлением; pending zoom сбрасывается. Настройки обработки и постоянная история файлов сохраняются.

Только после сброса вызывается file input click, его value заранее очищен для повторного выбора того же файла. Ctrl+O использует тот же путь. Отмена picker оставляет область пустой, Ctrl+Z возвращает предыдущий документ (включая завершённые local edits). Невалидный выбранный файл не воскрешает старую рабочую область; обычный прямой drop/fileinput не получил безусловного сброса и сохраняет свой прежний error recovery.

Подтверждён существовавший дефект: basename('') возвращает экспортный fallback relief-forge, поэтому пустой workspace показывал фиктивное имя. Исправлено только syncWorkspaceFileLabel: basename вызывается при настоящем sourceName; экспортный fallback не менялся. Static filename test обновлён для отсутствующего источника. Первый Open browser отказал на видимой подписи, это исправление приложения, не ослабление assertion. Следующий harness ожидал exact -21, но300*.07 даёт -21.000000000000004; camera проверяется с1e-10. Следующая попытка ожидала click скрытого глобального Undo в свёрнутой панели — переведена на пользовательский Ctrl+Z, который доступен без открытия панели. Последний targeted Open ещё выполняется на момент этой записи.

## Область проверки и следующий шаг

Основные файлы: web/app.js, web/index.html, web/doctor-shortcuts.js; tests/approved-artwork,corel-node-tools,doctor-brand-speed,toolbar-filename обновлены под объединённый UI/alias. Новые реальные browser-alpha76-unified-move.mjs и browser-alpha76-open-reset.mjs добавлены в обязательный check-wasm (всего19 Chromium gates). Версии Cargo/lock/npm и все module cache keys синхронизированы на alpha76. ДО/paint/holes/M-L-C-Q/Undo/точный EPS не должны меняться кроме явных пользовательских правок. Private EPS не предоставлен, fixtures синтетические. Следующие шаги: targeted Open,429JS/Rust/freshWASM/full19Chromium, PR/CI/main Pages/public оба сценария. Пока НЕ опубликовано, user-confirmed нет. Откат runtime —34fb2d8.

## 0.2.0-alpha.76 — ОПУБЛИКОВАНО, 2026-11-21

- **Единый инструмент:** «Переместить» двигает опорные узлы и управляющие ручки Безье. Отдельная кнопка «Ручки углов» удалена; V/H включают один move. Cusp/smooth/symmetric и deferred local editor/Undo сохранены. Обе ручки и узел реально перетаскиваются без перестройки полной геометрии; EPS сохраняет точные команды после «Готово».
- **Открыть / Ctrl+O:** синхронно сбрасывают рабочую область до настоящего пустого300×200мм документа и начального Fit перед picker. Отмена оставляет пусто, Ctrl+Z восстанавливает предыдущий документ, включая завершённые локальные правки. Очищаются stale comparison/markers/local glyphs/reports/pending camera/таймеры, настройки обработки и постоянная история файлов сохраняются. Повторный выбор того же имени и invalid import проверены. Empty caption не использует экспортный fallback relief-forge; нет фиктивной подписи файла.
- [PR#108](https://github.com/tohaa28/relief-forge/pull/108) MERGED. Source checkpoint `9e9ebbac26569bd8adb1624808392b150d6e20f5`; main merge `359f6f05665544c338f91df7407b2cc5ddc61213`. [PR CI44880867952](https://github.com/tohaa28/relief-forge/actions/runs/44880867952) SUCCESS; [main build+Pages44881094487](https://github.com/tohaa28/relief-forge/actions/runs/44881094487) SUCCESS. После этого идёт отдельный skip-ci documentation commit, runtime не меняется.
- **Проверено локально и CI:**429/429JS,17/17Rust,fresh locked WASM/ABI и полный19Chromium gates PASS. Прежние editor/view zoom, defaults, sharp smoothing151, native Union/diagnostics/EPS/Undo/Redo и PDF silhouette0/320000pixel PASS.
- **Публичная [alpha76](https://tohaa28.github.io/relief-forge/?v=alpha76):** непатченое приложение, оба новых browser scripts PASS. Move: anchor+in/out handles, independent cusp controls, local/globalUndoRedo,V/H,pointercancel, retained DOM и exact EPS. Open: сброс до native picker, Cancel пусто, initial camera, Undo original/staged edits, Ctrl+O/same filename/invalid import. Это синтетические fixtures, private пользовательский EPS и устройство не предоставлены; user-confirmed пока нет.
- **Контекст и ограничения:** [полная история](https://github.com/tohaa28/relief-forge/blob/main/docs/history/ALPHA76_UNIFIED_MOVE_OPEN_RESET.md), F-074/F-075,M-074/M-075, journals. Не восстанавливать отдельный nodeTool=handles: он объединён по запросу; одноимённый self-intersection repair mode handles — другая опция и не удалялся. Сброс до выбора — явное требование пользователя, поэтому Cancel не возвращает старую область автоматически. Drop/direct input error recovery не менялся. Исходный DO/paint/holes/nativeM-L-C-Q не меняются кроме явных локальных операций. Чужие PR не затрагивались. Незавершённого runtime-кода нет; следующий шаг — оценка пользователя на реальном макете.

## 0.2.0-alpha.77 · Вкладка DoctorTracer

База 6bd106f, опубликованная alpha.76 (PR #108, Pages 44881094487). При включении и применении настройки вся векторная работа получает вкладку DoctorTracer с подготовленным силуэтом, прогрессом и отменой. Вкладка использует существующий Worker DoctorTracer 0.21.1 с передачей RGBA. Порог 11 больше не препятствует запуску. Обработка выделенной части не заменяет весь документ. Полученный SVG возвращается в основную область и проходит проверку силуэта, Rust и нативную диагностику. Требуется полная проверка и строго меньше дефектов, поэтому чистый исходник не заменяется только ради трассировки. При отмене и сбое остаётся результат векторной обработки. Первые тесты выявили CRLF в app.js и устаревшее ожидание вызова проверки без аргумента threshold. Исправлены окончания строк и ожидание. Кандидат, публикация ожидается.

## 0.2.0-alpha.77 · Опубликовано 2026-11-21

DoctorTracer открывает вкладку с силуэтом, прогрессом и отменой. После трассировки основной интерфейс проверяет возвращённый вектор. Запуск больше не зависит от порога 11 дефектов. Принятие требует улучшения и полной проверки. В реальном браузерном прогоне Worker DoctorTracer вернул кривые с двумя дефектами для чистого прямоугольника. Проверка отклонила результат. Первое ожидание нуля дефектов в локальном пробном сценарии было неверным и заменено проверкой фактического возврата вектора на диагностику.

429 JS, 17 Rust, свежая WASM, полный браузерный набор и отдельный тест новой вкладки с тестовым Worker прошли. PR [#109](https://github.com/tohaa28/relief-forge/pull/109), [PR CI](https://github.com/tohaa28/relief-forge/actions/runs/44881757930), main 7b1214151cc39db6977e7a5c8dea6d32116ae381, [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44882012498). Публичный браузерный прогон с настоящим Worker подтвердил передачу и возврат на проверку. Тестовый вход — синтетический SVG.

## 0.2.0-alpha.78 · Маркеры после редактора, 2026-11-21

База 6174189, alpha.77, Pages 44882012498. Раньше выход с правками очищал список дефектов. Теперь сохраняет его и откладывает только диагностику всего документа, когда были известные дефекты. Только полная проверка заменяет прежние отметки. При частичной проверке или сбое прежние свидетели остаются, интерфейс отмечает отсутствие подтверждения. Диагностика не запускает автоисправление и DoctorTracer. Выход без правок оставляет существующие отметки без запуска проверки. Отложенная работа проверяет актуальность документа.

Браузерный тест на двух открытых контурах подтвердил исчезновение отметки закрытого контура и сохранение второго. Первые три статические проверки ожидали старую сигнатуру и сброс списка. Ожидания обновлены под новый контракт. Тестовые данные синтетические. Публикация ожидается.

## 0.2.0-alpha.78 · Опубликовано 2026-11-21

После «Готово» неисправленные дефекты остаются отмеченными. Если были правки и известные дефекты, запускается диагностика без автоисправления и трассировки. При полной проверке исчезают отметки исправленных дефектов. При неполной проверке предыдущие сведения сохраняются как неподтверждённые. Выход без правок оставляет существующие отметки без запуска диагностики.

429 JS, 17 Rust, сборка WASM и полный набор Chromium прошли. Публичный Chromium подтвердил, что после закрытия одного из двух открытых контуров его маркер исчезает, второй остаётся. Первый push получил TLS EOF, повтор с HTTP/1.1 прошёл. [PR №110](https://github.com/tohaa28/relief-forge/pull/110), main b6306d7da86f08b8a8fee0f9c943bee51f5fa3c0. [Проверки PR](https://github.com/tohaa28/relief-forge/actions/runs/44882752485), [публикация](https://github.com/tohaa28/relief-forge/actions/runs/44882980563). Тестовые контуры синтетические.

## 0.2.0-alpha.79 · Контуры и отметки при выходе из редактора

База main 035dab9, alpha.78, Pages 44882980563. Пользователь сообщил, что устранённый дефект может оставаться отмеченным, а часть векторов после «Готово» отображается с заливкой. При закрытии всех подконтуров отредактированного объекта его маркер открытого контура снимается сразу. Если полная диагностика частичная, выполняются независимые проверки до восьми групп объектов, связанных с отредактированными маркерами. Полная проверка такой группы заменяет её нативные отметки, неполная сохраняет их. Сохранены отмена по поколению, команды M/L/C/Q/Z и диагностика без автоисправления.

При выходе включается контурное отображение для всех векторов, а растровые объекты используют прежний вывод. Оригинальная заливка остаётся в документе и экспорте, обычный вид доступен в «Проверка рабочего поля». Причина смешанного отображения воспроизведена синтетическим SVG с двумя открытыми контурами и залитым прямоугольником. Браузер подтвердил три контура без заливки и один маркер неисправленного контура. Первое статическое ожидание ветки artwork обновлено для сохранения показа растра. Публикация ожидается.

## 0.2.0-alpha.79 · Опубликовано 2026-11-21

После выхода из редактора все векторы показываются контурами. Экспорт использует сохранённое оформление. При закрытии всех подконтуров объекта исчезает маркер открытого контура. Если общая проверка частичная, проверяются группы объектов, связанные с правками, с лимитом восемь групп. Неопределённые дефекты остаются отмеченными. Подробности в записи кандидата ниже.

429 JS, 17 Rust, WASM и полный Chromium прошли. Публичный тест на двух открытых контурах и залитом объекте подтвердил, что исчезает только исправленный маркер и все три вектора отображаются без заливки. [PR №111](https://github.com/tohaa28/relief-forge/pull/111) · [CI](https://github.com/tohaa28/relief-forge/actions/runs/44883767290) · [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44883996282). Merge ba9157d21cab9453365dfc27a3b4b98ac76f0b58.

## 0.2.0-alpha.80 · Точки и быстрая проверка при выходе

База main 234b71e, alpha.79, Pages 44883996282. Причины пропадающих узлов в редакторе: сохранённый hidden на слое узлов, ограниченное окно вокруг последнего клика и устаревшая ячейка индекса после перемещения. Рабочие узлы отделены от переключателя здоровых точек, видимая область имеет приоритет, активный узел закреплён, перенос обновляет только затронутую запись. Число экранных узлов по-прежнему ограничено при общем масштабе.

После «Готово» вместо обхода рисунка, выборки кривых для Rust и повторной глобальной проверки выполняется нативная проверка существующих маркеров по связанным объектам. Передаётся только геометрия этой группы. Общий бюджет проверок 3 секунды, включая запуск Worker. Непроверенные маркеры сохраняются. Полная проверка доступна кнопкой «Проверить дефекты». Диагностика не меняет геометрию. Проверки синтетические. Локальные браузерные сценарии передачи узла между режимами, Undo/EPS, маркеров и переключателя точек прошли. Публикация ожидается.

## 0.2.0-alpha.80 · Опубликовано 2026-11-21

Рабочие узлы остаются видимы при скрытии здоровых точек. Отрисовка учитывает видимую область, активный узел и актуальное положение перемещённых узлов. После «Готово» выполняется проверка известных маркеров по связанным контурам в пределах трёх секунд, включая запуск Worker. Непроверенные маркеры остаются доступными. Полная диагностика запускается кнопкой «Проверить дефекты».

431 JS, 17 Rust, WASM и полный набор Chromium прошли. Публичный Chromium подтвердил видимость рабочих точек и сохранение только неисправленного маркера после закрытия одного из двух контуров. Синтетические сценарии не измеряют время на пользовательском макете. [PR №112](https://github.com/tohaa28/relief-forge/pull/112), [CI](https://github.com/tohaa28/relief-forge/actions/runs/44885046482), [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44885281533). Merge fe6fff112bfdfc0e87838d8e7d2a9729266ffa84.

## 0.2.0-alpha.81 · Розовые метки поверх результата ПОСЛЕ

База main 21b1e29, alpha.80, Pages 44885281533. Анализ зазоров уже получал геометрию видимой стадии, но розовый слой выводился под результатом и исходной подложкой. Для ПОСЛЕ слой переносится поверх геометрии, ниже узлов и остальных дефектов. На прежних стадиях сохраняется прежний порядок. Перестановка идемпотентна, экспорт не использует этот слой. Chromium проверяет расстояние 0,05 мм, порядок отрисовки до и после, переключение стадий и EPS. Кандидат, публикация ожидается.

## 0.2.0-alpha.81 · Опубликовано 2026-11-21

Во вкладке «ПОСЛЕ» розовые метки зазоров рисуются поверх обработанной геометрии и исходной подложки. Координаты и расстояния рассчитываются по результату «ПОСЛЕ». Для остальных стадий сохраняется прежняя отрисовка. Розовые метки остаются элементом интерфейса и не входят в EPS.

431 JS, 17 Rust, WASM и полный Chromium прошли. Публичный Chromium подтвердил порядок слоёв, зазор 0,05 мм и отсутствие меток в EPS. [PR №113](https://github.com/tohaa28/relief-forge/pull/113), [CI](https://github.com/tohaa28/relief-forge/actions/runs/44901254139), [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44919754986). Merge 994617006dd3847c6583156dc917501c128a7c7f.

## 0.2.0-alpha.82 · Удаление узлов и отзывчивый выход

База main 63245a4, alpha.81, Pages 44919754986. По просьбе пользователя измерена ручная правка на предоставленном локальном EPS, без переноса файла в GitHub. В отдельной сессии после импорта 30 объектов, выбран самый плотный контур с 1230 узлами. Один одинаковый прогон до/после: обработчик удаления 23,4 → 9,6 мс, выход 32,9 → 26 мс. Измерены синхронные участки JS, без времени отрисовки и без обобщения на все операции.

Построение индекса использует числовые команды без выделения массивов контрольных точек каждого сегмента. Чтение узлов использует временные ссылки на команды вместо их полной копии. Запись SVG применяет обратную аффинную матрицу к нативным координатам, сохраняет обёртки, оформление и геометрию. Отображение нативных команд не разбирает строку SVG заново. Маркеры проверяются фоновым Worker с бюджетом предыдущего выпуска. Результат устаревшей проверки игнорируется при смене документа, редактора или диагностики. Обновление маркеров использует уже смонтированную геометрию. Первые два статических теста ожидали прежнюю сигнатуру render, контракт обновлён. Публикация ожидается.

## 0.2.0-alpha.82 · Опубликовано 2026-11-21

Удаление узла дешевле перестраивает индекс. В отдельном локальном сеансе на пользовательском EPS с 1230 узлами в выбранном контуре один прогон показал 23,4 → 9,6 мс для удаления и 32,9 → 26 мс для выхода. Это время синхронных обработчиков. Проверка маркеров после выхода работает в фоне, а обновление маркеров сохраняет уже отрисованные векторы. Локальное имя файла и содержимое в GitHub не переданы.

431 JS, 17 Rust, WASM и полный Chromium прошли. Публичный Chromium на синтетическом рисунке подтвердил сохранение векторного DOM и вывод нужных маркеров. [PR №114](https://github.com/tohaa28/relief-forge/pull/114), [CI](https://github.com/tohaa28/relief-forge/actions/runs/44921421647), [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44921690127). Merge b50dbf5a488dd9fbabd38ae5311f937389cd3fa6.

## 0.2.0-alpha.83 · Видимый индикатор при выходе из редактора

База 336ea6a, alpha.82, Pages 44921690127. Пользователь уточнил, что выходит повторным нажатием «Редактор». Ранее обе кнопки вызывали синхронную фиксацию правок и перестройку SVG в обработчике клика, до следующего кадра. Теперь «Редактор» и «Готово» включают индикатор без процента и дают браузеру показать кадр до сохранения. Завершение запланировано через два animation frame, резервный таймер обслуживает скрытую вкладку. До фиксации правок отмена сохраняет черновик, а старый callback не завершает новый выход. При разблокировке снята промежуточная полная перерисовка, итоговый вид строится один раз. Текущая сериализация и отрисовка всё ещё занимают время.

В отдельном локальном Chromium на предоставленном EPS после удаления узла из контура с 1230 узлами первый callback кадра увидел индикатор и всё ещё открытый редактор. Кадр просмотра достигнут примерно за 46 мс в одном прогоне. Точное время зависит от устройств и макета. Синтетический Chromium покрывает повторное нажатие «Редактор», отмену, первый кадр индикатора, фиксацию узлов и обновление маркеров. Частный EPS не публикуется. Публикация ожидается.

## 0.2.0-alpha.83 · Опубликовано 2026-11-21

При повторном нажатии «Редактор» или нажатии «Готово» браузер показывает индикатор «Сохранение правок редактора» до синхронной фиксации и отрисовки SVG. Отмена до фиксации сохраняет черновик. На локальном пользовательском EPS состояние индикатора подтверждено в первом кадре, кадр просмотра достигнут примерно за 46 мс в одном прогоне. Пауза сериализации и вывода остаётся, итоговый вид строится один раз.

431 JS, 17 Rust, WASM и полный Chromium прошли. На опубликованной версии проверены отмена, повторное нажатие «Редактор», первый кадр индикатора, сохранение правок и маркеров. [PR №115](https://github.com/tohaa28/relief-forge/pull/115), [CI](https://github.com/tohaa28/relief-forge/actions/runs/44922742716), [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44923017847). Merge 48fd7b116559d0c19b64ebfa792091be4bb6f55d.

## 0.2.0-alpha.84 · Первый зум после редактора

База 77626a1, alpha.83, Pages 44923017847. Повторное нажатие «Редактор» открывает короткую фазу сохранения. Теперь колесо, прокрученное в этой фазе, накапливается для следующего режима просмотра и воспроизводится с учётом его размеров. После фиксации кадр зума переживает фоновое обновление маркеров. Обновление только маркеров не отменяет камеру. Чтение размеров SVG перенесено перед записью viewBox, чтобы не запрашивать принудительную синхронную раскладку сразу после масштабирования.

Браузерный сценарий прокручивает колесо в обработчике повторного клика «Редактор», проверяет итоговое изменение масштаба ровно в 1,15 раза, сохранённый вектор, Undo и маркеры. На локальном пользовательском EPS проверено 12 шагов после выхода, примерно 23–40 мс до и 23–45 мс после до второго callback кадра. Многосекундная задержка на этом окружении не воспроизведена, ускорение отрисовки по этим измерениям не установлено. Проверка устраняет подтверждённые потери ввода. Частный файл в GitHub не передаётся. Публикация ожидается.

## 0.2.0-alpha.84 · Опубликовано 2026-11-21

Первый зум после редактора сохраняется в очереди, если колесо прокручено до завершения выхода. Результат проверки маркеров не отменяет виртуальную камеру. Размеры SVG читаются до изменения viewBox. На пользовательском EPS многосекундная пауза локально не воспроизвелась, синхронизация первого шага проверена отдельно.

431 JS, 17 Rust, WASM и полный Chromium прошли. Публичный тест подтвердил первый шаг зума, индикатор выхода и сохранение маркеров. [PR №116](https://github.com/tohaa28/relief-forge/pull/116), [CI](https://github.com/tohaa28/relief-forge/actions/runs/44923798376), [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44924121729). Merge 547fcd38479c5238c8d1f169261d37dffba5c062.

## 0.2.0-alpha.85 · Серии зума в режиме просмотра

База 6e15c23, alpha.84, Pages 44924121729. Каждая прокрутка продолжает обновлять камеру по animation frame. При серии событий перезапускается пауза 100 мс. Маркеры, числа и здоровые точки получают итоговый экранный размер одним обновлением после паузы. Во время жеста они масштабируются вместе с рисунком. Изменение режима сбрасывает таймер, устаревшие слои не обновляются. Геометрия и подложка сохраняются, поиски дефектов и геометрические операции не запускаются.

Локальный пользовательский EPS после выхода из редактора, 12 шагов: 120 записей атрибутов меток и точек на alpha.84, 0 во время серии и 10 после на alpha.85. До второго callback кадра около 21–42 мс до и 24–42 мс после. Эти замеры не показывают заметного выигрыша длительности кадра, но подтверждают исключение повторных обновлений декораций. Браузерная проверка проверяет 8 кадров камеры и ровно одно обновление кольца после. Первое фиксированное ожидание 180 мс оказалось ненадёжным, заменено ожиданием фактического восстановления размера кольца. Частный EPS не публикуется. Публикация ожидается.

## 0.2.0-alpha.85 · Опубликовано 2026-11-21

Зум по-прежнему обновляет камеру по кадрам. Размеры экранных декораций восстанавливаются один раз после паузы 100 мс. На локальном пользовательском EPS 12 шагов зума дали 120 изменений атрибутов до, 0 во время серии и 10 после в новой версии. Замеры длительности кадров близки, устранение большой задержки в пользовательском браузере не подтверждено.

431 JS, 17 Rust, WASM и полный Chromium прошли. Публичный Chromium подтвердил 8 кадров камеры и одно обновление размера маркера после серии. [PR №117](https://github.com/tohaa28/relief-forge/pull/117), [CI](https://github.com/tohaa28/relief-forge/actions/runs/44925447840), [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44925713023). Merge f29d5b56584ea16d059be47a6089ebcd84831914.

## 0.2.0-alpha.86 · Интерфейс DoctorTracer внутри Доктора Узелкова

База f9e5a03, alpha.85, Pages 44925713023. Вкладка трассировки раньше показывала заглушку с растром и запускала Worker без настроек. Теперь она открывает опубликованный мастер DoctorTracer 0.21.1 на общем origin. Подготовленный ограниченный PNG передаётся локально через обычный файловый ввод мастера. Оператор выбирает параметры и запускает трассировку. «Вернуть вектор» доступна после появления результата и использует кнопку экспорта SVG мастера. Перехватывается только локальный blob экспорта в этом iframe. Размер SVG ограничен, документ проходит прежний парсер, преобразование в мм, сравнение силуэта и проверку дефектов. Неудачный результат не заменяет вектор. Отмена освобождает iframe. Внешний репозиторий и лицензия не менялись.

Интеграция зависит от опубликованных элементов управления мастера и доступна на общем GitHub Pages origin. При несовместимости интерфейса отображается ошибка. Повторная трассировка делается настройками мастера до возврата, скрытые автоматические попытки удалены из UI-пути. Первые статические проверки ожидали автоматические попытки и прежние параметры вызова. Синтетический Chromium проверяет PNG, изменение настройки, запуск, возврат SVG и отмену. Отдельный прогон использовал настоящее приложение DoctorTracer и локальный хост Узелкова под общим origin. Публикация ожидается.

## 0.2.0-alpha.86 · Опубликовано 2026-11-21

«Трассировка DoctorTracer» открывает опубликованный интерфейс мастера во вкладке Узелкова и передаёт PNG. После настройки и трассировки «Вернуть вектор» возвращает SVG. Прежние проверки масштаба, силуэта и дефектов применяются к возвращённым кривым. Если проверка отклоняет результат, предыдущий вектор остаётся доступен. Самостоятельный репозиторий DoctorTracer не изменялся. Связка зависит от общего origin и элементов опубликованного интерфейса.

431 JS, 17 Rust, WASM и полный Chromium прошли. На опубликованной версии проверены передача PNG, базовый режим с выбором параметров, экспорт SVG обратно на проверку и отмена. [PR №118](https://github.com/tohaa28/relief-forge/pull/118), [CI](https://github.com/tohaa28/relief-forge/actions/runs/44928387736), [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44928668258). Merge 366bb61c12b3a3cd3418670fbdc89e4575b0a6c1.

## 0.2.0-alpha.87 · Исходное оформление в растре DoctorTracer

База bd0923c, alpha.86, Pages 44928668258. Раньше трассировщик получал чёрную альфа-маску с эвристической заливкой контуров. Теперь браузер растеризует оригинальное SVG-дерево импорта целиком на прозрачном фоне, с исходным порядком отрисовки, группами, правилами заливки и обрезкой. Учитывается вся страница, включая обводки. Для старых или отредактированных проектов сохранённый sourceSvg используется только если соответствует оформлению и порядку объектов. Иначе растрируется текущее оформление из модели. Сравнение результата использует альфа-канал оригинального оформления на том же физическом холсте. Общая точность растра ограничена разрешением, рабочий PNG ограничен 2400 пикселями по длинной стороне из-за опубликованного DoctorTracer.

Браузерная проверка читает PNG на принимающей стороне: красный [255,0,0,153], синий поверх красного [0,0,255,153], фон [0,0,0,0]. Тем самым проверяются цвет, порядок и общая групповая прозрачность. Настоящий мастер получил PNG и вернул SVG. Одно старое статическое ожидание чёрной маски обновлено под новый контракт. Публикация ожидается.

## 0.2.0-alpha.87 · Опубликовано 2026-11-21

DoctorTracer получает PNG, созданный из дерева импортированного SVG. Сохраняются заливки, порядок объектов, обрезка и общая прозрачность вложенных групп. Для передачи максимальная сторона PNG составляет 2400 пикселей. Проверка силуэта использует альфа-канал браузерного рендера.

Прошли 431 JS-тест, 17 Rust-тестов, сборка WASM и браузерный набор Chromium. В локальном браузере проверены цвета и альфа-канал перекрывающихся объектов в переданном PNG. Локальный EPS пользователя импортирован, принимающая вкладка декодировала PNG. На опубликованной версии проверены получение PNG, настройки мастера, возврат SVG на проверку и отмена. [PR №119](https://github.com/tohaa28/relief-forge/pull/119), [CI](https://github.com/tohaa28/relief-forge/actions/runs/44929971529), [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44930235455). Merge 371a009f6fae7357aabb9819887f09e7cda35cc3.

## 0.2.0-alpha.88 · Кнопка DoctorTracer и замена ДО · 2026-11-21

База main 9bab9e3, alpha.87, PR №119. Кнопка «В DoctorTracer» находится у переключателей сравнения и доступна в ПОСЛЕ после расчёта. Растр исходного оформления ДО готовится по нажатию, максимальная сторона 2400 px. Настройка автоматического запуска, предварительная маска и фильтр приёмки по прежнему силуэту и числу нарушений исключены из активного маршрута. После проверки формата результат масштабируется в миллиметры страницы и проходит обычный вход импорта. Он становится новым ДО, затем выполняются объединение копии, диагностика и исправление. Отмена трассировки сохраняет прежний документ. Undo/Redo в текущей сессии восстанавливает исходник каждой версии сравнения. Документ пользователя и код DoctorTracer остаются за пределами коммита.

Повторная обработка может найти дефекты в возвращённом векторе. Специальная проверка сравнения силуэта перед его заменой больше не применяется. CI, публикация и публичный браузерный прогон ожидаются. Откат к alpha.87 возвращает запуск через настройки и прежний фильтр приёмки.

## 0.2.0-alpha.88 · Опубликовано 2026-11-21

«В DoctorTracer» открывается кнопкой из ПОСЛЕ и передаёт растр исходного оформления. Вкладка мастера занимает остальное окно под компактной строкой «Вернуть в ДО» и «Отмена». Возврат SVG проходит через обычный импорт, создаёт новое ДО и запускает пересчёт ПОСЛЕ.

430 JS, 17 Rust, WASM и Chromium прошли. Локальный браузер проверил доступность кнопки, геометрию нового ДО, расчёт ПОСЛЕ, отмену и Undo/Redo. На опубликованной версии Chromium прошёл полный сценарий с настоящим мастером без подмены ответов. Проверены PNG, настройки трассировки, новый ДО, пересчёт ПОСЛЕ, отмена, Undo и Redo. [PR №120](https://github.com/tohaa28/relief-forge/pull/120), [CI](https://github.com/tohaa28/relief-forge/actions/runs/44931858104), [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44932088585). Merge 719c6f2919469c2a33476227b3dd300aecd3b0c8.

## 0.2.0-alpha.89 · Чёткие края и выбор DPI · 2026-11-21

База b7a76a7, alpha.88, PR №120. В ПОСЛЕ рядом с «В DoctorTracer» доступны 300, 600 и 1200 dpi. По умолчанию 600 dpi. Размеры PNG округляются до целого пикселя на основе размеров страницы в мм. Метаданные pHYs указывают выбранное разрешение. SVG растрируется с shape-rendering: crispEdges на фигурах и отключённой интерполяцией Canvas. Исходные цвета, порядок SVG и прозрачность групп сохраняются. PNG кодируется напрямую без второго полотна и копирования RGBA в JS. Предельные размеры полотна 16384 px и 160 млн пикселей учитываются до выделения памяти. При превышении требуется меньшее dpi.

Сторонний опубликованный DoctorTracer масштабирует полученный PNG до 2400 px по длинной стороне. Это подтверждено app.js мастера 0.21.1. В строке мастера появляется уведомление. DoctorTracer не менялся. SVG clipPath в Chromium может по-прежнему давать промежуточное покрытие на границе обрезки. Попытка применить crispEdges к группе и clipPath не изменила эти пиксели. Ради сохранения оформления от пороговой обработки всего альфа-канала отказались, поскольку она уничтожила бы исходную прозрачность. Неравномерный градиент и прозрачность относятся к оформлению.

Тестовый Chromium измерил отсутствие дополнительных уровней альфа на диагональной кромке фигуры, 300/600/1200 в PNG и размеры 118/236/472 px для страницы 10 мм. Отдельно успешно создан PNG A4 в 1200 dpi размером 9921×14031 px. Публикация ожидается.

## 0.2.0-alpha.89 · Опубликовано 2026-11-21

Рядом с «В DoctorTracer» выбираются 300, 600 и 1200 dpi. По умолчанию 600 dpi. PNG имеет соответствующие размеры и pHYs. Геометрия отрисовывается с crispEdges и отключённой интерполяцией Canvas. Сглаживание на границах SVG clipPath зависит от Chromium. Внешний мастер имеет отдельный предел 2400 px по длинной стороне.

Прошли 430 JS, 17 Rust, WASM и Chromium. Проверены размеры и pHYs для всех трёх вариантов, исходная альфа группы и чёткая кромка диагональной фигуры. A4 при 1200 dpi закодирован в 9921×14031 px. На опубликованной версии проверены отправка PNG в 600 dpi, трассировка и возврат SVG, повторная отправка при 1200 dpi и отмена. [PR №121](https://github.com/tohaa28/relief-forge/pull/121), [CI](https://github.com/tohaa28/relief-forge/actions/runs/44933628811), [Pages](https://github.com/tohaa28/relief-forge/actions/runs/44933857318). Merge ef6f0e62d32c9270abaf4e55e71baf69fb01cb31.
