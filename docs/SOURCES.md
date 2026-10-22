# Первичные источники, проверены 2026-10-22

- Autodesk ArtCAM 2018, Vector Doctor: https://help.autodesk.com/cloudhelp/2018/ENU/ARTC-ReferenceHelp/files/GUID-0D2701EA-45A8-4D69-8EF5-067164C50FAC.htm
- Autodesk, Join With Coincident Nodes: https://help.autodesk.com/cloudhelp/2018/ENU/ARTC-ReferenceHelp/files/GUID-727D25C2-342B-435A-93CC-4226114E8182.htm
- REA, официальный проект: https://github.com/morluto/rea
- REA Windows Ghidra boundary/configuration: https://github.com/morluto/rea/blob/main/docs/windows-ghidra-p0.md
- REA CLI: https://github.com/morluto/rea/blob/main/docs/cli.md
- Rust WASM target: https://doc.rust-lang.org/stable/rustc/platform-support/wasm32-unknown-unknown.html
- GitHub Pages workflow: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Готовые алгоритмы для следующего этапа

| Проект | Кандидат на использование | Статус |
|---|---|---|
| https://github.com/linebender/kurbo | Кривые Безье, геометрические примитивы | Первичный README просмотрен через поиск; код не интегрирован |
| https://github.com/jbuckmccready/cavalier_contours | Полилинии с дугами, эквидистанты, булевы операции | Документация найдена; API и WASM-сборка ещё не проверены |
| https://github.com/iShape-Rust/iOverlay | Полигональные булевы операции, самопересечения | Документация найдена; точность/топология на тестах ArtCAM ещё не проверены |

Выбор библиотеки будет принят после реальных сборок и тестовых кейсов, с сохранением лицензий и фиксацией версии. Нынешнее ядро написано самостоятельно, внешние алгоритмы пока не заимствованы. Нельзя заявлять, что ссылки или изучение README равны использованию REA/Ghidra.
