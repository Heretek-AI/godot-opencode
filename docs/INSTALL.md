# Install — godot-opencode 1.0.0

## Prerequisites

- Bun ≥ 1.2, Godot 4.x (editor + CLI on `PATH` as `godot`, or set `GODOT_BINARY`).
- OpenCode v2 with plugin support. No Python anywhere in the loop.

## Steps

1. `bun install` from the repo root.
2. Copy the companion addon into your game project:
   `cp -r companion/addons/godot_opencode <game>/addons/`
   then enable **Project → Plugins → Godot OpenCode**.
3. Point the plugin at the bridge (defaults: port `9500`,
   capability dir `~/.config/opencode/godot/capabilities`,
   override with `GODOT_CAPABILITY_DIR`).
4. Verify: `bun run check` (Biome + `tsc --noEmit`) and
   `bun test packages/plugin/test/` (all green without a Godot binary;
   engine-backed legs degrade to `unavailable`/`stale-tolerated`).

## No-engine CI

Without a Godot binary every runner degrades gracefully instead of
throwing: headless checks report `unavailable`, GUT reports
`unavailable`, viewport captures report `stale` past
`MAIN_LOOP_STALL_MSEC` (1000 ms). The E2E production benchmark
(`packages/plugin/test/e2e-production.test.ts`) asserts this.
