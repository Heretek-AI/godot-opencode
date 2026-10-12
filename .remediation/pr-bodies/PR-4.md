# Release 0.4.0: Phase 4 · Studio Swarm & Director Gating

## Summary

Phase 4 adds the studio collaboration layer on top of the Phase 3 verification
harness: a transform-compatible agent roster, a deterministic 26-gate director
protocol, five mock-testable slash commands, and an idempotent model-context
interceptor. All modules define minimal structural interfaces locally —
zero `@opencode/*` imports.

## Tickets

- **4.1 Studio Agent Roster** (`packages/plugin/src/studio/agents.ts`)
  10 agents in 3 tiers. Directors (`technical-director`, `creative-director`,
  `producer`; `opus`/`pro`) enforce `shell:deny edit:deny`; Leads
  (`lead-programmer`, `game-designer`, `qa-lead`) enforce `shell:deny
  edit:ask`; Specialists (`godot-architect`, `godot-gdscript-specialist`,
  `godot-shader-specialist`, `godot-qa-tester`) allow both.
  `studioAgentTransform` is a `ctx.agent.transform()`-compatible callback.
  Unknown ids throw (`requireStudioAgent`, `checkStudioPermission`).
- **4.2 Director Gate Protocol** (`packages/plugin/src/studio/gates.ts`)
  26 gates (`CD-PILLARS` … `QL-TEST-COVERAGE`). Line 1
  `[GATE-ID]: APPROVE|CONCERNS|REJECT|NOT ASSESSED` + criteria;
  `parseGateVerdict` rejects malformed/unknown/lowercase lines.
  `aggregateGateVerdicts` enforces REJECT > CONCERNS > NOT ASSESSED >
  APPROVE (empty → NOT ASSESSED).
- **4.3 Slash Commands** (`packages/plugin/src/studio/commands.ts`)
  `setup-godot`, `adr`, `dev-story` (load → spawn → GUT → headless →
  commit, aborts on first failure), `story-done` (8-phase acceptance
  audit), `gate-check` (worst-verdict aggregation; REJECT → `ok:false`).
  `registerStudioCommands` is `ctx.command.transform()`-compatible;
  unknown commands throw.
- **4.4 Context Packing** (`packages/plugin/src/studio/context.ts`)
  `studioContextHook` is `ctx.session.hook("context")`-compatible; injects
  engine version, editor status, active scene tree behind
  `<!-- godot-context -->`. Repeat hooks replace in place — never duplicate —
  and pre-existing system entries are preserved.

## Verification (explicit paths, `./packages/` only)

- `bun test ./packages/plugin/test/agents.test.ts ./packages/plugin/test/gates.test.ts ./packages/plugin/test/commands.test.ts ./packages/plugin/test/context.test.ts` → 24 pass
- Full plugin suite (13 pre-existing files, explicit paths) → 71 pass
- `./node_modules/.bin/biome check packages/plugin/src/studio/ <4 test files>` → clean
- `./node_modules/.bin/tsc --noEmit` → exit 0
- No `@opencode/*` imports in `packages/plugin/src/studio/` (grep-verified;
  only doc comments mention the name)

## Traceability (lumped commit SHA / per-ticket Files / Verification)

**ATOMICITY: lumped — see H3.** Phase 4 ships as a single commit `d0ce544`
(`feat(phase-4): studio swarm roster, director gates, slash commands, context packing`)
covering tickets 4.1–4.4. Per-ticket file groups inside the lumped commit.
Full table: `docs/AUDIT-TRACEABILITY.md`.

| Ticket | Commit SHA | Files | Verification |
| :--- | :--- | :--- | :--- |
| 4.1 Studio agent roster | `d0ce544` (lumped) | `packages/plugin/src/studio/agents.ts`, `packages/plugin/test/agents.test.ts` | 123 pass, 0 fail (explicit paths); TDD RED→GREEN per ticket; `bun run check` clean |
| 4.2 Director gate protocol | `d0ce544` (lumped) | `packages/plugin/src/studio/gates.ts`, `packages/plugin/test/gates.test.ts` | 123 pass, 0 fail (explicit paths); TDD RED→GREEN per ticket; `bun run check` clean |
| 4.3 Slash commands | `d0ce544` (lumped) | `packages/plugin/src/studio/commands.ts`, `packages/plugin/test/commands.test.ts` | 123 pass, 0 fail (explicit paths); TDD RED→GREEN per ticket; `bun run check` clean |
| 4.4 Context packing | `d0ce544` (lumped) | `packages/plugin/src/studio/context.ts`, `packages/plugin/test/context.test.ts` | 123 pass, 0 fail (explicit paths); TDD RED→GREEN per ticket; `bun run check` clean |

## Notes

- Gate roster pins the 26 pre-production gates (`CD-*`/`TD-*`/`PR-*`/`AD-*`/
  `LP-*`/`QL-*`); `ND-CONSISTENCY`/`AD-VISUAL` are out of scope for 0.4.0.
- TDD failing-first per ticket: tests landed RED (missing module), then
  GREEN after implementation.
- Constitution honored: main untouched, explicit `git add`, checks scoped to
  `./packages/`, no reviewer-prompt execution.

Traceability: docs/AUDIT-TRACEABILITY.md (Refs #4)
