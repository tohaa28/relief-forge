# EPS import contract — 0.2.0-alpha.9

Branch: `feature/eps-import`, based on `f236c70a2ac6a045e6dff4c8ab22562bd337a90d`.
Owner: this Codex session. Windows collaborator owns ArtCAM UI investigation and vector-healing module. Do not overwrite their work; integrate by normal merge. Right-hand healing panel and `src/lib.rs` are unchanged by this feature. `web/app.js` has minimal model/render/diagnostic integration changes; coordinate merges there.

## Interpreter boundary

Classic `web/eps-worker.js` receives `{bytes: Uint8Array, fonts: [{name, bytes: Uint8Array}]}`. It emits `{type:'progress', percent, message}`, `{type:'error', message}` or `{type:'done', result}`. `result` includes `svg`, `widthPt`, `heightPt`, `metadata`, `warnings`, `logs`. Browser-local, no upload/server execution. EPS limit 64 MiB, optional fonts 32 MiB, timeout 120 seconds; terminate Worker for cancellation. Failed/cancelled import must leave the previous document unchanged.

Pipeline: pinned Ghostscript 10.08.0 WASM (`@wasm-zoo/ghostscript@0.7.2`) interprets complete PostScript into vector PDF with `pdfwrite`, EPSCrop, no output fonts and no image downsampling. MuPDF 1.28.1 WASM writes SVG with `text=path,no-reuse-images`. Both engines are AGPL-3.0-or-later; see THIRD_PARTY_NOTICES.md and published licenses. This is an interpreter, not a regex drawing-command extractor. It preserves rendered appearance, not original PostScript dictionaries/procedure names/editable typography. Complex shading may be represented by local raster objects by the SVG writer.

## Document boundary

`importRichSvg(svg, {unitsPerInch:72})` from `web/rich-svg.js` returns existing `{format:'relief-forge', version:1, width, height, paths}` with dimensions/geometry in mm. Ordinary SVG uses default 96 units/inch. Additional document fields:

- `svgDefs`: safe SVG definitions (clipping, masks, patterns, image resources).
- `sourceSvg`: interpreter output SVG.
- `epsImport`: original `name`, `originalBase64` (entire input, including binary preview header), `boundingBox`, `hires`, `widthPt`, `heightPt`, `warnings`, `logs`, engine versions.

Imported path object:

```js
{
  points: [[xMm,yMm], ...], // anchors ONLY, never pass as a polyline to Rust
  closed: Boolean,         // final subpath's explicit Z; not a compound topology classification
  commands: [['M',x,y], ['C',x1,y1,x2,y2,x,y], ...], // world mm, M/L/C/Q/Z
  offset: [dxMm,dyMm],
  artwork: '<g ...>...</g>', // original exact SVG painting, wrappers, transforms, clips
  kind: 'vector' // or 'image'
}
```

A vector may contain multiple M subpaths (glyph holes/compound paths). Preserve it as one painting object. Curves/arcs are stored as curves; render/export uses original SVG artwork, including exact original arc data. `commands` uses cubic conversion for arc geometry calculations. Images have bounding-box commands for selection only, and must never enter vector healing.

- `worldData(path)`: full curve geometry with offset for hit/selection overlay.
- `artworkMarkup(path)`: SVG painting with offset.
- `exportDocument(doc)`: appearance-preserving SVG with mm dimensions and defs.
- `safeFragment(fragment, optionalDOMParser)`: validate before accepting saved artwork/defs.
- `sampledContours(path, toleranceMm)`: adaptive approximation for **analysis or explicitly requested copies only**. Returns separate `{points,closed}` contours. Does not mutate the original; images return `[]`. Max 20000 sampled nodes/object; Rust still limits each calculation to 2000 nodes. Maintain a kernel-index → document-index mapping, because one imported object can create several sampled contours.

Existing polylines remain `{points,closed}` without `artwork`. Healing algorithms still accept only these. Current adapter blocks direct destructive healing of imported objects; “Копия для лечения” creates selected ordinary polylines with explicit tolerance and preserves originals in the document. Whole-object translation, selection, deletion, undo, project JSON and SVG export support imported objects. Direct Bezier node/control-handle editing is not implemented.

## Unpainted CorelDRAW outlines — 0.2.0-alpha.9

For a Ghostscript-rendered *blank EPS only*, a conservative Corel-specific recovery may reconstruct explicit `m`, `L`, `C`, `@c` and final `N` paths from a single page without applying arbitrary PostScript procedures. Any unsupported operator after the first path aborts the fallback. Raw curves/controls and PostScript pt coordinates are preserved, then mapped to the EPS %%BoundingBox and mm by `importRichSvg`. The generated 0.25pt SVG stroke is strictly a preview/selection convention; **the source artwork contains no real print stroke and must not be treated as stroked for production**. Saved JSON retains the exact original EPS bytes and `epsImport.outlineRecovery` provenance. Export SVG shows recovered previews and is not equivalent to the unpainted input. Normal Ghostscript/MuPDF interpretation remains authoritative for painted files. The UI automatically diagnoses the recovered curves in the Rust kernel; destructive healing still requires explicitly making a polyline copy.

Local supplied-case validation: `7921701_02_09.eps`, CorelDRAW 2020, 55,962 bytes, 17 closed outlines, original Ghostscript PDF with blank 115×24pt page. Synthetic Corel fixture is committed for real Ghostscript/MuPDF regression tests; user-provided original EPS is NOT in Git.

## Legacy ArtCAM path-only EPS export — 0.2.0-alpha.9

`exportEps` from `web/eps-export.js` emits a bona-fide EPSF-3.0 PostScript program with literal Corel-style `/m`, `/L`, `/C`, `/@c`, `/N` operators. Source SVG paint attributes are intentionally ignored: **there is no ink, no fill, no PostScript line width, and no drawing instruction**. The EPS is blank in ordinary Ghostscript/PDF rendering by design. It is intended for programs that import unpainted vector paths (not an appearance-preserving EPS). Unsupported image/clip content throws instead of silently dropping it.

Creator is identified honestly as `Relief Forge` with a declared `%%RF-OutlinePaths: 1` marker; it never claims to be CorelDRAW. `recoverUnpaintedCorelOutlines` accepts this explicit source signature in addition to actual CorelDRAW path-only EPS and recovers open/closed subpaths independently, using a display-only temporary stroke in the SVG UI. The actual file's PostScript is paintless and will remain so even if the incoming EPS had visible strokes.

Quality gates: JS geometry/round-trip tests, direct no-heavy-WASM import, Ghostscript test confirming no visible PDF painting, browser import/download/expand-collapse smoke test. Exact old-ArtCAM importer compatibility cannot be asserted without testing with the target application.
## Verification / integration

`npm ci && npm test` prepares self-hosted engines and runs real GS-WASM → MuPDF-WASM integration tests. `bash scripts/build.sh` additionally checks Rust and compiled Rust WASM. Do not commit `node_modules` or generated `web/vendor` binaries; CI regenerates from exact package-lock. Deploy includes these assets, licenses and provenance.

At creation: 15 Rust tests, 12 JS tests and actual Rust-WASM checks pass locally. Browser and publication evidence is appended to logs/actions.jsonl; do not infer those from source-only state.

Windows collaborator status (reported 2026-10-22): ArtCAM Premium 2018 is open, but Computer Use window capture failed twice with SetIsBorderRequired / 0x80004002. No visual observations or ArtCAM parity confirmed. Direct HTTPS git clone timed out; connector can read main. No collaborator code changes reported yet.
