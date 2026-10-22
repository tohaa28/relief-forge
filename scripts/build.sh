#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p logs
exec > >(tee "logs/build-$(date -u +%Y%m%dT%H%M%SZ).log") 2>&1
rustc --version
cargo --version
cargo test --locked
npm test
rustup target add wasm32-unknown-unknown
cargo build --locked --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/relief_forge.wasm web/engine.wasm
node scripts/check-wasm.mjs
printf 'Built web/engine.wasm. Serve web/ over HTTP.\n'
