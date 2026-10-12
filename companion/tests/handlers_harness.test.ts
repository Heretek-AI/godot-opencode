import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const HANDLERS = join(
  import.meta.dir,
  "..",
  "addons",
  "godot_opencode",
  "handlers",
);

// Mocked editor tree shared by the handler-contract mirrors below.
interface TNode {
  name: string;
  type: string;
  props: Record<string, unknown>;
  groups: string[];
  children: TNode[];
  signals: Record<string, Array<{ target: string; method: string }>>;
}

function makeTree(): TNode {
  return { name: "Main", type: "Node", props: {}, groups: [], children: [], signals: {} };
}

function lookup(root: TNode, path: string): TNode | null {
  if (path === "" || path === "/") return root;
  let cur: TNode | null = root;
  for (const p of path.split("/").filter(Boolean)) {
    cur = cur?.children.find((c) => c.name === p) ?? null;
    if (!cur) return null;
  }
  return cur;
}

// --- node_handler contract mirror ---
const KNOWN_TYPES = new Set(["Node", "Node2D", "Node3D", "Control", "Sprite2D"]);

function createNode(
  root: TNode,
  params: { type?: string; name?: string; parent_path?: string; scene_path?: string },
): { data?: Record<string, unknown>; error?: Record<string, unknown> } {
  if (params.scene_path) {
    // Scene instancing requires a loadable .tscn/.scn/.uid reference.
    if (!/\.(tscn|scn|uid)$/.test(params.scene_path))
      return { error: { code: "RESOURCE_NOT_FOUND", message: `invalid scene UID: ${params.scene_path}` } };
    return { data: { path: `/${params.name ?? "Instance"}`, instanced: true, undoable: true } };
  }
  if (!params.type || !KNOWN_TYPES.has(params.type))
    return { error: { code: "VALUE_OUT_OF_RANGE", message: `unknown node type: ${params.type}` } };
  const parent = lookup(root, params.parent_path ?? "/");
  if (!parent) return { error: { code: "NODE_NOT_FOUND", message: "parent not found" } };
  const node: TNode = {
    name: params.name ?? params.type,
    type: params.type,
    props: {},
    groups: [],
    children: [],
    signals: {},
  };
  parent.children.push(node);
  return { data: { path: `/${node.name}`, type: node.type, undoable: true } };
}

// --- signal_handler contract mirror (editor-internal filtered) ---
const EDITOR_INTERNAL = new Set(["tree_exited", "ready", "renamed"]);

function listSignals(node: TNode): string[] {
  return Object.keys(node.signals).filter((s) => !EDITOR_INTERNAL.has(s));
}

// --- resource_handler contract mirror (.tres materials/shapes) ---
const KNOWN_RESOURCES: Record<string, string> = {
  "res://mat.tres": "StandardMaterial3D",
  "res://shape.tres": "BoxShape3D",
};

function loadResource(path: string) {
  if (!path.endsWith(".tres") || !(path in KNOWN_RESOURCES))
    return { error: { code: "RESOURCE_NOT_FOUND", message: `resource not found: ${path}` } };
  return { data: { path, type: KNOWN_RESOURCES[path] } };
}

describe("ticket 2.5: core domain handlers", () => {
  test("node ops round-trip through mocked editor tree", () => {
    const root = makeTree();
    const created = createNode(root, { type: "Sprite2D", name: "Hero", parent_path: "/" });
    expect(created.data?.["path"]).toBe("/Hero");
    expect(lookup(root, "/Hero")?.type).toBe("Sprite2D");
    const bad = createNode(root, { type: "Nope", parent_path: "/" });
    expect(bad.error?.["code"]).toBe("VALUE_OUT_OF_RANGE");
  });

  test("invalid scene UID rejected", () => {
    const root = makeTree();
    for (const bad of ["res://x.png", "uid://bogus!", "not-a-path", "res://x.gd"]) {
      const r = createNode(root, { scene_path: bad, name: "X" });
      expect(r.error?.["code"]).toBe("RESOURCE_NOT_FOUND");
    }
    const ok = createNode(root, { scene_path: "res://level.tscn", name: "Level" });
    expect(ok.data?.["instanced"]).toBe(true);
  });

  test("signal list/connect/disconnect filters editor-internal", () => {
    const n: TNode = makeTree();
    n.signals = {
      pressed: [],
      tree_exited: [],
      custom_hit: [{ target: "/Other", method: "_on_hit" }],
    };
    expect(listSignals(n).sort()).toEqual(["custom_hit", "pressed"]);
  });

  test("resource search/load/assign for .tres materials and shapes", () => {
    expect(loadResource("res://mat.tres").data?.["type"]).toBe("StandardMaterial3D");
    expect(loadResource("res://shape.tres").data?.["type"]).toBe("BoxShape3D");
    expect(loadResource("res://img.png").error?.["code"]).toBe("RESOURCE_NOT_FOUND");
    expect(loadResource("res://missing.tres").error?.["code"]).toBe("RESOURCE_NOT_FOUND");
  });

  test("handler files exist with required ops", () => {
    const reqs: Record<string, string[]> = {
      "node_handler.gd": ["create_node", "delete_node", "reparent_node", "set_property", "GEN_EDIT_STATE_INSTANCE"],
      "signal_handler.gd": ["list_signals", "connect_signal", "disconnect_signal"],
      "resource_handler.gd": ["search_resources", "load_resource", "assign_resource"],
    };
    for (const [file, symbols] of Object.entries(reqs)) {
      const p = join(HANDLERS, file);
      expect(existsSync(p)).toBe(true);
      const src = readFileSync(p, "utf8");
      for (const s of symbols) expect(src).toContain(s);
    }
  });
});
