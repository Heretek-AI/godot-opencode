# Release 0.3.0: Phase 3 · Dual-Mode Verification & Pre-Flight Engine

Phase 3 adds the verification layer for godot-opencode: headless Godot checks
that degrade gracefully when no binary is present, plus pre-flight safety
gates for writes and commits. All tests pass **without** a Godot binary
(no `godot` on PATH in CI); runners shell out when a binary exists and return
structured `unavailable` diagnostics otherwise.

## Tickets

- **3.1 Headless CLI Syntax & Type Checker** (`packages/plugin/src/verify/headless.ts`)
  `HeadlessRunner` wraps `godot --headless --check-only -s <script>`, parses
  `SCRIPT ERROR` / `at: … (file:line:col)` locations into `{file,line,col,message}`.
  Binary-missing → `{status:"unavailable"}` (no throw); hangs → `{status:"timeout"}`.
- **3.2 Scene & Resource Validator** (`packages/plugin/src/verify/scene.ts`,
  `companion/validate_scene.gd`) — pure-`.tscn` parsing of `ext_resource` deps
  and `[connection]` refs; missing files and broken signal refs reported as
  structured issues. GDScript harness emits single-JSON-object results headlessly.
- **3.3 GUT Test Runner** (`packages/plugin/src/verify/gut.ts`) — runs
  `gut_cmdln.gd -gdir=res://tests/ -gexit`; parses TAP and JUnit into
  `{pass,fail,tests[],timings}` with failure stacks preserved.
- **3.4 Safety Middleware & Write Guards** (`packages/plugin/src/guards/middleware.ts`)
  `tool.hook("execute.before")`-compatible interceptor with structural interfaces
  only (no `@opencode/*` imports). Blocks `rm -rf *`, `git push --force`,
  `git reset --hard`; gates `.gd`/`.tscn` writes behind pre-flight syntax checks
  (fail-open on `unavailable`, fail-closed on `error`).
- **3.5 Pre-Commit Validation Hook** (`scripts/validate-commit.sh` + TS harness)
  Validates staged `.json` tables parse, GDScript quick check (conflict markers +
  `int`/`String` type slips), optional test gate (`--run-tests`).

## Verification (gate 3.6)

- `bunx biome check packages/` — clean
- `bunx tsc --noEmit` — clean
- `bun test ./packages/plugin/test/ ./companion/tests/` — **99 pass, 0 fail**
- `scripts/validate-commit.sh` — `ok` on every ticket commit
- No Godot binary on PATH: full suite green via mocks + `unavailable` paths

## Traceability (per-ticket commit SHA / Files / Verification)

Sequential commits on top of phase-2 HEAD `846ce82` (no merge commits).
Full table: `docs/AUDIT-TRACEABILITY.md`.

| Ticket | Commit SHA | Files | Verification |
| :--- | :--- | :--- | :--- |
| 3.1 Headless CLI syntax + type checker | `3d6579f` | `packages/plugin/src/verify/headless.ts`, `packages/plugin/test/headless.test.ts` | 99 pass, 0 fail (`bun test ./packages/plugin/test/ ./companion/tests/`); `scripts/validate-commit.sh` ok |
| 3.2 Scene + resource validator with headless harness | `2ed1db1` | `companion/validate_scene.gd`, `packages/plugin/src/verify/scene.ts`, `packages/plugin/test/scene.test.ts` | 99 pass, 0 fail; `scripts/validate-commit.sh` ok |
| 3.3 GUT test runner (TAP + JUnit parsing) | `0e25b12` | `packages/plugin/src/verify/gut.ts`, `packages/plugin/test/gut.test.ts` | 99 pass, 0 fail; `scripts/validate-commit.sh` ok |
| 3.4 Safety middleware + write guards | `194e1ac` | `packages/plugin/src/guards/middleware.ts`, `packages/plugin/test/middleware.test.ts` | 99 pass, 0 fail; `scripts/validate-commit.sh` ok |
| 3.5 Pre-commit validation hook | `03d7c06` | `packages/plugin/test/validate-commit.test.ts`, `scripts/validate-commit.sh` | 99 pass, 0 fail; `scripts/validate-commit.sh` ok |

## Notes

- `main` untouched; this PR targets `main` from `integration/phase-3` (5 commits on top of phase-2 HEAD `846ce82`).
- `MASTER_ORCHESTRATOR_PROMPT.md` (untracked, pre-existing) intentionally excluded.
- Worktree isolation was collapsed to sequential commits: single-agent execution,
  no parallel workers, so no cross-ticket interference was possible.

Traceability: docs/AUDIT-TRACEABILITY.md (Refs #3)
