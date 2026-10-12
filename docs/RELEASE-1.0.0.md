# Release notes — 1.0.0 Full-Stack Production & Vision

## Highlights (Phase 5)

- **5.1 Viewport Vision & Screenshots** — 2D + 3D/AABB-framed capture
  via the debugger bridge; base64 PNG with 1000 ms stale fallback;
  `godot_capture_viewport` tool; framing math unit-tested.
- **5.2 Shaders & UI Themes** — spatial/canvas-item generation with
  uniform injection; Theme/StyleBoxFlat/font/color inspect + apply;
  uniform-injection and style-override round-trip tests.
- **5.3 Scene Graph Indexing** — recursive `.tscn`/`.tres` parse,
  Markdown architecture map (hierarchies, autoloads, signal graphs,
  script tables) over an injectable filesystem.
- **5.4 E2E Production Benchmark** — mocked concept→dev-story→scene→
  script→signal→HUD→GUT→headless→viewport pipeline; green without an
  engine (`unavailable`/`stale` tolerated, real failures still fail).
- **5.5 Docs & Release** — INSTALL / API / ARCHITECTURE guides.

## Verification

- `bun run check`: Biome + `tsc --noEmit` clean.
- `bun test packages/plugin/test/`: 123 pass; the single combined-run
  `1 fail + 1 error` (a `review/opencode` module-resolution artifact)
  pre-exists on Phase-4 HEAD — every file passes in isolation and all
  28 new Phase-5 tests are green, no regressions.
- No Godot binary or viewport in CI: all engine-backed legs degrade
  gracefully with mock harnesses.
