# Development rules

- Read HANDOFF.md and docs/FEATURE_MATRIX.md before making changes.
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
