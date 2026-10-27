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

## F-032. A covered zero-area return contour survives whole-Union fallback
Actual min EPS alpha37 retained3overlaps from a closed linear A-B-A contour lying on a surviving boundary. Whole Union/refit added21861anchors and rightly fell back to1970; disabling the node guard is rejected. Fix uses exact native-command collinear interval coverage inside one filled unstroked compound object; removes covered closed linear return contours only when every interval is already covered by nondegenerate surviving geometry. No diagnostic-tolerance snapping, flattening, removal of uncovered guides or mutually justifying duplicate degenerate rings. Curved loops, strokes, masks and near-parallel segments preserved. 7unit regressions + actual WASM three-overlap->zero + silhouette XOR0 + EPS roundtrip + UI Undo gate. Whole-document cross-batch flag remains partial.

## 0.2.0-alpha.38 — covered segment retraces PUBLISHED and LIVE verified (2026-10-23)
- Functional PR53 https://github.com/tohaa28/relief-forge/pull/53 merged db3ce8180f8bc458200aed4571db01038f0e598a; source checkpoint3b95875c316c60518095407eb7a6932305fde365. PR CI https://github.com/tohaa28/relief-forge/actions/runs/39995831886 SUCCESS:206JS/17Rust/freshWASM, new covered-retrace fixture3overlaps->0complete and XOR0, browser actual repair count/BEFORE-AFTER/Apply/Undo/EPS, existing8-mode/node-editor/project/PDF and true-Union/hole gates. Main Pages https://github.com/tohaa28/relief-forge/actions/runs/39996031307 build SUCCESS and deploy SUCCESS.
- Live https://tohaa28.github.io/relief-forge/?v=alpha38 independently checked with the actual supplied min EPS in Windows Chromium. Original3146anchors -> AFTER1967, reported remaining3overlaps->0; exactly1covered repeated closed line/3nodes removed. Both actual saved EPS modes contain1967anchors; live outline bytes EXACTLY equal the independently verified local contour-only output. Confirmed partial-coverage warning remains before export, explicit user-style override in browser test; no pageerrors. Actual Undo restores3146original anchors and Redo restores1967applied anchors, checked through saved project geometry. Live cold import+processing6782ms; local2995ms vs previous3111ms, no universal speed claim.
- Algorithm F-032: same-object native closed linear return contour may be removed only if every projected collinear interval is already covered by nondegenerate surviving boundary geometry; numeric roundoff bound independent of user diagnostic tolerance. Straight Bezier control hull may provide coverage; curved loops, strokes, unsupported paint/masks, standalone/uncovered/near-parallel/gapped traces retained. Degenerate contours do not justify deleting each other.2Mnative comparisons budget; incomplete proof leaves contour unchanged and records skipped limit. Source, paint, controls, translations, selected scope and exact AFTER/EPS/Undo contract preserved.
- Actual helper-only filled silhouette XOR0mm². Isolated affected optimized object1875sampled points: complete WASM3overlaps->0; all individual final objects independently complete/0. Whole-document interaction coverage across batches remains PARTIAL, never advertised complete. Whole Clipper Union21861still correctly rejected vs original3146; native local repair succeeds while preserving original-node guard.
- Prior cases:8048531 still439->396/0complete,20outer/10holes and prior refit XOR bound preserved. Prior kalin now3152->1969/0sampled issues partial, removing the same1covered return contour, while21872Union growth remains blocked. Old alpha36/37 notes saying3residuals are historical.
- Verified contour-only user output outputs/min_result.eps is local-only, not committed or uploaded. No private input/vector bytes in Git. Regression inputs are source-owned synthetic rectangles/return paths. Full method and conservative skip cases in web/covered-retraces.js, tests/covered-retraces.test.mjs and scripts/verify-retraces.mjs. All release/cache versions synchronized to alpha.38; approved raster assets and native +/- signs retained.
- Next independent work: full cross-batch relationship verification and optional handling of uncovered/stroked retraces require separate semantic decisions; do not silently remove guide lines or weaken original-node/tolerance/coverage gates. Firefox/user external CAM importer not newly verified. Canonical runtime merge db3ce81; documentation-only follow-up can advance main without changing runtime.

