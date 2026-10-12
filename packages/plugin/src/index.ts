// @opencode/godot — Godot Engine OpenCode v2 Native Plugin (zero-Python).
// Ticket scaffolds are implemented incrementally on integration/phase-N branches.
export const GODOT_BRIDGE_PORT = 9500;
export const GODOT_BRIDGE_HOST = "127.0.0.1";
export { ActivationScope } from "./effect";
export type { Disposer } from "./effect";
export { createGodotPlugin } from "./plugin";
export type {
  CreateGodotPluginOptions,
  GodotPlugin,
  GodotPluginContext,
  PluginCleanup,
} from "./plugin";
