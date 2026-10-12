# Architecture — godot-opencode 1.0.0

## Layout

```text
packages/plugin/src/
  bindings/   tool definitions + JSON-RPC (transform-compatible adapters)
  transport/  WebSocket bridge client, handshake, circuit breaker
  guards/     safety middleware, write guards, pre-commit validation
  session/    session registry, context packing
  studio/     agents roster, director gates, slash commands, shaders/themes
  verify/     headless checker, GUT runner, scene validator, production E2E
  vision/     viewport framing math + stale-aware capture parsing
  indexer/    .tscn/.tres + project.godot indexing, Markdown arch map
  security/   capability handshake
  effect.ts   Effect-wrapped plugin entry
companion/addons/godot_opencode/
  plugin.gd            addon lifecycle, command registration
  dispatcher.gd        frame-budgeted FIFO command queue
  connection.gd        loopback JSON-RPC server
  viewport_handler.gd  2D/3D capture, AABB framing, stale fallback
  handlers/            node, signal, resource, shader, theme domains
  debugger/            runtime capture bridge plugin
  undo_manager.gd      atomic undoable writes
```

## Key decisions

- **Zero-Python**: Bun shells out to the Godot CLI; every runner has a
  mock-injectable `runFn` so tests pass without an engine.
- **Graceful degradation**: missing binary → `unavailable`; stalled main
  loop (>1000 ms) → `stale` frame fallback. Vision/indexing tickets
  never hard-require a viewport.
- **Undoable writes**: all companion mutations route through
  `UndoManager` as single editor undo actions.
- **Indexer grammar**: VariantParser subset (`gd_scene, ext_resource,
  node, connection`) + `project.godot [autoload]`; renders autoload,
  hierarchy, signal-graph, and script-usage tables as Markdown.
