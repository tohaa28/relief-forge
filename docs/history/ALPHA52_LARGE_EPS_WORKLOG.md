# 0.2.0-alpha.52 — heavy EPS preflight and full batch traversal (candidate, not released)

**User reproduction:** `8101921-1.eps` uploaded in ChatGPT on 2026-11-18. The private source is **not** committed to Git. File size 1,143,896 bytes; DOS EPS header: PS offset 30, PS length 906,816, TIFF preview length 237,050. CorelDRAW 2020 64-bit. Parsed PS operation counts: 1,933 `m` starts, 12,965 `C` cubic segments, 46 `L` lines. Local Ghostscript `-dSAFER -sDEVICE=nullpage` exit 0.

**Observed pre-change safeguards:** native Rust ABI maximum 2,000 sampled points per call; large-file-support.js already visits all valid sampled windows, but marks multi-batch and split-path diagnosis partial; within one Rust job 10,000 issue cap returns early; across job aggregated display uses another 10,000 issue cap; native diagnosis pair/issue safety limits can yield partial. These must **not** be described as verified full-global diagnostics. Automatic geometry treatment already switches to cooperatively yielded per-object stages for >2500 sampled points or >150 objects.

**Candidate changes:**
- New `web/complexity-preflight.js` inspects a DOS EPS's declared PostScript range (does not count TIFF image as geometry). Robust bounded 16MiB scan and file-size fallback; counts plain Corel numeric `m`, `C`, `L` commands. It does **not** alter or reject geometry and does not evaluate PostScript.
- After streaming the input, before Ghostscript/MuPDF conversion, show a visible slow-processing notice in the busy overlay with actual candidate counts. User can still cancel. For imported/converted PDF or atypical PostScript, show notice once actual sampled batch count crosses bounded Rust capacity.
- Diagnostic loop keeps advancing to the final batch even after a failed batch or marker-list saturation, and now distinguishes `processed` from successfully `checked` points; logs failed batches and retains explicit incomplete status. No hard-coded new acceptance limit and no silent success when a batch fails.
- Version in `Cargo.toml`, `package*.json`, `web/index.html`, `web/app.js` bumped to alpha.52 for cache invalidation. Existing native mathematical predicates, Union, exported EPS fidelity and Undo are untouched.
- Regression tests add synthetic 1,933 contour / 12,965 C DOS EPS preflight and UI source checks.

**Not yet proven:** successful import/processing of the user EPS in a deployed alpha.52 browser; unchanged Rust 2,000-point ABI and inability to certify all between-batch interactions. This is a feature branch candidate, not a full geometry solution. Do not merge until CI green. Do not claim that a large document with partial diagnosis was fully validated. Existing alpha.51 checkpoint: `5c7822ca49ab0da5273753b4db17bb21a27e1be8`; verified main release remains alpha.51.

**Next:** CI JS/Rust/WASM/browser EPS & PDF/Undo/mode matrix. Then live same-user-EPS sample and any needed cross-batch diagnostic completeness work. Preserve the preflight false-positive safeguards and reject bad DOS header offsets rather than scanning binary TIFF.
