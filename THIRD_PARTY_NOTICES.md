# Third-party EPS engines

Relief Forge source code remains under its repository MIT license. The distributed EPS feature also includes the following separate upstream components with their own licenses. Do not label the complete deployment as MIT-only.

| Component | Pinned version | License | Source/build |
|---|---|---|---|
| Ghostscript | 10.08.0, npm @wasm-zoo/ghostscript 0.7.2 | AGPL-3.0-or-later | https://github.com/ttomohisa/wasm-zoo/releases/tag/ghostscript-v0.7.2 |
| MuPDF | npm mupdf 1.28.1 | AGPL-3.0-or-later | https://mupdf.readthedocs.io/en/1.28.1/guide/using-with-javascript.html |
| svgpath | 2.6.0 | MIT | https://github.com/fontello/svgpath |

The self-hosted deployment includes `vendor/ghostscript/LICENSE-Ghostscript.txt`, `THIRD-PARTY-LICENSES.txt`, BUILDINFO, SBOM and provenance (all package files), `vendor/mupdf/LICENSE`, and `vendor/LICENSE-svgpath`. No runtime CDN dependency is required. Ghostscript font/resource notices are included in its package.

Corresponding Ghostscript source archive (with wasm build source) is published alongside the exact binary release: https://github.com/ttomohisa/wasm-zoo/releases/download/ghostscript-v0.7.2/ghostscript-sources-10.08.0-zoo-0.7.2.tar.gz . The included `provenance.json` records exact source/build commits and SHA256 of gs-core.js/wasm; `scripts/vendor-importers.mjs` verifies these hashes. Upstream build recipes: https://github.com/ttomohisa/wasm-zoo/tree/main/builders/ghostscript .

MuPDF npm gitHead and source tag 1.28.1 both resolve to `20061bd45183f5a2bff8f43675e4da91e5ac2901` (verified against npm metadata and upstream Git tags). Exact source/build directory: https://github.com/ArtifexSoftware/mupdf/tree/20061bd45183f5a2bff8f43675e4da91e5ac2901/platform/wasm .

MuPDF JavaScript/WASM package and source: https://www.npmjs.com/package/mupdf/v/1.28.1 and https://github.com/ArtifexSoftware/mupdf . Follow the pinned release's build instructions/submodule revisions for corresponding MuPDF C sources. MuPDF distribution is copied unmodified. Engine adapters and complete application source: https://github.com/tohaa28/relief-forge .

Reproduce application assets: Node 24, `npm ci && npm run vendor`. Reproduce the Rust engine: Rust 1.85.1 with wasm32-unknown-unknown, `bash scripts/build.sh`. Build-time esbuild and test-only xmldom are listed and pinned in package-lock.json; their upstream licenses remain in node_modules when installed.

Native geometry: Paper.js / paper 0.16.0, MIT, https://github.com/paperjs/paper.js . Pinned package-lock source, geometry-only local esbuild core, vendor/LICENSE-paper. Node DOM/canvas emulation excluded. Candidate output independently reconstructed from native source subcurves and checked against Clipper; no sampled output stored.