## F-033. Curve-clearance false zero at an exact endpoint-return seam without Z
2026-10-23 alpha39 candidate: synthetic square ending L0,0 rather thanZ produced1false pair marker (13/14new tests passed). Native subpath adjacency relied only onZ despite exact geometric closure. Fixed finish logic recognizes exact first/start equals final/end world coordinates for exclusion of ordinary closure neighbors. Does not mutate model or suppress nonzero real gaps;0.05mm gap companion still yields1marker.14/14newtests and actual Chromium clearance PASS. PR55 latest-head CI required; earlier219-test source checkpoint9c8a6bc not published. Different-object contacts still measured; no global same-coordinate suppression. Full chronology in DEVELOPMENT_LOG.

## F-034. Pairwise segment endpoint minima falsely count neighboring nodes as narrow places
2026-10-23 user alpha39 report reproduced: dense81node straight curve703false marks, normal500edge circle3000cap, segmented parallel neck152instead of1. Immediate-index exclusion was insufficient; true segment-pair distance at an endpoint is not necessarily minimum on the continuous contour. Added incident-direction contour minimum check, interior actual witnesses for parallel ties, and connected narrow-zone aggregation with actual native below-threshold joint-boundary proof. Initial adjacency-only grouping incorrectly merged two separated necks1instead of2; regression retained and fixed. Final20distance tests pass, new browser requires actual dense BEFORE0, parallel neck1true.05mm, separated necks2. One lexical SVG command-count browser check initially failed on valid compressed repeatedL syntax; native parser now checks80Lsegments. No geometry/EPS change; thresholds not shrunk. CI/publication pending; source min2287->18zones complete106ms. Full limits/methods in DEVELOPMENT_LOG; do not revert to arbitrary node-count exclusion or merely hide markers.

## F-035. Named PDF layers lose root namespace during standalone SVG fragment import
2026-10-23 supplied11604byte PDF fails alpha40 with "Некорректный SVG". Real MuPDF conversion valid rootSVG, named OCG layer g has inkscape:groupmode/label with namespace inherited only from root. Object extraction omits that declaration, strict browser rejects independent fragment during paint/safeFragment/openValue. xmldom permissiveness hid missing browser coverage; old simple PDF had no layers. Fix ONLY PDFpipeline: copy same root layer namespace onto each prefixed g before generic importer. Preserve all geometry/metadata/paint; shared SVG/EPS/repair/narrow-feature logic not modified.3realMuPDF unit tests + actual browser prior-error reproduction/layer/text/scale/images/multipage/cancel/invalidheader/Undo/Redo/EPS/project/visual checks PASS. Actual PDF396native anchors,49.789856x26.65857mm, old optimizer245anchors, exact Undo/Redo. No private geometry committed. Reject disabling parser checks, rasterizing page, stripping labels or changing shared reader. FreshCI/publication pending; full log in DEVELOPMENT_LOG.

## F-036. Single manual production cold EPS preview timeout, not reproduced on same-build retry
2026-10-23 alpha41 after PDF-only release6a0557f: extra old private min EPS live smoke timed out120000ms at waitForFunction automatic preview. First attempt had no request/status tracing, so cause UNKNOWN; do not label it network, geometry or a code regression without evidence. Same input verified byte-identical177619bytes to previous private imported source. Immediate same-revision retry with requestfailed and status watchdog PASS8072ms cold import+processing+three clearance views; no requestfailed logged. Both EPS1967exact prior outline bytes, original18/AFTER16neck zones, Undo3146Redo1967, warning/stale-worker guards, no JS errors PASS. No EPS/shared/vector code changed (exact alpha40 after version-key normalization), no diagnostic limit lowered, all PR/main/native/WASM/old browser gates passed. Preserve both runs; observation not currently reproducible, no broad performance guarantee. If repeated, collect stage/request/error evidence before altering pipeline; current user authorizes PDF-only changes and says other functionality works. Full record DEVELOPMENT_LOG.

## F-037. Polyline diagnostic crossings reported as native Bézier self-intersections
2026-10-26 gerb alpha41: all5AFTERself messages on3parts separated on original native intervals by .00118-.00270mm, positive lower bounds with<1e-8mm intervals. Exact subdivision/provenance reconstructed and asserted for1242parts; bounds-only misplaced=0 did not detect false classification.297coincident pairs contain inserted samples; do not call them pairs of editable anchors.1096inter-object reports are near-zero native contacts, mostly duplicate-related, not wholesale false positives. Source-owned chord fixture gives proxy crossing while native gap.0065mm. Fix direction native param provenance/refinement; no runtime fix in this investigation. Full report GERB_DIAGNOSTIC_INVESTIGATION_20261026.md.

