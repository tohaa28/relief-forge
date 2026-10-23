# Реестр ошибок, неудачных подходов и защит от повторения

**Смысл:** не только «что исправлено», но **каким путём пришли к ошибке и почему старый метод больше не применять**. Читайте до изменений импортёра, Union, редактора, диагностики, EPS export и UI. Факты = подтверждённые CI/кодом/загруженным примером; гипотезы прямо помечены. Исходный файл пользователя или пароль сюда не добавлять.

Статусы:
- **исправлено в коде** — подтверждена изменённая реализация + тесты, но не обязательно пользовательская проверка;
- **проверено пользователем** — пользователь реально воспроизвёл успешное поведение;
- **ограничение / исследовать** — нельзя обещать устранение во всех входных форматах;
- **попытка отклонена** — метод не удовлетворяет инвариантам и не должен возобновляться без доказательств.

## F-001. Нет нативных инструментов при старте проекта
- **Симптом:** в первой alpha.1 среде недоступны Rust/Cargo, REA/Ghidra и GUI запущенного Windows ArtCAM; прямое HTTPS к GitHub ограничено.
- **Первое решение/неудача:** первоначальный код и скрипты можно было написать, но нельзя честно объявлять нативную сборку/воспроизведение ArtCAM.
- **Выход:** GitHub Actions для Rust/WASM/JS; локальные PowerShell-скрипты REA с точными версиями/хешами и результатом выполнения. Не писать о реально увиденных Windows экранах при отсутствии capture.
- **Защита:** разделять states \`implemented\`, \`CI passed\`, \`browser smoke\`, \`user verified\`, \`deployed\`. См. [REA_WORKFLOW](../REA_WORKFLOW.md), [AGENTS](../../AGENTS.md).
- **Статус:** CI впоследствии появился; GUI-эквивалентность ArtCAM остаётся непроверенной.

## F-002. EPS CorelDRAW «пустой» в Ghostscript, хотя в нём есть контуры
- **Симптом:** некоторые Corel EPS содержат пути, которые завершаются \`N/newpath\` без операторов paint, поэтому стандартный визуальный рендер — пустая страница.
- **Неверное предположение:** «если Ghostscript/PDF пуст, значит исходный EPS не содержит векторов».
- **Метод:** только для строго распознанного непечатаемого Corel EPS извлекать \`m/L/C/c/@c/N\` по проверенному синтаксису, без безусловного универсального regex-парсинга PostScript; при наличии любого неизвестного оператора отказаться, не подменять контент.
- **Защита:** \`recoverUnpaintedCorelOutlines\`, ограничение по DSC, операциям и размерам; синтетические регрессии. [alpha.3 PR #2](https://github.com/tohaa28/relief-forge/pull/2), [alpha.33 PR #39](https://github.com/tohaa28/relief-forge/pull/39).
- **Статус:** код и CI подтверждены; особенности каждого нового производителя EPS ещё проверять.

## F-003. Неверный BoundingBox/pt→мм скрывает или растягивает векторы
- **Симптом:** исходные вектора есть, но SVG оказывается смещённым/неверного размера относительно рабочего поля.
- **Причина:** сырой PostScript использует page space и \`BoundingBox\` в пунктах; отображение SVG — мм; нельзя присваивать координатам произвольный origin.
- **Решение:** использовать действительный EPS \`BoundingBox\`, transform/flip с учётом оси Y, преобразование 72 pt/дюйм → мм; тестировать размер/позицию.
- **Защита:** [alpha.5 PR #4](https://github.com/tohaa28/relief-forge/pull/4), регрессии по импорту и физическому масштабу.
- **Статус:** код исправлен, ограничение для необычных EPS с нестандартным unit logic сохраняется.

## F-004. «ПОСЛЕ» выглядело сглаженным, но геометрия фактически не менялась
- **Симптом:** пользователь не видел применения сглаживания, либо различия были лишь в визуальном отображении.
- **Причина/неправильный метод:** оценка по пикселям вместо сравнения фактических команд \`M/L/C/Q\`, а также рассогласование preview и doc.
- **Решение:** считать и сохранять изменённые реальные control/anchor geometry, сравнивать \`worldData(before/after)\`, иметь один Apply и Undo.
- **Защита:** версии alpha.12–14, тесты реального предпросмотра; закрытые без merge промежуточные PR #11–#14 и открытый #16 не выдавать за опубликованный контрольный код.
- **Статус:** исправлено в коде; визуальная эквивалентность ArtCAM не доказана.

## F-005. Оптимизация нарушала острые углы или переходы
- **Симптом:** при удалении точек мог меняться резкий стык и угловой силуэт; на замыкании появлялись разрывы.
- **Неверный метод:** универсальное сглаживание каждого узла без классификации cusp/smooth/closed seam.
- **Решение:** защищать cusp, корректно обрабатывать шов замкнутого пути и реальные C/Q-ручки.
- **Защита:** [alpha.15 PR #20](https://github.com/tohaa28/relief-forge/pull/20); регрессии замкнутых и острых Безье.
- **Статус:** исправлено для покрытых тестами случаев, сложные топологические касания по-прежнему отдельная категория.

## F-006. Диагностика находила ложные дефекты на корректно закрытых кривых
- **Симптом:** «почти совпадающие концы» отмечались там, где контур точно замкнут командой Z или кубическим швом.
- **Причина:** растровая/приближённая проверка не отличала явное замыкание от близких геометрических концов.
- **Решение:** диагностировать по семантике команд и топологии, не по одним координатам.
- **Защита:** [alpha.16 PR #21](https://github.com/tohaa28/relief-forge/pull/21), тесты closed curves.
- **Статус:** исправлено на известных эталонах.

## F-007. Оптимизатор или выбор объектов переставали работать после UI-изменений
- **Симптом:** кнопка существовала, но обработчик не запускался; выделение не передавалось в оптимизацию.
- **Причина:** регрессии связки DOM events/selected indices/превью, неполные UI-тесты.
- **Решение:** единая точка событий + тест на реальный обработчик, проверка выбранного scope.
- **Защита:** [alpha.11 PR #9](https://github.com/tohaa28/relief-forge/pull/9).
- **Статус:** исторически исправлено; любые новые кнопки должны быть покрыты UI-contract тестом.

## F-008. Недостаточно заметные маркеры/здоровые узлы и перегруженная легенда
- **Симптом:** толщина обводки перекрывала исходные узлы, легенда отнимала рабочее место; сотни цифр делали логотип нечитаемым.
- **Неверный метод:** масштабировать маркеры как документные элементы и подписывать все.
- **Решение:** размеры маркеров в экранных единицах, компактная легенда, контрастные кольца, выбор проблем по клику, скрытие номеров при высокой плотности.
- **Защита:** alpha.8/17/25.
- **Статус:** код изменён; реальное восприятие на больших экранах требует user QA.

## F-009. При большом EPS все 1000 маркеров оказались на нижней строке
- **Симптом:** пользователь показал фото: кольца только на нижнем тексте, хотя проблемы распределены по всему гербу.
- **Причина:** \`issues.slice(0,1000)\` выбирал первые проблемы в порядке обхода контуров (порядок ≠ пространственная важность).
- **Решение:** выбор по пространственным ячейкам всего документа с сохранением оригинального индекса каждой проблемы; проверка, что координаты принадлежат проверенным контурам; скрывать тысячи подписей.
- **Защита:** [alpha.25 PR #31](https://github.com/tohaa28/relief-forge/pull/31), синтетические 10000 замечаний.
- **Статус:** исправлено по синтетической регрессии; межблочные проверки частично ограничены.

## F-010. Большие EPS зависали/оставляли пользователя без статуса
- **Симптом:** долгий анализ многих тысяч узлов, внешне нет движения; Rust ограничен 2000 точек на запрос.
- **Неверный метод:** единый неограниченный расчет всего документа в UI thread; игнорирование локального scope, отмены и неполного покрытия.
- **Решение:** worker, порционная выборка, progress % и стадия, cancel, batch diagnostics и флаг \`partial\`.
- **Защита:** [alpha.24 PR #30](https://github.com/tohaa28/relief-forge/pull/30); не обещать полный анализ контактов между независимыми блоками.
- **Статус:** ускорено, гарантия ограничена измеренными входами.

## F-011. Save EPS мог сохранять оригинал, непроверенный preview или повторно лечить при сохранении
- **Симптом:** экспорт не всегда совпадал с результатом «ПОСЛЕ», а повторная диагностика могла менять решение.
- **Неверный метод:** автоматически заново вычислять состояние во время Ctrl+S либо брать \`doc\` вместо \`preview.result\`.
- **Решение:** snapshot-контракт: Save EPS использует **тот самый** подтверждённый результат ПОСЛЕ и его cached diagnosis; если ошибки остались/проверка неполная — предупреждение, явное решение; на ошибке кодирования не менять doc.
- **Защита:** alpha.23/26, \`web/after-result.js\`, тесты с \`no worker.postMessage on Save\`.
- **Статус:** исправлено в коде, не отменять без нового контракта.

## F-012. CMYK/EPS цвет терялся при редактировании
- **Симптом:** цветовая модель после EPS→SVG/обратного экспорта не всегда сохраняет исходные CMYK-пластины.
- **Недопустимое обещание:** «сохранить любые исходные краски точно» после редактирования через RGB SVG.
- **Решение:** нетронутый EPS сохранять исходными байтами; изменённый — экспортировать доступные solid RGB заливки/обводки с явным предупреждением. При неподдерживаемых transparency/clip/paint отказаться вместо молчаливого преобразования. Режим без цвета для ArtCAM — отдельный выбор.
- **Защита:** [alpha.25 PR #31](https://github.com/tohaa28/relief-forge/pull/31), тест untouched CMYK passthrough и re-painted RGB.
- **Статус:** открытое технологическое ограничение для редактируемых CMYK/ICC.

## F-013. Compound-path НЕ устранял внутренние перекрытия
- **Симптом:** соединённые объекты формально становились одним, но внутри оставались пересекающиеся границы.
- **Ошибочный подход:** конкатенация \`M…Z\` и название «объединение».
- **Решение:** настоящий Boolean Union Clipper по совместимым **закрытым заливкам одной краски**, с сохранением hole/outer topology; stroke-only и разные цвета исключить.
- **Защита:** alpha.26 → [alpha.27 PR #33](https://github.com/tohaa28/relief-forge/pull/33); тесты intersections и holes.
- **Статус:** прежний подход объявлен неполным; без Clipper не заменять на compound «ради скорости».

## F-014. В CorelDRAW весь рисунок мог быть одним составным объектом
- **Симптом:** на \`8048531.eps\` были реальные наложения внутри одного исходного объекта.
- **Неверный подход:** искать только пары разных path-object; такой объект всегда останется неслитым.
- **Решение:** нормализация вложенных и пересекающихся \`M…Z\` одного filled-object через winding-aware Clipper.
- **Защита:** [alpha.27 PR #33](https://github.com/tohaa28/relief-forge/pull/33); тест single compound path; пользовательский EPS не в git.
- **Статус:** исправлено для поддерживаемых заливок.

## F-015. Union создавал дубли узлов и короткие ступеньки
- **Симптом:** после булевой операции возможны точные дубликаты, коллинеарные точки, микросегменты.
- **Неверный метод:** агрессивно удалить все короткие рёбра, даже острые зубцы/узкие перемычки.
- **Решение:** консервативная чистка с ограниченным отклонением, проверкой outer/hole и XOR-площади. Если инварианты нарушены — вернуть результат **до чистки**, а не разрушать весь документ.
- **Защита:** [alpha.28 PR #34](https://github.com/tohaa28/relief-forge/pull/34); тесты sharpen/counter/short step/idempotency.
- **Статус:** исправлено для синтетических проверок; реальные критичные микроформы — визуально сверять.

## F-016. Оптимизация «перестала работать»: Clipper после неё опять создавал тысячи L
- **Симптом:** итоговый ПОСЛЕ содержал больше узлов, чем исходный Безье; нажатие редактора узлов выводило множество искусственных промежуточных точек.
- **Точная причина:** операции порядка \`optimize(original) → Union(flatten to L)\`, и \`startCurveEditor()\` удалял preview/переходил к оригинальному doc.
- **Решение:** финальный \`refitBooleanUnion\` после полигонального объединения; реальные \`M/L/C/Q\` узлы в ПОСЛЕ; вход в editor из ПОСЛЕ сначала подтверждает exact snapshot с Undo.
- **Защита:** [alpha.29 PR #35](https://github.com/tohaa28/relief-forge/pull/35), тест окружности 180 узлов и tolerance monotonicity. Не оптимизировать только до Union.
- **Статус:** исправлено в коде, live complex EPS требует сверки.

## F-017. Маскот скрывался непостоянно после импорта
- **Симптом:** на одном ПК маскот закрывал рабочую область, на других исчезал.
- **Причина/гипотеза:** нативный \`hidden\` мог проигрывать по специфичности CSS или загрузка документа могла ещё не отразиться в \`doc.paths\`.
- **Решение:** одновременно \`hidden\`, \`aria-hidden\`, inline \`display:none!important\`, CSS \`data-content-loaded\`; скрывать при начале импорта, учитывать пустую страницу PDF.
- **Защита:** [alpha.30 PR #36](https://github.com/tohaa28/relief-forge/pull/36), unit/mock DOM. Не утверждать как подтверждённую browser-root-cause без трассировки.
- **Статус:** реализация усилена; конкретный ПК потом сообщил другой симптом, см. F-018.

## F-018. SVG-холст виден, но нет импортированных векторов
- **Пользовательский факт:** \`8049569_10_29.10.eps\`, Chrome 155, DPR=1, canvas 989×786 px, CSS visible, mascotHidden=true, \`documentPaths=0\`, \`elementCount=0\`, \`issues=[]\`, \`ok=true\`.
- **Ложная диагностика:** health проверял только layout, не семантический факт: файл EPS якобы импортирован, а объектов ноль.
- **Решение:** \`EPS_EMPTY_GEOMETRY\`; проверка import-integrity **перед commit** нового документа; отдельная ошибка \`empty-import\` и \`import-failed\` в health отчёте. Намеренно пустой PDF по-прежнему допустим.
- **Защита:** [alpha.32 PR #38](https://github.com/tohaa28/relief-forge/pull/38); тест копирует ключевые условия пользовательского JSON. Не лечить ноль объектов только «Показать контуры».
- **Статус:** исправлена ложная успешная загрузка, а **настоящая причина пустого EPS** выяснена только после получения файла, см. F-019.

## F-019. Парсер Corel EPS отбрасывал весь рисунок из-за трёх маленьких \`c\`
- **Доказано исходным загруженным файлом:** \`8049569_10_29.10.eps\`, CorelDRAW 2020, 80 192 байт, 53 замкнутых контура, 654 кубических кривых (\`C\`=651, \`c\`=3), 58 \`L\`. Ghostscript выводит пустой PDF (нет paint), но PostScript-команды реальны.
- **Корень:** \`web/corel-outline.js\` принимал строго \`... C\`, хотя в PostScript Prolog \`/c/curveto\` и \`/C/c\`: оба эквивалентны curveto. Одного \`c\` достаточно, чтобы parser отказал в восстановлении **всего** документа.
- **Решение:** строгий \`[Cc]\` в шестипараметровом pattern, выходной SVG \`C\` с теми же управляющими точками; не растеризовать. Локально восстановлены все 53 контура и кривые, отрисованы в Inkscape; файл не добавлен в публичный репозиторий.
- **Ещё один виновник:** цепочка импорта ссылалась на \`corel-outline.js?v=0.2.0-alpha.18\` и могла использовать устаревший cached module, даже если app version обновлён. Изменён cache-buster.
- **Защита:** [alpha.33 PR #39](https://github.com/tohaa28/relief-forge/pull/39), mixed \`c/C\` regression, missing/unsupported operators fail-closed, [CI 39948169551](https://github.com/tohaa28/relief-forge/actions/runs/39948169551).
- **Статус:** локальная реконструкция и CI **подтверждены**; проверка на проблемном ПК ещё не получена.

## F-020. CI падал из-за устаревших тестов и изменённого интерфейсного контракта
- **Симптом:** исправленный runtime код, но тесты ожидают старую строку \`saveEpsWithPreflight\` или старый URL \`bootstrap-watchdog.js?...alpha.31\`.
- **Причина:** изменение API/UI без синхронного обновления test contracts; тесты не всегда были достаточно семантическими.
- **Примеры:** alpha.25 первая PR сборка потребовала обновить EPS-save тесты; alpha.32 [workflow 39945861064](https://github.com/tohaa28/relief-forge/actions/runs/39945861064) упал на ожидаемой старой версии watchdog после bump.
- **Метод:** обновить assertions, но **не ослаблять проверку инвариантов**: сохранять тест «Save не делает повторный Rust worker call», «out-of-date preview не экспортируется»; check version strings централизованно.
- **Статус:** исправлено в последующих сборках; правило для каждого релиза обязательное.

## F-021. CI alpha.33: «Invalid or unexpected token» и 6 неуспешных тестов
- **Наблюдение:** [workflow 39947783929](https://github.com/tohaa28/relief-forge/actions/runs/39947783929) / build job 120394574782 — 141/147 JS, 6 FAIL; несколько импортных тестов завершились \`SyntaxError: Invalid or unexpected token\`, отдельный watchdog-тест ожидал \`alpha.32\` при \`alpha.33\`.
- **Причина:** синтаксическая регрессия/некорректный токен в промежуточном коде теста/импорта плюс забытый ожидаемый номер asset; точную строку неисправного кода из одного общего сообщения CI **не выводить как доказанную**, пока diff/trace явно не проверены.
- **Решение:** исправлен код в последующих коммитах, обновлён version test; [PR CI 39947972199](https://github.com/tohaa28/relief-forge/actions/runs/39947972199) и [main deploy 39948169551](https://github.com/tohaa28/relief-forge/actions/runs/39948169551) success, 171/171 JS, 15 Rust и WASM PASS.
- **Правило:** после каждой неудачной сборки записывать run/job ID, **точный упавший тест**, гипотезу и отдельное подтверждение следующей зелёной сборки. Не забывать отменённые runs: \`cancelled\` ≠ \`failure\` ≠ \`success\`.

## F-022. Вирусные/внешние рекомендации «сделать Boolean без Clipper» и «упростить все кривые в SVG»
- **Статус:** **технически отвергнутый подход**, а не воспроизведённая программная ошибка.
- **Почему нельзя:** соединение под-путей не удаляет внутренние перекрытия; полная полигонализация рисует «новые узлы» и ломает точный редактируемый Bézier-контракт.
- **Принято:** Clipper только для топологии заполненного силуэта → защита hole/XOR → refit к редактируемым C → диагностика ПОСЛЕ → Save cached snapshot.
- **Проверять:** число реальных командных узлов, число отверстий, площадь/симметрическую разность, исходную заливку и сохранённую обратимость.

## F-023. Документационное изменение не удалось записать из-за JS-шаблона инструментов
- **Симптом (текущая docs-сессия, 2026-10-23):** попытка сформировать текст инструкции \`AGENTS.md\` внутри \`String.raw\` с необработанными вложенными Markdown обратными кавычками закончилась \`SyntaxError: Unexpected identifier 'docs'\` ещё до вызова GitHub API.
- **Причина:** в JavaScript backtick завершает строковый шаблон; блок документации с \`AGENTS.md\` без экранирования интерпретируется как код. GitHub-файл не был изменён этим неудачным вызовом.
- **Принятый метод:** экранировать вложенные backticks \`\\\`\` или формировать Markdown массивом строк, не хранить сам текст со смешанными delimiter-ами как неподготовленный JS template literal. Повторная операция успешно обновила \`AGENTS.md\`.
- **Защита:** отдельно проверять tool input syntax и фактический commit SHA GitHub; «я попытался записать» ≠ «изменение появилось в репозитории».
- **Статус:** исправлена операция текущей сессии, урок зафиксирован.

## F-024. GitHub fetch branch-name с косой чертой был неверно закодирован
- **Симптом (текущая docs-сессия, 2026-10-23):** обращение к \`/branches/feature%2Falpha33-corel-lowercase-c-eps\` через универсальный GitHub fetch вернуло \`INVALID_ARGUMENT: invalid repository path\`.
- **Причина:** конкретный GitHub connector валидирует path branch URL, и не всегда принимает encoded slash в branch endpoint. Существование ветки этим не опровергается.
- **Принятый метод:** брать ветку и SHA из валидных fetch на \`main\`, PR metadata (\`head.sha\`) и \`fetch_file({ref: branch})\`; не делать вывод «ветки нет» из невалидного URL.
- **Защита:** использовать официальные схемы вызова инструментов и ссылку PR как ground truth; состояние новой ветки проверять по возврату create/update_file.
- **Статус:** рабочий обход применён; поведение endpoint — ограничение конкретного коннектора.

## Правило открытия нового инцидента

Создавайте \`F-0NN\`, а **не исправляйте старую запись**:
\`\`\`text
Номер и дата:
Вход: имя/размер/формат/SHA256 или fixture (без приватных байт):
Симптом и точно измеренные величины:
Среда: version, git SHA, browser/GPU, CI run/job:
Гипотезы (отделены от фактов):
Проверенные неудачные способы (код, эффект, почему отвергнуты):
Подтверждённая причина (если известна):
Изменение/PR/коммит:
Тест до и после, результат:
Проверка CI и Pages, отдельно реальный пользовательский ПК:
Ограничения и риск повторения:
Статус и следующая проверка:
\`\`\`

**Никогда не удалять неудачный путь из истории только потому, что найдено решение.** См. [WORKLOG_PROTOCOL.md](WORKLOG_PROTOCOL.md) и [METHODS_AND_DECISIONS.md](METHODS_AND_DECISIONS.md).

## F-025. Closed contour windows falsely reported as open
- Confirmed on private 8049569(1).eps: 2444 sampled vertices exceeded 2000 WASM limit. Two open windows became two false open markers in AFTER; their starts correspond to screenshot.
- Rejected approach: mark each window closed (invents chords); hide every open issue (conceals actual gaps); enlarge tolerance (changes geometry to mask bookkeeping error).
- Fix alpha.34: explicit source provenance + common mapping for both stages, one report for genuinely open source, last→first edge retained for closed source. Exact endpoint return without Z is geometrically closed in diagnostic copy only.
- Tests: diagnostic-topology, real WASM private EPS before/after 0 issues, partial inter-batch status preserved.
- Independent optimizer guards reject new sampled intersections/short segments/topology changes; numeric, not analytic guarantees. Browser and CI outcomes in DEVELOPMENT_LOG.

## F-026. Browser CI stage combined installation and smoke, obscuring a long dependency setup (non-failing but costly)
- Observation: alpha.34 PR CI run 39954313037 step 'Browser smoke with real Worker and WASM' began 12:34:37Z; Chromium download began only at 12:48:10Z and actual browser PASS was logged 12:48:21Z. Whole run succeeded. During those 13+ minutes GitHub displayed one in_progress step without separate setup/smoke evidence.
- Cause established to extent available: time spent before Chromium download in the combined Playwright dependency preparation; the logs do not isolate apt network versus package installation. This was NOT a failing test or a hanging application.
- First intervention: split 'install-deps chromium' (8m budget), 'install --only-shell chromium' (8m), and 'node scripts/browser-smoke.mjs' (8m). Outcome: new PR run 39956129539 SUCCESS; retain all required real browser tests, do not replace with mocks.
- Rejected: bypassing smoke to merge; declaring in_progress a CI failure; deploying from an untested newer commit. Private EPS remains excluded.
- Future regression guard: record timing per CI stage; if runner lacks Chromium shared libraries, dependency setup must fail explicitly and be investigated. Never infer user Windows success from CI Linux Chromium success.

## F-027. Пиктограмма и подпись кнопки выходят за её границы / исчезают при изменении надписи
- Симптом: у кнопок масштабирования одновременно картинка 20px и literal знак плюс/минус в фиксированных 36px; содержимое перекрывается. При раскрытии панели Сведения присвоение textContent стирает SVG child. Тесные пунктовые действия с flex:1 min-width:0 потенциально выдавливают иконки в соседний текст.
- Подтверждено чтением web/index.html, web/style.css, web/app.js alpha.34. Визуальный браузерный smoke после исправления выполняется в PR CI; пользовательский Firefox Windows пока не проверен.
- Неудачные/отвергнутые методы: единое overflow:hidden для всей кнопки скрывает функциональную подпись, изменение изображений теряет утверждённые оригиналы, дополнительный SVG overlay внутри canvas попадал бы в сохранённую геометрию; вместо этого компоновка и семантика.
- Alpha.35: icon-only zoom, текст только в отдельном span toggle-info-label, flex-wrap для узких панелей, display:text ellipsis для имени загруженного документа вне SVG; новый тест layout в Chromium на разных ширинах.
- Повторная проверка: реальная навигация и значки при ширинах 1440/1024/820/390px, имя после успешного импорта/отмены, Ctrl+F5 на Firefox пользователя, никакой модификации EPS/SVG геометрии.

## F-028. EPS after Boolean Union can contain more editable nodes than BEFORE/AFTER summary
- Customer observed excessive new nodes in exported result; exact bytes not uploaded in this session. Source-level root cause: pre-Union optimization statistics advertised while Clipper flattened filled Bézier geometry into more L commands. Safe refit may reject simplification and leave the inflated commands. No final real-command budget existed before EPS serialization.
- Rejected: merely changing status numbers, loosening topology criteria, exporting sampled points or a raster screenshot. Implemented: source/preUnion/postRefit budget with rollback of node-growing Union, explicit UI warning; serialized M/L/C/@c compared with cached After snapshot before download; color and Undo preserved. Synthetic and Chromium regressions required; external Corel and user's private files unverified.

### F-026 incident 2026-10-23: Ubuntu apt mirror delay
- Main CI #39956907984 failed at Playwright install-deps after 8 minutes, while downloading Ubuntu fonts/glib packages. Confirmed action timeout, not application browser failure. The dependency timeout has been increased to 20m; no test skipped. New PR CI must verify this workaround.

### F-028 final alpha.35 status (2026-10-23)
- PR #44 merged, CI #39961633180 passed 193 JS, 15 Rust, WASM, real Chromium smoke; main build/deploy #39961788762 SUCCESS. This verifies synthetic and application smoke paths, not the absent private customer EPS output. If user still sees extra nodes, require exact pair before changing interpolation again; other importers may translate PostScript paths differently.

### alpha.36 additional observations (2026-10-23)
Recovered actual source/result attachments from latest chats. Actual kalin EPS browser: 3152 source anchors -> 1972 pre-Union; rejected dense Union/refit at 21872 anchors; AFTER has 3 residual issues and explicitly partial coverage, not a false claim of clean geometry. Both EPS save choices passed actual download. Actual 8049569 EPS: 765->688 anchors at .02 mm, 0 AFTER issues, partial coverage. Source-owned 2444-node circle and 1440/1024/820/390 toolbar tests pass in Windows Chromium. 195 JS pass. Private files remain ignored.
New Rust broad phase rejects only point pairs outside tolerance and segment boxes separated beyond overlap tolerance plus parametric endpoint roundoff; original predicates and deterministic output order preserved. Added native boundary/near-parallel/backtrack regressions and independent old/new WASM comparison script. Fresh Rust/WASM validation still pending CI; baseline downloaded published WASM ABI passed, not a newly compiled build. verify-example first tried narrow EPS readers on painted private input and correctly refused; recovered full imported project through actual application Worker, then ran algorithm matrix. Earlier initial 5 JS failures are prerequisites/version/docs/static assertion corrections, final 195/195.

## F-029. Selection changes left a stale all-object AFTER candidate
2026-10-23: list/filter handlers only rendered; preview/export settings did not fingerprint actual selected object indices. Reproduced during selected-mode matrix expansion. Fix: schedule recalculation on list/filter selection, store scope in both small/large preview stats, reject Apply/Save if current selectedVectorIndices differs. Tests: selected-scope unit plus actual browser-mode-matrix. Cross-batch diagnosis remains partial; no implicit claim of new geometric certification.

### alpha.36 main publication gate failed (2026-10-23)
PR48 merged d3e9230; main run39983346199 FAILED, deploy skipped. Native17/JS196/WASM/primary browser passed; mode matrix timed out at second project download (line51). Unlike earlier successful PR and Windows runs, editor-close debounce180ms could survive into async import/reopen and momentarily make shortcut save run while busy. Source correction cancels the prior settings debounce when starting a new import, because import already schedules its own diagnosis. Mode regression waits for editor-close debounce and async file stream before asserting download; all eight modes remain mandatory. No deployed claim; previous alpha.32 still live until successful main deploy.

## 0.2.0-alpha.36 — publication and live-site verification SUCCESS (2026-10-23)
- Functional PR48 https://github.com/tohaa28/relief-forge/pull/48 merged d3e9230e931a20629933cdd007ed4842be0ae6a8. Initial main39983346199 FAILED the mode-matrix project-save race and did NOT deploy. This remains historical, not reclassified as success.
- Follow-up PR49 https://github.com/tohaa28/relief-forge/pull/49 merged 005866ff9bb503a9ab42e0719d2991d5c3479f43. Final PR CI https://github.com/tohaa28/relief-forge/actions/runs/39983892161 SUCCESS; earlier superseded fbf0df3 CI39983756498 CANCELLED (not passed).
- Main production https://github.com/tohaa28/relief-forge/actions/runs/39984099761 SUCCESS: build and deploy. Site https://tohaa28.github.io/relief-forge/ is alpha.36. Fresh Rust17/17, JS196/196, WASM ABI and actual primary+8-mode Chromium browser gates PASS.
- Independent Windows Chromium LIVE site test after deploy: private kalin original3152 -> AFTER1972 anchors; both downloaded outline and original-color EPS parsed directly and each contained exactly1972 m/L/C anchors; project also1972 commands, Undo history retained, no pageerror. This resolves the observed old-result21872 growth on that input. Other private EPS checks and four-tolerance/Union matrix recorded above. Private binary/screenshot evidence remains local ignored; never commit original geometry.
- Native kernel old/new JSON identical121cases; measured2000-node ring1500->37ms (~40x), repeated1470->26ms (~56x), NOT an end-to-end app speed guarantee. Bounds computed once per batch instead of per marker.
- Confirmed fixes: false opens from split windows; lowercase Corel curves; independent optimization safety; post-Union node growth guard; exact serialized AFTER; preserved/wrapped button icons; source filename; actual selected-object scope invalidation; stale import settings debounce cancelled. Save EPS preserves established exact-snapshot commit+Undo contract.
- Limits: private kalin AFTER retains3diagnostic issues and partial cross-batch coverage, explicitly warned; no mathematical certification of arbitrary curves. Native/kernel/source-owned/browser coverage documented, not a claim of all possible files. Firefox failed to launch locally (spawn UNKNOWN) and is NOT user-verified. ArtCAM/Corel external-app importer not newly verified.
- Next independent improvement: inspect3remaining kalin issues against real curve semantics; extend complete cross-batch relationships with performance measurements. Keep current safe partial-coverage warning until full coverage is actually established.

## F-030. Zoom icon PNGs contain clipped glyphs and neighboring UI pixels
2026-10-23: direct pixel inspection of original zoom_plus.png and zoom_minus.png confirms clipping baked into pixels, so alpha.35/36 CSS bounds assertions could pass without repairing content. Previous CSS-only approach insufficient. User explicitly requests corrected +/- controls. Replace only their usage with complete native SVG signs (24x24 viewBox, centered paths, stroke within bounds); original approved PNG/ZIP/hashes untouched. Static vector-content regression plus real browser viewBox click/restore and viewport geometry checks required.

## F-031. Intermediate optimization node ceiling prevents valid overlap healing
2026-10-23: actual8048531 source439/43issues ->preUnion272/16 ->valid refitted Union396/0 complete. Alpha.36 incorrectly rejected396>272 even though396<439original. Final budget now uses original document ceiling, allowing necessary Boolean cut anchors without unbounded polygonization. Kalin3152->21872 remains rejected. Rejected alternative: remove guard, loosen geometric tolerance or claim Union applied while exporting preUnion. Tests cover allowed source100/pre40/final70, rejected final101, true filled Union with holes and exact EPS roundtrip. At .005 actualsample still rejects a denser Union and explicitly leaves16issues; do not claim clean for every setting.

### F-029 compound normalization scope incident (alpha.37)
The final per-object compound-normalization loop did not check original selected indices after merging/removing other objects. Track eligible object references including selected replacements; unselected compound geometry must stay byte-identical. Dedicated synthetic selected-only regression added.
