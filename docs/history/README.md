# История и передача контекста «Доктора Узелкова»

**Старт нового чата:** [docs/NEXT_CHAT_START.md](../NEXT_CHAT_START.md). Не начинайте с конца длинного старого HANDOFF: его исторические указания могут относиться к другим alpha.

| Файл | Содержимое | Изменения |
|---|---|---|
| [RELEASE_CHRONICLE.md](RELEASE_CHRONICLE.md) | Подробная история alpha.1–alpha.33, ссылки на PR, изменения методов и ограничения | Дополнять после каждой версии |
| [FAILURE_REGISTER.md](FAILURE_REGISTER.md) | Неудачи F-001–F-024, отвергнутые способы, причины, regressions, состояние | Добавлять записи, **не удалять** провальные попытки |
| [METHODS_AND_DECISIONS.md](METHODS_AND_DECISIONS.md) | Алгоритмы и rationale: EPS/PDF, CorelDRAW, Rust, Union, real Bézier, AFTER, экспорт, тесты | Обновлять при изменении архитектуры |
| [WORKLOG_PROTOCOL.md](WORKLOG_PROTOCOL.md) | Точный обязательный порядок работы с историей, CI, PR, checkpoints и пользовательскими файлами | Соблюдать каждый раз |
| [HANDOFF_ALPHA1_20261022_ARCHIVE.md](HANDOFF_ALPHA1_20261022_ARCHIVE.md) | Первый архив разработки (alpha.1) | Архив; не переписывать |

**Первичные источники:** [HANDOFF.md](../../HANDOFF.md) (накопленный исторический файл), [DEVELOPMENT_LOG.md](../DEVELOPMENT_LOG.md), [actions.jsonl](../../logs/actions.jsonl), [FEATURE_MATRIX.md](../FEATURE_MATRIX.md), Git commit history и Github Actions.

**Последняя функциональная контрольная точка на 2026-10-23:** 0.2.0-alpha.33, commit \`fee205c17a729ed246f0760f2cebd29352e73cd9\`; [PR #39](https://github.com/tohaa28/relief-forge/pull/39), [build + deploy success](https://github.com/tohaa28/relief-forge/actions/runs/39948169551), 171 JS/15 Rust/WASM PASS. Браузер проблемного ПК не проверен повторно после alpha.33.

Историю новых версий хранить в Git, а не только в чате. Не публиковать файлы заказчиков, оригинальные EPS, секреты, персональные данные и непроверенные бинарные артефакты. Синтетические тесты допустимы.

**Документационный checkpoint:** [PR #40](https://github.com/tohaa28/relief-forge/pull/40) merged, merge SHA \`f1f8a71b0f8b2d3f3575c496c2d0a4d0093548b0\`; [PR CI](https://github.com/tohaa28/relief-forge/actions/runs/39951134402): 176/176 JS + 15 Rust + WASM PASS; [main Pages CI](https://github.com/tohaa28/relief-forge/actions/runs/39951445491): build/deploy SUCCESS. Функциональная версия не менялась (alpha.33). Сверяйте более новые workflows перед новым релизом.