## F-038. Whole Union rollback restores already verified exact duplicate removals
2026-10-26 gerb:35exact native opaque copies/602nodes, Union removedExact35, but other normalization adds23225totalnodes vs11493source. Original-node guard correctly rejects entire candidate, returning preUnion including35copies. Independent exact-copy experiment93->58objects/XOR0 at.005mm sample and.00001mm grid. Separate safe exact dedup and scoped rollback needed, not weakening F-028. Cross-batch partial diagnosis detects only19/35objectpairs and at.005mm none; warning honest but incomplete coverage remains. Investigation only, original runtime unchanged.

## F-039. Combined-document quality sampler cap rejects even unchanged large geometry
2026-10-26 gerb independent quality acceptedfalse solely 'Кривая слишком сложна' at.0025mm,20000pointcombinedpath cap; all smoothing/optimization rolledback though budget refusal does not establish deterioration. Source-owned3x7001node separatepaths with identical before/after reproduces same refusal. Scale postcondition via per-object/spatial pairs retaining global safety and partial status; do not disable validator or inflate limits blindly. Full evidence and no runtime fix in GERB_DIAGNOSTIC_INVESTIGATION_20261026.md.

## F-040. ubuntu-latest 26.04 outgrows pinned Playwright browser registry
2026-10-26 PR61 CI40291584782 failed browser installation with ERROR Playwright does not support chromium-headless-shell on ubuntu26.04-x64.229JS/native17/freshWASM passed; browser not run, no deployment. CI-only exact Ubuntu26.04/x64 host override selects existing24.04 browser build, preserving dependency validation and all actual browser gates; explicit caller override untouched. New CI must prove compatibility, not assume official26support. No application runtime change or dependency upgrade; source findings F-037..039 independent.

### F-040 verified follow-up2026-10-26
Sourcea17c773, PR61 CI40292188928 SUCCESS56sbuild/59srun with all actual browser gates,229JS17RustfreshWASM; previous40291584782 remainsFAILED. ExactUbuntu26/x64 CI fallback to existing24 browser observed compatible on runner; no general official26 support asserted, no application behavior changed.


