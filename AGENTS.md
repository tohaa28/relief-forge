# Development rules

- Read docs/NEXT_CHAT_START.md, docs/history/FAILURE_REGISTER.md and docs/history/METHODS_AND_DECISIONS.md first; then HANDOFF.md and docs/FEATURE_MATRIX.md before making changes.
- Append each meaningful action, result, limitation and next step to logs/actions.jsonl and docs/DEVELOPMENT_LOG.md. Preserve existing entries. Never store credentials.
- Commit every verified checkpoint. Update Cargo.toml, Cargo.lock, package.json and the visible version together for each release.
- Treat source-written, native-tested, WASM-tested, browser-tested and published as separate states. Report only observed evidence.
- User requires Rust/WASM and REA + Ghidra investigation of ArtCAM 2018 vector healing. Do not pretend to have Windows access. See docs/REA_WORKFLOW.md.
- No changes to existing VectorForge, Макетная, PrintCheck, or other user repositories without a new explicit request.
- Preserve original curve geometry when the future curve model is introduced. Do not silently flatten or drop unsupported SVG data.
- Undo must cover every repair; preserve project history on save/reopen. Ambiguous topology requires explicit user choice.
- Keep binary analysis local under evidence/private (ignored by Git). Commit only source-owned test fixtures and reviewed observations.
- Required checks: cargo test --locked; npm test; WASM build; node scripts/check-wasm.mjs; browser smoke tests before declaring a working release.
- Do not deploy a build that fails checks. The user has authorized Git publication for this project; do not ask again once repository access is established.


## MANDATORY: exhaustive Git history + new-chat continuity (added 2026-10-23)

The user specifically requires **very detailed** permanent history of successful changes, algorithms, alternatives, failed attempts and their causes. This is part of the definition of done, not optional background documentation. Full protocol: [docs/history/WORKLOG_PROTOCOL.md](docs/history/WORKLOG_PROTOCOL.md).

For **every change**, including aborted prototypes and failed CI:
1. Record the problem, concrete input/test, measurements, root-cause certainty, attempted approaches **including what failed**, files/functions/algorithms, rollback, and why alternatives were rejected.
2. Append a dated entry to \`docs/DEVELOPMENT_LOG.md\` and a valid separate JSON object to \`logs/actions.jsonl\`. **Never delete old entries or retroactively disguise a failed run as a pass.**
3. For new/repeated failure modes, update \`docs/history/FAILURE_REGISTER.md\`; before retrying a method read its corresponding F-0NN entry.
4. For algorithmic decisions, update \`docs/history/METHODS_AND_DECISIONS.md\` with assumptions, tolerances, topological/colour safety and trade-offs.
5. For each release, update \`docs/history/RELEASE_CHRONICLE.md\` and \`docs/FEATURE_MATRIX.md\`; distinguish source-written, test, published and user-verified.
6. Before ending **every development session**, update canonical \`docs/NEXT_CHAT_START.md\` with actual \`main\`/head SHA, latest PR and CI/build/deploy status, constraints, exact next task and links. Preserve full \`HANDOFF.md\` history.
7. Ensure \`tests/history-integrity.test.mjs\` passes. Do not weaken this gate to skip documentation. Review changes for sensitive data; never commit user EPS/CDR/PDF binaries or reconstruct private originals as public fixtures.
8. Version must be synchronized in UI, manifest/lockfiles and **every imported module cache-busting URL**. Alpha.33 exposed an outdated \`corel-outline.js?v=alpha.18\`.
9. A failed/test-only/PR-only state is not deployed. Confirm GitHub \`main\` push workflow **build + deploy success** before stating published; browser/user smoke still separate.
10. Use only the \`tohaa28/relief-forge\` repository for this task. Other projects remain untouched. Do not promise unattended work after this chat.

At the end of the response, give GitHub links to the actual updated history and handoff, PR/merge commit and verified checks; do not leave new-chat notes solely in a chat reply.
