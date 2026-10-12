# Audit Traceability — godot-opencode Phases 1–5

Per-ticket commit SHA, file list, and verification evidence for every phase.
All SHAs verified with `git cat-file -e <sha>`; all files verified with
`git ls-tree -r --name-only integration/phase-<N>`.

Repair-audit context: S1 harnesses land on top in `integration/repair-audit`.
Published history (`d0ce544`, `e625dbe`) is immutable to agents — see H3.
All references use `Refs`, never `Closes`/`Fixes`.

## Test-evidence floors (explicit paths only)

| Phase | Tests | Result | Command |
| :--- | :--- | :--- | :--- |
| P1 | 46 | 0 fail | `bun test ./packages/plugin/test/` |
| P2 | 74 | 0 fail | `bun test ./packages/plugin/test/ ./companion/tests/` (46 plugin + 28 companion) |
| P3 | 99 | 0 fail | `bun test ./packages/plugin/test/ ./companion/tests/` |
| P4 | 123 | 0 fail | `bun test ./packages/plugin/test/ ./companion/tests/` (explicit paths; bare sweeps of gitignored `review/` are not a gate) |
| P5 | 151 | 0 fail | `bun test ./packages/plugin/test/ ./companion/tests/` — 123 plugin-only + 28 companion = 151 combined (explicit paths; bare sweeps of `review/` are not a gate) |

## Phase 1 — Plugin foundations (branch `integration/phase-1`)

| Ticket | Feature SHA | Merge SHA | Files | Verification |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 Monorepo scaffolding + effect lifecycle | `65038a6` | `fb0d5f3` | `packages/plugin/src/effect.ts`, `packages/plugin/src/index.ts`, `packages/plugin/src/plugin.ts`, `packages/plugin/test/plugin.test.ts` | P1 floor: 46 pass, 0 fail (`bun test ./packages/plugin/test/`) |
| 1.2 Loopback capability + HMAC security | `8a8dcdc` | `eadba50` | `packages/plugin/src/security/capability.ts`, `packages/plugin/src/security/handshake.ts`, `packages/plugin/test/capability.test.ts`, `packages/plugin/test/handshake.test.ts` | P1 floor: 46 pass, 0 fail |
| 1.3 Native WebSocket + JSON-RPC engine | `772c253` | `95be83d` | `packages/plugin/src/transport/jsonrpc.ts`, `packages/plugin/src/transport/websocket.ts`, `packages/plugin/test/jsonrpc.test.ts`, `packages/plugin/test/websocket.test.ts` | P1 floor: 46 pass, 0 fail |
| 1.4 Readiness state machine + circuit breaker | `9bbbc68` | `7c3f388` | `packages/plugin/src/session/circuit.ts`, `packages/plugin/src/session/registry.ts`, `packages/plugin/test/circuit.test.ts`, `packages/plugin/test/registry.test.ts` | P1 floor: 46 pass, 0 fail |
| 1.5 Tool transform + RPC namespace adapters | `4386438` | `9713d36` | `packages/plugin/src/bindings/rpc.ts`, `packages/plugin/src/bindings/tools.ts`, `packages/plugin/test/bindings.test.ts` | P1 floor: 46 pass, 0 fail |

## Phase 2 — Godot Editor companion addon (branch `integration/phase-2`)

| Ticket | Feature SHA | Merge SHA | Files | Verification |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 Addon scaffold + authenticated WebSocket server | `4913cd5` | `0c6721d` | `companion/addons/godot_opencode/connection.gd`, `companion/addons/godot_opencode/plugin.cfg`, `companion/addons/godot_opencode/plugin.gd`, `companion/addons/godot_opencode/utils/error_codes.gd`, `companion/tests/handshake_harness.test.ts` | P2 floor: 74 pass, 0 fail (`bun test ./packages/plugin/test/ ./companion/tests/`) |
| 2.2 Main-thread frame budgeter + dispatcher | `6071b3b` | `df6ed72` | `companion/addons/godot_opencode/connection.gd` (enqueue/routing), `companion/addons/godot_opencode/dispatcher.gd`, `companion/tests/dispatcher_harness.test.ts` | P2 floor: 74 pass, 0 fail |
| 2.3 Cooperative transport servicing during blocking runs | `a5ccd8f` | `1188d7e` | `companion/addons/godot_opencode/connection.gd` (exclusive-run servicing), `companion/tests/exclusive_run_harness.test.ts` | P2 floor: 74 pass, 0 fail |
| 2.4 EditorUndoRedoManager with path-based undo | `8b00c79` | `f5b0419` | `companion/addons/godot_opencode/undo_manager.gd`, `companion/tests/undo_harness.test.ts` | P2 floor: 74 pass, 0 fail |
| 2.5 Core domain handlers (node/signal/resource) | `65ca60e` | `94c2ec4` | `companion/addons/godot_opencode/connection.gd` (dispatch wiring), `companion/addons/godot_opencode/handlers/node_handler.gd`, `companion/addons/godot_opencode/handlers/resource_handler.gd`, `companion/addons/godot_opencode/handlers/signal_handler.gd`, `companion/addons/godot_opencode/plugin.gd` (registration), `companion/tests/handlers_harness.test.ts` | P2 floor: 74 pass, 0 fail |
| 2.6 Out-of-band debugger + engine bridge | `fc8f263` | `846ce82` | `companion/addons/godot_opencode/connection.gd` (bridge), `companion/addons/godot_opencode/debugger/debugger_plugin.gd`, `companion/addons/godot_opencode/plugin.gd` (wiring), `companion/tests/debugger_harness.test.ts` | P2 floor: 74 pass, 0 fail |

