# Release 0.2.0: Phase 2 · Godot Editor Companion Addon

Phase 2 builds the GDScript companion addon in `companion/addons/godot_opencode/`,
the editor-side half of the godot-opencode bridge. It listens loopback-only on
port 9500, authenticates the OpenCode plugin side over the per-port loopback
capability token, and executes editor mutations on the main thread inside a
frame budget. Phase 1 (plugin TS: effect lifecycle, capability/HMAC, WS+JSONRPC,
registry/circuit, bindings) is the peer this addon talks to.

No Godot binary is available in CI for this milestone, so GDScript behavior is
pinned by headless-mock TS harnesses (`companion/tests/`, 28 tests) that mirror
the addon contracts plus GDScript static syntax checks (tabs, no Python-isms,
no credential leakage). Live-editor verification is tracked as follow-up.

## What landed (tickets 2.1–2.6, each merged `--no-ff` with QA + auditor PASS)

- **2.1 — Addon scaffold & authenticated WebSocket server**
  `plugin.cfg`, `plugin.gd` (`_enter_tree`/`_exit_tree`), `connection.gd`
  (TCPServer on 127.0.0.1:9500 + WebSocketPeer upgrade), `utils/error_codes.gd`.
  First frame must be `auth_hello` proving HMAC-SHA256 over
  `nonce:9500:server` with the `websocket` capability token; constant-time
  compare; generic reject reasons only (no credential leakage).
- **2.2 — Main-thread frame budgeter & dispatcher** (`dispatcher.gd`)
  FIFO queue, `PACKET_DRAIN_CAP_PER_TICK=32`, `budget_ms=4.0` per tick, spillover
  counter; connection enqueues decoded frames and routes responses by
  `request_id` back to the issuing peer.
- **2.3 — Cooperative transport servicing during blocking runs**
  `service_transport_during_exclusive_run()`: polls peers directly while the
  main thread is blocked, answers heartbeat pongs (keeps the 20s/60s keepalive
  alive), rejects inbound mutations with `EDITOR_NOT_READY` /
  `EDITOR_TEST_RUNNING` (sub-code never promoted), 2048-packet flood cap.
- **2.4 — EditorUndoRedoManager & dynamic node mutation** (`undo_manager.gd`)
  Add/delete/rename/set-property as atomic actions; undo steps re-resolve
  targets **by path at undo time** (index clamp on reinsert) — middle-child
  deletes and reorder-between-do-and-undo cannot drift.
- **2.5 — Core domain handlers** (`handlers/`)
  `node_handler` (create/delete/reparent/set-property + `instantiate_scene`
  with `GEN_EDIT_STATE_INSTANCE`, invalid scene refs rejected),
  `signal_handler` (list/connect/disconnect, editor-internal filtered),
  `resource_handler` (search/load/inspect/assign for `.tres`/`.res`/uid).
  All registered on the dispatcher by `plugin.gd`.
- **2.6 — Out-of-band debugger & engine bridge** (`debugger/debugger_plugin.gd`)
  `EditorDebuggerPlugin` capturing the `opencode` channel: console lines,
  unhandled exceptions (always with stack), query responses routed by id;
  forwarded through the bridge connection as events.

## Gate (ticket 2.7)

- `bun x biome check ./packages/` — clean (22 files)
- `tsc --noEmit` — clean
- `bun test ./packages/plugin/test/` — 46 pass
- `bun test ./companion/tests/` — 28 pass

## Follow-up (not blocking)

- Live-editor verification once a Godot 4.x binary is available: enable addon
  in a test project, run handshake round-trip, exercise undo/redo and the
  exclusive-run heartbeat path against the real `EditorUndoRedoManager`.

## Traceability (per-ticket SHA / Files / Verification)

Phase-2 HEAD: `846ce82` (merge of ticket 2.6). Full table: `docs/AUDIT-TRACEABILITY.md`.

| Ticket | Feature SHA | Merge SHA | Files | Verification |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 Addon scaffold + authenticated WebSocket server | `4913cd5` | `0c6721d` | `companion/addons/godot_opencode/connection.gd`, `companion/addons/godot_opencode/plugin.cfg`, `companion/addons/godot_opencode/plugin.gd`, `companion/addons/godot_opencode/utils/error_codes.gd`, `companion/tests/handshake_harness.test.ts` | 74 pass, 0 fail (`bun test ./packages/plugin/test/ ./companion/tests/`) |
| 2.2 Main-thread frame budgeter + dispatcher | `6071b3b` | `df6ed72` | `companion/addons/godot_opencode/connection.gd`, `companion/addons/godot_opencode/dispatcher.gd`, `companion/tests/dispatcher_harness.test.ts` | 74 pass, 0 fail |
| 2.3 Cooperative transport servicing during blocking runs | `a5ccd8f` | `1188d7e` | `companion/addons/godot_opencode/connection.gd`, `companion/tests/exclusive_run_harness.test.ts` | 74 pass, 0 fail |
| 2.4 EditorUndoRedoManager with path-based undo | `8b00c79` | `f5b0419` | `companion/addons/godot_opencode/undo_manager.gd`, `companion/tests/undo_harness.test.ts` | 74 pass, 0 fail |
| 2.5 Core domain handlers (node/signal/resource) | `65ca60e` | `94c2ec4` | `companion/addons/godot_opencode/connection.gd`, `companion/addons/godot_opencode/handlers/node_handler.gd`, `companion/addons/godot_opencode/handlers/resource_handler.gd`, `companion/addons/godot_opencode/handlers/signal_handler.gd`, `companion/addons/godot_opencode/plugin.gd`, `companion/tests/handlers_harness.test.ts` | 74 pass, 0 fail |
| 2.6 Out-of-band debugger + engine bridge | `fc8f263` | `846ce82` | `companion/addons/godot_opencode/connection.gd`, `companion/addons/godot_opencode/debugger/debugger_plugin.gd`, `companion/addons/godot_opencode/plugin.gd`, `companion/tests/debugger_harness.test.ts` | 74 pass, 0 fail |

## Summary by Sourcery

Deliver the Phase 2 Godot Editor companion and complete the core authenticated bridge, editor mutation, debugger integration, and plugin-side transport foundations.

New Features:
- Add a Godot Editor companion addon with an authenticated loopback WebSocket bridge on port 9500.
- Support undoable scene-node, signal, and resource editor operations with main-thread dispatch and frame-budget enforcement.
- Bridge Godot debugger console output, exceptions, and engine query responses to the plugin side.
- Add the TypeScript plugin lifecycle, Godot tool/RPC bindings, secure capability storage, HMAC handshake, session readiness, circuit breaking, JSON-RPC, and WebSocket transport foundations.

Bug Fixes:
- Prevent editor mutations during exclusive runs while preserving heartbeat servicing and bounding packet floods.
- Make undo and redo resilient to node reordering and sibling index drift by resolving scene targets at operation time.
- Reject malformed, oversized, unauthenticated, or unsafe capability and transport data without exposing credentials.

Enhancements:
- Establish shared editor readiness and protocol error semantics across the TypeScript plugin and GDScript addon.

Build:
- Add Bun lockfile coverage for the expanded plugin and companion tooling.

Tests:
- Add headless TypeScript contract harnesses for the Godot addon and comprehensive plugin tests covering security, transport, lifecycle, bindings, sessions, and failure handling.

Traceability: docs/AUDIT-TRACEABILITY.md (Refs #2)
