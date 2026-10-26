# gerb.eps diagnostic investigation — 2026-10-26

User request: test incorrect problem locations and incomplete repair, determine the causes. This checkpoint is an investigation, **not a runtime fix or a new release**. Published alpha.41 application code and the private EPS remain unchanged. Baseline main `8fdd9c3bc76528c54c644f7f12176273ded1cf2c`, runtime release `6a0557f4a499dbbd902fdbf63b0418a41505fcc5`.

Private input: 604571 bytes; SHA256 `312500844119a99a08e181236c2472f9a023dd1fb65af51bfcbf1c9466e58ff4`. Never commit its bytes, vector coordinates, logo, imported project, screenshots, or private curve excerpts. Local user reports include private examples and are deliberately outside this repository. The committed reproducer uses only source-owned synthetic geometry.

## Observed actual application result

Defaults: diagnostic .01 mm, smoothing .05 mm, optimization .02 mm, Union enabled. Actual Chromium → Ghostscript/MuPDF Worker → published Rust/WASM → preview → actual EPS download → independent import was exercised.

93 objects, 1242 closed sampled subcontours. Original11493 editable anchors → AFTER11170. Point repair removed323 anchors and snapped105 close terminal points to subpath starts. This does **not** mean105 originally open contours: all1242 diagnostic subcontours were already closed. Geometry units97.0138889 ×106.1861111 mm.

| Messages | BEFORE | AFTER |
|---|---:|---:|
| Duplicate subcontours | 28 | 28 |
| Coincident/near points | 1107 | 760 |
| Overlapping spans | 556 | 587 |
| Inter-object intersections | 1096 | 1096 |
| Short spans | 492 | 166 |
| Self intersections | 5 | 5 |
| Total | 3284 | 2642 |

These are emitted messages, not independent defects. No real open-contour issue was observed. Partial diagnostic coverage was correctly reported; it must not be hidden.

## F-037: a polyline crossing is not a confirmed Bézier crossing

`rich-svg.sampledContours` approximates native curves with chords at the diagnostic tolerance. `src/lib.rs::diagnose` classifies intersections on those polylines. `after-diagnostics` and progressive BEFORE diagnosis map those proxy locations back without native-curve confirmation. `createIssueBoundsValidator` only checks an object's bounding rectangle, so `misplaced=0` is not proof that a marker lies at an intersection of the original curves.

Independent local audit reconstructed the exact subdivisions, including zero spans and degenerate two-point closures, and asserted every sampled point/contour against the existing sampler (coordinate discrepancy <1e-10 mm) for all1242 subcontours both before and after. Each reported self-intersection was checked against the **same Bézier parameter intervals** generating its two chord edges, using actual curve-point witnesses and convex-hull/chord-error lower bounds (`curveDistance`, 1e-8mm interval target, explicit work budget).

All5 AFTER self-intersection messages are false as exact crossings. Their native-interval distances, in mm:

| Message | Lower bound | Upper actual-point witness |
|---|---:|---:|
| 1 | .002704307742087286 | .0027043172122805663 |
| 2 | .002704309767679633 | .0027043172122805663 |
| 3 | .002431336822074226 | .002431344544567125 |
| 4 | .0011805588576009568 | .0011805681750081114 |
| 5 | .0012345249596237542 | .0012345334081909222 |

They occupy3 distinct source subcontours. Positive lower bounds prove separation for those intervals. They can be legitimate *near-curve* concerns under a generous tolerance, but must not be presented as confirmed intersections. In BEFORE,3/5 self messages were similarly separated;2 had actual near-zero contacts at the numerical resolution. All1096 inter-object reports had near-zero native witnesses (<1e-8mm); most are repeated contacts from exact copies, so do not call these1096 proxy false positives. No unresolved pair was silently treated as proven in this audit.

297 of760 AFTER coincident-point pairs include at least one inserted sample rather than two native editable anchors (BEFORE296/1107). Short-span AFTER classification is164 real tiny native spans +2 implicit degenerate closure edges; **none** of the166 is a subdivision of a larger healthy native span in this input. Do not generalize every short-span message here as an approximation artifact.

## Exact duplicates and cross-batch incompleteness

Whole native-command/offset/paint equality finds35 redundant objects,602 redundant original anchors. They have identical opaque solid paint. The28 emitted duplicate-subcontour messages cover only19 distinct object pairs out of35.

BEFORE25795 sampled points and AFTER25469 points require14 jobs (2000-point WASM limit). No source object was unreadable, and no contour needed splitting: `fullScope=true` means all objects were included somewhere, **not** that all relationships were verified. Cross-job pairs are missing. At diagnostic .005 mm, the source needs18 jobs and emits **zero** duplicate messages despite the same35 exact native copies. At .02mm it uses11 jobs and emits41 duplicate-subcontour messages. Changing tolerance also changes pair coverage, not merely precision.