Phase-2 HEAD: `846ce82` (merge of ticket 2.6).

## Phase 3 — Dual-mode verification & pre-flight engine (branch `integration/phase-3`)

Sequential commits on top of phase-2 HEAD `846ce82` (no merge commits).

| Ticket | Commit SHA | Files | Verification |
| :--- | :--- | :--- | :--- |
| 3.1 Headless CLI syntax + type checker | `3d6579f` | `packages/plugin/src/verify/headless.ts`, `packages/plugin/test/headless.test.ts` | P3 floor: 99 pass, 0 fail (`bun test ./packages/plugin/test/ ./companion/tests/`); `scripts/validate-commit.sh` ok |
| 3.2 Scene + resource validator with headless harness | `2ed1db1` | `companion/validate_scene.gd`, `packages/plugin/src/verify/scene.ts`, `packages/plugin/test/scene.test.ts` | P3 floor: 99 pass, 0 fail; `scripts/validate-commit.sh` ok |
| 3.3 GUT test runner (TAP + JUnit parsing) | `0e25b12` | `packages/plugin/src/verify/gut.ts`, `packages/plugin/test/gut.test.ts` | P3 floor: 99 pass, 0 fail; `scripts/validate-commit.sh` ok |
| 3.4 Safety middleware + write guards | `194e1ac` | `packages/plugin/src/guards/middleware.ts`, `packages/plugin/test/middleware.test.ts` | P3 floor: 99 pass, 0 fail; `scripts/validate-commit.sh` ok |
| 3.5 Pre-commit validation hook | `03d7c06` | `packages/plugin/test/validate-commit.test.ts`, `scripts/validate-commit.sh` | P3 floor: 99 pass, 0 fail; `scripts/validate-commit.sh` ok |

## Phase 4 — Studio swarm & director gating (branch `integration/phase-4`)

**ATOMICITY: lumped — see H3.** Single commit `d0ce544`
(`feat(phase-4): studio swarm roster, director gates, slash commands, context packing`)
covers tickets 4.1–4.4. Per-ticket file groups inside the lumped commit:

| Ticket | Commit SHA | Files | Verification |
| :--- | :--- | :--- | :--- |
| 4.1 Studio agent roster | `d0ce544` (lumped) | `packages/plugin/src/studio/agents.ts`, `packages/plugin/test/agents.test.ts` | P4 floor: 123 pass, 0 fail (explicit paths); TDD RED→GREEN per ticket; `bun run check` clean; no `@opencode/*` imports in `packages/plugin/src/studio/` (grep-verified) |
| 4.2 Director gate protocol | `d0ce544` (lumped) | `packages/plugin/src/studio/gates.ts`, `packages/plugin/test/gates.test.ts` | P4 floor: 123 pass, 0 fail; `bun run check` clean |
| 4.3 Slash commands | `d0ce544` (lumped) | `packages/plugin/src/studio/commands.ts`, `packages/plugin/test/commands.test.ts` | P4 floor: 123 pass, 0 fail; `bun run check` clean |
| 4.4 Context packing | `d0ce544` (lumped) | `packages/plugin/src/studio/context.ts`, `packages/plugin/test/context.test.ts` | P4 floor: 123 pass, 0 fail; `bun run check` clean |

## Phase 5 — Full-stack production & visual inspection (branch `integration/phase-5`)

**ATOMICITY: lumped — see H3.** Single commit `e625dbe`
(`feat(phase-5): viewport vision, shaders/themes, scene indexing, e2e benchmark, 1.0.0 docs`)
covers tickets 5.1–5.5 + docs. Per-ticket file groups inside the lumped commit:

| Ticket | Commit SHA | Files | Verification |
| :--- | :--- | :--- | :--- |
| 5.1 Viewport vision + screenshots | `e625dbe` (lumped) | `companion/addons/godot_opencode/viewport_handler.gd`, `packages/plugin/src/vision/viewport.ts`, `packages/plugin/test/viewport.test.ts`, `packages/plugin/src/bindings/tools.ts` (`godot_capture_viewport` binding) | P5 floor: 151 combined pass, 0 fail; 12/12 viewport tests; stale-tolerant without engine |
| 5.2 Shaders + UI themes | `e625dbe` (lumped) | `companion/addons/godot_opencode/handlers/shader_handler.gd`, `companion/addons/godot_opencode/handlers/theme_handler.gd`, `companion/addons/godot_opencode/plugin.gd` (wiring), `packages/plugin/src/studio/shaders.ts`, `packages/plugin/test/shaders.test.ts` | P5 floor: 151 combined pass, 0 fail; uniform-injection + style-override round-trip tests |
| 5.3 Scene graph indexing | `e625dbe` (lumped) | `packages/plugin/src/indexer/project.ts`, `packages/plugin/test/project-index.test.ts` | P5 floor: 151 combined pass, 0 fail; fixture project indexed + rendered |
| 5.4 E2E production benchmark | `e625dbe` (lumped) | `packages/plugin/src/verify/production.ts`, `packages/plugin/test/e2e-production.test.ts` | P5 floor: 151 combined pass, 0 fail; green without engine; real GUT/headless failures still fail the pipeline |
| 5.5 Docs (1.0.0) | `e625dbe` (lumped) | `docs/INSTALL.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/RELEASE-1.0.0.md` | Docs-only; `bun run check` clean |

Counts: 123 plugin-only + 28 companion = 151 combined
(explicit paths; bare sweeps of gitignored `review/` are not a gate).

Note: S1 repair harnesses land on top in `integration/repair-audit`,
after `e625dbe`.