## F-041. Aliased native rollback snapshot wrongly contained flattened Union vertices — PDF Undo silently ineffective
- **Symptom (2026-10-26, alpha42 PR #62):** actual Chromium PDF import loaded 108 editable native anchors, but post-Union node-budget diagnostic showed "optimized-node-growth" 108 → 481; cached AFTER stayed unchanged. Saving EPS generated no applied optimization snapshot; Ctrl+Z then undid the original import to an empty document. Browser PDF smoke failed even though 238 JS, 17 Rust and other browser checks were green.
- **Confirmed root cause:** `mergeOverlappingObjects` stored `const doc=exact.document` and returned `safeDocument:exact.document`; both referred to the **same mutable object**. Subsequent `doc.paths=` Boolean normalization contaminated the supposed pre-Union rollback snapshot with densely flattened curves.
- **Failed attempts recorded:** first reordered Union ahead of smoothing but retained global rollback; second introduced native fallback optimization, but it still read aliased already-flattened source. Earlier CI 40306355892 failed PDF Undo, and targeted instrumentation in CI 40307425158 exposed the exact 108 → 481 misuse.
- **Fix:** deep-clone the verified native-only document *before* any group normalization or array replacement and return an independent `safeDocument`. On rejected over-dense Boolean result, safely optimize that native snapshot and preserve exact opaque duplicate removals. Regression: `tests/union-first-alpha42.test.mjs` verifies original compound Bézier commands remain byte-identical when union result is mutated; full real PDF Worker/Undo test checks 108 original → 103 AFTER, Undo restores original curves/paint exactly.
- **Protection / verification:** PR #62 merged `3dd7099`, full PR CI [40307674333](https://github.com/tohaa28/relief-forge/actions/runs/40307674333) SUCCESS 238 JS/17 Rust/fresh WASM/all browser gates; main [40307945350](https://github.com/tohaa28/relief-forge/actions/runs/40307945350) build+deploy SUCCESS.
- **Status:** fixed for covered scenarios; independent user's private `gerb.eps` was not re-tested. Do NOT remove this state-isolation test, weaken original-node ceilings or claim native Bézier intersections F-037 are repaired.


## F-042. Global Boolean rollback erased independent valid groups (alpha.42)
- **Observed:** on the private coat-of-arms `gerb.eps`, after safe exact dedup the Union normalized multiple compound filled objects into thousands of sampled polygon anchors. The old one-document node ceiling correctly blocked whole-candidate inflation, but also discarded independently valid Boolean groups. Earlier standalone export showed 58 objects, 452 remaining issues, and native anchors equal to safe dedup+point cleanup rather than substantial accepted area welds.
- **Incorrect method:** either disable the global node budget or accept entire 20k+ sampled Union polygon geometry; would reproduce F-028 and potentially corrupt detail.
- **alpha43 solution:** `assessUnionGroup` validates each independent connected Boolean group and each single-object compound normalization after Bézier refit, with both bounded local growth and unchanged whole-document node ceiling. Successful groups stay in the AFTER snapshot; failed groups retain native original paths. No new unchecked geometry is accepted; native exact duplicate removal remains independent.
- **Verification:** PR64 / CI40316932711, 245JS/17Rust/freshWASM/all browser gates; scoped-union regression on overlapping rectangles, cubic rejection, EPS identity. No direct private `gerb.eps` test in this release and no guarantee that every complex group now merges.
- **Status:** addressed for covered cases. Full exact Bézier Boolean reconstruction is still an unresolved separate development task.

## F-043. WebGPU compute precision and hardware availability (alpha.43)
- **Requirement:** user requested GPU processing for Doctor Uzelkov, specifically on available NVIDIA-class GPUs.
- **Risk:** shader floats are f32 and can miss narrow near-coincident Bézier boundaries if unpadded. GPU driver support varies by browser/OS, and GPU readback/initialization can cost more than CPU broadphase on small logos.
- **alpha43 method:** WGSL compute handles only candidate control-hull AABB pairs, conservatively padded to overselect. GPU cannot independently delete a path, accept a Union, move a node or author EPS; CPU f64 and Clipper own all such steps. Unsupported devices, invalid coordinates, small or very large documents and GPU errors use deterministic CPU fallback; GPU status visible in application.
- **Evidence:** fake WebGPU adapter/device regression dispatches 256 candidate flags and checks returned pairs; real Rust/WASM and browser EPS PDF tests pass in CI40316932711. CI does **not** contain NVIDIA GTX1080/RTX3050 benchmark or proof of active hardware GPU shader execution. No performance/speedup claim.
- **Status:** WebGPU broadphase implemented with CPU fallback and simulated compute test; live hardware GPU acceptance/benchmark pending.


## F-044. Original ДО auto-switched to ПОСЛЕ and lost immutable imported error context
- **User-observed problem:** after opening EPS/PDF/SVG, background point repair/Union preview and AFTER diagnosis forced `compareStage='after'`; ДО could reflect the *last current working document* rather than the originally imported input after later edits or repeat calculation. Original error markers were not stored as a dedicated immutable baseline.
- **Root causes:** ordinary and large preview builders both forcibly selected AFTER; `checkPreviewAfter` also selected AFTER when the asynchronous diagnostic returned. Previews constructed `beforeDoc: clone(doc)` and `beforeIssues:clone(issues)`, which were not guaranteed to represent the first import after editing.
- **Fix in alpha.44:** capture native import snapshot in `beginImportBefore` at a successful `openValue`. Cache the **first** original Rust/WASM diagnostic issue locations and partial coverage flag in `captureImportBefore`. Build all later comparisons using `importedComparison`, preserving native commands and primary rings across DO→AFTER→DO, edited current docs and Undo. Async repairs and AFTER diagnostic no longer steal selected stage. A new import replaces baseline; a new blank document clears it. EPS still exports cached AFTER, not DO.
- **Failure/test history:** first CI40319459488 245/248JS due old tests and docs; CI40319662440 248/248JS but browser-smoke still assumed auto AFTER; CI40319990699 passed new real browser synthetic duplicate markers (17) but another mode matrix assumed save kept DO instead of applying AFTER; corrected tests explicitly switch AFTER for AFTER-export checks and verify DO snapshots separately.
- **Verified:** PR66 source-head CI40320220363 **SUCCESS**: 248 JS, 17 Rust, freshly compiled WASM, real-browser 17 original marker retention, large EPS, PDF, 8-mode matrix, EPS AFTER snapshot, Undo/Redo. Main Pages build/deploy40320407500 **SUCCESS**.
- **Status:** resolved in tested alpha.44 import routes; private user gerb.eps visual check remains for user acceptance. Never revert to implicit AFTER selection or overwrite original marker cache with a later diagnosis.


## F-045. Tiny CNC subpaths survived Union/optimization, while naive cleanup could erase important geometry
- **User-observed requirement:** the private gerb case contains tiny isolated 0.1×0.1 mm-scale details, including nested closed subpaths inside compound objects. Remaining geometry must be safe for CNC milling. Unconditional small-segment deletion or area-only filtering risks corrupting long thin channels and deliberate engravings.
- **Unsafe rejected methods:** sample curves into polylines and measure sampled point bounds (can miss true Bézier extrema); compare only area/perimeter (deletes long thin slots); treat whole compound element as one piece (fails to clean internal tiny details); edit imported DO or re-run filtering during EPS export (causes UI/EPS mismatches). Also avoid silently flattening masks or groups with independently styled children to a single fill.
- **alpha45 fix:** perform exact Q/C derivative-extrema bounding-box calculation in native millimetres and test **width < userWidth AND height < userHeight**, with a floating-point boundary guard. Split whole native paths by M/Z, remove only closed subpaths that meet BOTH tests; preserve open contours, unaffected parts, source appearance/fill-rule where reconstructible. If compound appearance is ambiguous, refuse only partial deletion with a skipped-unsafe count, not a guess. Settings default enabled, 0.1×0.1mm; user may disable/configure both axes. Operates on optimized AFTER before diagnosis; same snapshot written to EPS. DO never filtered.
- **Test/failed attempt chronology:** initial browser test CI40324609454 got 255/255 JS and 17/17 Rust but incorrectly checked former preview immediately after changed settings before 180ms UI debounce. Updated browser test waits for the new recalculated status, not a stale 'Предварительный' status. Final CI40325111904 **SUCCESS**. Chromium explicitly toggles filter and thresholds and validates the exported EPS has only the large remaining native subpath. Production GitHub Pages CI40325275316 **SUCCESS**.
- **Remaining limitations:** unsupported heterogeneous-multi-element styling is protected by refusal to partially reconstruct; no live run on private gerb.eps or actual CNC toolpath simulation. Extrema protection does not replace separate correctness checks for intersections/clearance/Union and should never overrule them.
- **Status:** implemented and verified by unit/browser regression for supported native vectors in alpha45.


## F-046. Conflicting default ДО requirement vs user-selected new default ПОСЛЕ — never corrupt original snapshot
- **User specification changed, 2026-10-27:** alpha44 stored and displayed source ДО by default; alpha46 must show finished ПОСЛЕ automatically. The earlier full requirement for immutable imported ДО geometry and first error rings remains in force.
- **Dangerous implementation to avoid:** replacing stored `importedBefore` with optimized AFTER when switching defaults, or forcing compareStage after every asynchronous process, which would steal a manually requested ДО. Also do not set an uncompleted preview as processed.
- **alpha46 correction:** initial import remains in ДО during first source diagnostic; ordinary/large preview selects AFTER only once calculation is available if `comparisonSelectionExplicit` is false. Button clicks mark explicit operator preference; delayed settings recalculation, source check and after-diagnosis preserve that selection. Original DO geometry and native issue locations unchanged. EPS always exports approved AFTER snapshot. Closing comparison/editor does not mutate source.
- **UI relocation:** manual repair actions were moved, not duplicated; same eight data-action callbacks/hotkeys now inside the actual curve-editing toolbar's dropdown. The workspace field check is an aria-labeled rightmost square icon; HTML/CSS and responsive browser tests verify alignment and clipping. Add and delete use hotspot-centered crosshair +/X SVG paths (instead of font/minus).
- **Failure history:** first CI [40465038832](https://github.com/tohaa28/relief-forge/actions/runs/40465038832) failed three outdated static/VM harness assumptions; fixed assertions/stub without weakening original-import, geometry or EPS checks. Final CI [40465207030](https://github.com/tohaa28/relief-forge/actions/runs/40465207030) PASS 259JS+17Rust+WASM/Chromium; main Pages [40465418747](https://github.com/tohaa28/relief-forge/actions/runs/40465418747) PASS.
- **Status:** interface requirement implemented and tested on source-owned samples, user's own live/browser screenshot not inspected after release. Rollback alpha45 `4853b96`.


## F-047. Import appears frozen: unbounded GPU await and synchronous large complete-diagnostic preview (alpha.47)
- **Reported by user:** since alpha.46, program could stop responding when opening files. Their graphics driver log/file was not provided, so the precise driver-level cause on the user's machine is not established. Two real source-code liveness risks were identified.
- **Risk A, WebGPU:** `gpuBroadphase` used unbounded `await navigator.gpu.requestAdapter()`, `await device.createComputePipelineAsync()` and `await readBuffer.mapAsync()`. If browser/driver never resolves any one, `buildUnifiedPreview` or `buildLargeUnifiedPreview` never completes, causing the user to see an import followed by indefinitely incomplete ПОСЛЕ. **Fixed:** `gpuBroadphase` now returns deterministic CPU candidate broadphase after 4500ms (optionally shorter for tests), preserving all conservative validation. Late GPU promises cannot overwrite the accepted CPU result.
- **Risk B, CPU:** when the initial Rust diagnostic was marked complete, even very large EPS sets took `buildUnifiedPreview` (single main-thread CPU pass) instead of the cooperative `buildLargeUnifiedPreview`. The newly default ПОСЛЕ display could expose this delay directly after opening a large file. **Fixed:** source diagnostic with `plan.totalPoints>2500` or `indices.length>150` enters progressive per-object route regardless of initial complete flag. Partial cases still use the progressive route; smaller documents remain on quick route. Whole-document Boolean operations remain CPU-bound and are not promised preemptible.
- **UI:** `#toggle-info > .tool-icon` explicitly vertically centered next to label and keyboard hint. The `#manual-repairs` popup was removed and replaced by a persistent second horizontal, responsive row directly below the move/add/remove and other curve node tools when `#curve-node-tools` is open; all eight actions and their native IDs/shortcuts remain unchanged.
- **Regression evidence:** tests/import-stall-alpha47.test.mjs simulates hung adapter and shader using never-resolving promises; full Chromium script injects never-resolving navigator.gpu adapter and confirms an 18-path SVG finishes import in ПОСЛЕ using CPU fallback. Another Chromium source-owned 2650-node contour exercises processing beyond progressive threshold, with EPS export/Undo and compare tests. PR #72 CI workflow 40473671985 **SUCCESS**: 263 JavaScript, 17 Rust, fresh WASM, real Chromium EPS/PDF/CNC/mode matrix plus hung GPU. Earlier PR run 40472921070 FAILED three stale UI/version tests, corrected before candidate acceptance.
- **Open:** cannot guarantee no freeze inside arbitrary Clipper/native synchronous computation; source gerb.eps and actual user graphics driver are not available as test artifacts. Record original filename, busy-stage label, GPU status and downloaded journal if a specific user file still stalls. Do not claim a measured NVIDIA driver fix until reproduced on that hardware.
- **Rollback:** release alpha.46 main `34de680`. Alpha.47 is not production until PR merges and GitHub Pages deploy passes.

**F-047 production qualification 2026-10-27:** functional PR72 merged as `1c555f7`; PR CI40474000366 SUCCESS, 263 JS/17 Rust and browser EPS/PDF/Undo; real browser hung-GPU test SUCCESS in CI40473671985. Production Pages build/deploy40474213728 SUCCESS. User's own file and driver still not independently reproduced.

## F-048. Native Boolean output still needs source provenance; numerical ambiguity must preserve original curves
2026-10-27, alpha48 candidate. Paper0.16.0 direct gerb Boolean ~1.9s yielded a micro-loop cubic with endpoint ~0.000005mm away from source branch. Independent de Casteljau matching rejects at2e-8mm. Scaling1000x reproduced, older0.12.18 sequential also rejected and slower (array operands unsupported). Do not loosen tolerance, flatten/refit, or erase original loop to clear diagnostic counters. Only exact source intervals/line interval coverage are eligible; necessary noninherited junctions require paired source witnesses. Independent Clipper sampled XOR/hole reference verifies filled result, never becomes stored output. Native intersection API has9unpaired source contacts on actual gerb: mark incomplete; optimizer refuses ambiguous contacts.
Initial prototype based on oldalpha41 was isolated locally at6f7459b, NOT released; fresh fetch revealed latestalpha47, port selected algorithms into fix/native-bezier-alpha48 and preserved all GPU/CNC/import/UI contracts. Avoid overwriting parallel newer history. New12native regressions include C/Q retention, necessary4cuts, tampered proof, line coverage, native markers and exactbothEPS. Current qualification tracked in DEVELOPMENT_LOG, no all-geometry analytic certification claim.