An isolated experiment kept the later exact opaque copy and removed the earlier one, without modifying any curve:93→58 objects,11493→10891 native anchors. Independent winding-aware Clipper silhouette XOR was0mm² at .005mm sampling / .00001mm integer grid. Remaining sampled diagnostics were1094 messages (566coincident,492short,15overlap,16intersection,5self), still partial. This is evidence for a safe separate exact-copy stage on this input, **not** a claim that the file is fully repaired, or a license to deduplicate arbitrary transparency/strokes/paint/order.

## F-038: whole-candidate rollback restores exact copies

The actual Union stage reports `removedExact=35`,93→58 objects,26 normalized groups,2 skipped objects. Its final candidate has23225 native anchors versus original11493. The original-node ceiling correctly rejects this inflation (`union-node-growth`). However, `protectPreviewNodeBudget` returns the entire pre-Union snapshot, restoring even the valid exact-copy removals. All35 copies remain in actual AFTER.

Keep the original node guard. Separate verified native deduplication from flattening/Union, and make rollback scoped to affected groups. Disabling the guard or exporting the inflated candidate would revive F-028.

## F-039: aggregate quality validation exhausts the sampling cap

`validateDocumentCurveChange` combines all paths into a single synthetic path for the independent postcondition. Its .0025mm verification sampling exceeds `sampledContours`'20000-point limit. The actual report is `accepted=false`, reason `Кривая слишком сложна: увеличьте допуск или уменьшите выборку`, beforeSegments9928/afterSegments9006. Large-preview code then restores `qualitySource`, discarding smoothing/optimization candidates wholesale. The actual AFTER therefore mainly reflects point repair. No geometry worsening was established by that budget failure.

The source-owned reproducer demonstrates that three separately manageable7001-node paths, passed as identical BEFORE/AFTER, can fail the same aggregate cap. An eventual scalable postcondition needs per-object/spatial-pair checks while retaining cross-object safety and honest incomplete status; simply removing the validator or raising a limit is not an adequate fix.

## Tiny contours and the separate pink-distance feature

All166 remaining short-span messages belong to57 wholly tiny subcontours. Every control hull in each affected part fits within .01mm of that part's first point. `repairVectorPoints` deliberately retains the original part if removing its tiny spans would leave only a point. These may be decorative micro-elements or degenerate geometry; a generic cleanup must not erase all57 without a defined semantic policy. This behavior is protective, not a failed loop over ordinary removable nodes.

The independent native pink-distance feature completed within its2M work budget: BEFORE517 zones, AFTER502 at .1mm (about2393/2167ms CPU-only here). They are separate from the2642 Rust diagnostic messages. That feature was requested as highlighting; it does not automatically separate curves. Its completion does not certify legacy cross-batch diagnostic coverage.

## Export is not the cause in this reproduction

The real downloaded outline EPS passes `verifyEpsOutputGeometry` as `matching-after`,11170anchors. Independent EPS import repeats **all** AFTER per-kind counts above, including total2642 and partial status. No new serialization corruption was found. Do not silently alter the EPS writer to hide an upstream diagnosis/repair problem.

## Reproduction and verification

- `node scripts/reproduce-alpha41-diagnostic-limits.mjs`: five source-owned experiments (chord false crossing, missed cross-job duplicate, whole-tiny-part protection, whole-Union rollback, aggregate-quality cap). It prints observations rather than requiring bugs to persist in a future fixed release. Synthetic chord reports crossing at(1.5,0), while native distance is bounded between.00649999940393418 and.0065mm.
- `npm test`:229/229 PASS on unchanged alpha.41. Passing existing tests is not evidence that the above cases are covered.
- Actual Chromium/Worker/published-WASM baseline smoke and real Apply/export/Undo checks PASS as transport/preservation checks; nonzero geometry diagnostics remain and were audited, not suppressed.
- Downloaded published WASM was used locally; no fresh local Cargo toolchain was available. Fresh native/WASM CI is distinct from this published-binary audit.
- Initial environment had lost the earlier checkout/cwd; recovered this exact repository from GitHub, restored dependencies and approved icons from the verified archive. No other repository was changed. Initial private audit harness had a relative-import mistake and omitted zero spans/degenerate two-point closure conventions; strict sampler assertions caught these, and they were corrected before drawing any conclusions. Private excerpts/reports were visually reviewed locally.

## Priority correction plan (not implemented in this investigation)

1. Carry native segment/parameter provenance and refine proxy intersection/coincidence reports before displaying or repairing; distinguish close samples from editable nodes and true intersections.
2. Perform globally verified, paint/order-safe exact native deduplication independently of optional Union and its rollback.
3. Cover cross-job relationships with bounded spatial indexing, preserving incomplete warnings until actual pair coverage is achieved.
4. Scale the independent quality check and scope rollback per group while keeping original-node, silhouette/hole, paint, Undo and AFTER=EPS guards.
5. Expose an explicit policy for deleting micro-components/zero-area elements. Preserve deliberate small artwork by default.

No alpha.42 was released, and no claim of complete repair is made. Current requested investigation is complete; do not confuse these findings with a deployed fix.
