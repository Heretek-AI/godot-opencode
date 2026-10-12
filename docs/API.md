# API — godot-opencode 1.0.0

## Bridge tools (`godot_*`)

| Tool | Bridge method | Purpose |
|---|---|---|
| `godot_editor_state` | `editor_state` | Editor state snapshot |
| `godot_scene_get_hierarchy` | `scene_get_hierarchy` | Scene hierarchy |
| `godot_node_get_properties` | `node_get_properties` | Node properties |
| `godot_session_activate` | `session_activate` | Session switch |
| `godot_capture_viewport` | `capture_viewport` | Viewport PNG (base64), stale fallback past 1000 ms |
| `godot_shader_generate` | `generate_shader` | spatial/canvas-item shader + uniforms |
| `godot_theme_apply_style` | `apply_stylebox` | StyleBoxFlat / font / color overrides |

Companion dispatch adds: `frame_aabb`, `capture_status`,
`inject_uniform`, `list_uniforms`, `inspect_theme`,
`apply_font_override`, plus the Phase ≤4 node/signal/resource set.

## TypeScript modules

- `src/vision/viewport.ts` — `frameAABB`, `isStaleFrame`,
  `buildCaptureParams`, `parseCaptureResult`, `executeCaptureViewport`,
  `MAIN_LOOP_STALL_MSEC = 1000`.
- `src/studio/shaders.ts` — `generateShader`, `injectUniform`,
  `listUniforms`, `buildStyleBoxFlat`, `applyStyleOverride`,
  `buildFontOverride`.
- `src/indexer/project.ts` — `parseTscn`, `parseProjectGodot`,
  `indexProject(fs)`, `renderArchitectureMap`.
- `src/verify/production.ts` — `runProductionPipeline` (mock-friendly
  E2E orchestrator; stages: `devStory, scene, script, signal, hudStyle,
  gut, headless, viewport`).
- `src/studio/commands.ts` — `/setup-godot /adr /dev-story /story-done
  /gate-check`.

## Status model

`ok | error | unavailable | timeout`, plus pipeline-tolerated
`unavailable-tolerated` (no binary) and `stale-tolerated` (stalled main
loop). Tolerated statuses keep CI green without an engine.
