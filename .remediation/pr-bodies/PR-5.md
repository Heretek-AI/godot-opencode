# Release 1.0.0: Full-Stack Production & Visual Inspection

Phase 5 (tickets 5.1–5.5) on top of Phase-4 HEAD `d0ce544`. No Godot
binary or viewport in CI — vision/indexing legs degrade gracefully
(stale-fallback detection, `unavailable` statuses) with mock harnesses.

## What landed

- **5.1 Viewport Vision & Screenshots**
  - `companion/addons/godot_opencode/viewport_handler.gd` (2D/3D capture,
    AABB framing, `capture_status`, stale fallback past 1000 ms)
  - `packages/plugin/src/vision/viewport.ts` (`frameAABB`,
    `isStaleFrame`, `parseCaptureResult`, `MAIN_LOOP_STALL_MSEC=1000`)
  - `godot_capture_viewport` tool binding; framing math + stale detection
    unit-tested (`test/viewport.test.ts`, 12 tests).
- **5.2 Shaders & UI Themes**
  - `handlers/shader_handler.gd` + `handlers/theme_handler.gd`, wired in
    `plugin.gd`; `src/studio/shaders.ts` (spatial/canvas-item gen,
    uniform injection, StyleBoxFlat/font/color overrides);
    `godot_shader_generate` + `godot_theme_apply_style` tools;
    uniform-injection + style-override round-trip tests.
- **5.3 Scene Graph Indexing**
  - `src/indexer/project.ts` (VariantParser-subset `.tscn` parse,
    `project.godot` autoloads, injectable FS, Markdown architecture map);
    fixture project indexed + rendered (`test/project-index.test.ts`).
- **5.4 E2E Production Benchmark**
  - `src/verify/production.ts` + `test/e2e-production.test.ts`:
    brief → dev-story (mock) → scene → typed GDScript → signal →
    HUD style → GUT (mock TAP) → headless (`unavailable`-tolerant) →
    viewport (`stale`-tolerant). Green without engine; real GUT/headless
    failures still fail the pipeline.
- **5.5 Docs** — `docs/INSTALL.md`, `docs/API.md`,
  `docs/ARCHITECTURE.md`, `docs/RELEASE-1.0.0.md`.

## Verification

- `bun run check` (Biome + `tsc --noEmit`): clean, exit 0.
- New tests: 28/28 pass across the 4 Phase-5 files.
- `bun test packages/plugin/test/`: 123 pass; the single combined-run
  `1 fail + 1 error` (a `review/opencode` module-resolution artifact in
  gitignored `review/`) **pre-exists on Phase-4 HEAD** (verified via
  `git stash`); every file passes in isolation — no regressions.
- `bun test packages/` repo-wide sweeps gitignored `review/` reference
  material and is not a valid gate; explicit paths per ticket.

## Traceability (lumped commit SHA / per-ticket Files / Verification)

**ATOMICITY: lumped — see H3.** Phase 5 ships as a single commit `e625dbe`
(`feat(phase-5): viewport vision, shaders/themes, scene indexing, e2e benchmark, 1.0.0 docs`)
covering tickets 5.1–5.5 + docs, on top of Phase-4 HEAD `d0ce544`.
Per-ticket file groups inside the lumped commit.
Full table: `docs/AUDIT-TRACEABILITY.md`.

| Ticket | Commit SHA | Files | Verification |
| :--- | :--- | :--- | :--- |
| 5.1 Viewport vision + screenshots | `e625dbe` (lumped) | `companion/addons/godot_opencode/viewport_handler.gd`, `packages/plugin/src/vision/viewport.ts`, `packages/plugin/test/viewport.test.ts`, `packages/plugin/src/bindings/tools.ts` (`godot_capture_viewport` binding) | 151 combined pass, 0 fail; 12/12 viewport tests; stale-tolerant without engine |
| 5.2 Shaders + UI themes | `e625dbe` (lumped) | `companion/addons/godot_opencode/handlers/shader_handler.gd`, `companion/addons/godot_opencode/handlers/theme_handler.gd`, `companion/addons/godot_opencode/plugin.gd` (wiring), `packages/plugin/src/studio/shaders.ts`, `packages/plugin/test/shaders.test.ts` | 151 combined pass, 0 fail; uniform-injection + style-override round-trip tests |
| 5.3 Scene graph indexing | `e625dbe` (lumped) | `packages/plugin/src/indexer/project.ts`, `packages/plugin/test/project-index.test.ts` | 151 combined pass, 0 fail; fixture project indexed + rendered |
| 5.4 E2E production benchmark | `e625dbe` (lumped) | `packages/plugin/src/verify/production.ts`, `packages/plugin/test/e2e-production.test.ts` | 151 combined pass, 0 fail; green without engine; real GUT/headless failures still fail the pipeline |
| 5.5 Docs (1.0.0) | `e625dbe` (lumped) | `docs/INSTALL.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/RELEASE-1.0.0.md` | Docs-only; `bun run check` clean |

Counts: 123 plugin-only + 28 companion = 151 combined
(explicit paths; bare sweeps of gitignored `review/` are not a gate).

## Known limits (no engine in CI)

- GDScript handlers are statically reviewed, not engine-executed;
  runtime validation (`capture_viewport`, style apply) needs a Godot 4
    editor pass on a machine with the binary.

Traceability: docs/AUDIT-TRACEABILITY.md (Refs #5)
