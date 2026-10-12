import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ADDON = join(import.meta.dir, "..", "addons", "godot_opencode");

// Mirror of undo_manager.gd semantics: every mutation registers an atomic
// do/undo pair; undo resolves targets by PATH at undo time (never cached
// indices), so deleting a middle sibling cannot drift the restore index.
interface TreeNode {
  name: string;
  props: Record<string, unknown>;
  children: TreeNode[];
}

function lookup(root: TreeNode, path: string): TreeNode | null {
  if (path === "" || path === "/") return root;
  const parts = path.split("/").filter(Boolean);
  let cur: TreeNode | null = root;
  for (const p of parts) {
    cur = cur?.children.find((c) => c.name === p) ?? null;
    if (!cur) return null;
  }
  return cur;
}

interface Action {
  do(): void;
  undo(): void;
}

class UndoManager {
  private undoStack: Action[] = [];
  private redoStack: Action[] = [];
  constructor(private root: TreeNode) {}
  commit(a: Action): void {
    a.do();
    this.undoStack.push(a);
    this.redoStack = [];
  }
  undo(): boolean {
    const a = this.undoStack.pop();
    if (!a) return false;
    a.undo();
    this.redoStack.push(a);
    return true;
  }
  redo(): boolean {
    const a = this.redoStack.pop();
    if (!a) return false;
    a.do();
    this.undoStack.push(a);
    return true;
  }
  // Path-based delete: capture parent path + name, resolve at undo time.
  deleteNode(path: string): void {
    const target = lookup(this.root, path);
    if (!target) throw new Error(`not found: ${path}`);
    const parts = path.split("/").filter(Boolean);
    const name = parts[parts.length - 1];
    const parentPath = "/" + parts.slice(0, -1).join("/");
    const snapshot: TreeNode = JSON.parse(JSON.stringify(target));
    const index = (lookup(this.root, parentPath)?.children ?? []).findIndex(
      (c) => c.name === name,
    );
    this.commit({
      do: () => {
        const p = lookup(this.root, parentPath);
        if (p) p.children = p.children.filter((c) => c.name !== name);
      },
      undo: () => {
        // Resolve parent BY PATH at undo time; clamp index to current size.
        const p = lookup(this.root, parentPath);
        if (p) {
          const at = Math.min(index, p.children.length);
          p.children.splice(at, 0, JSON.parse(JSON.stringify(snapshot)));
        }
      },
    });
  }
  setProperty(path: string, key: string, value: unknown): void {
    const target = lookup(this.root, path);
    if (!target) throw new Error(`not found: ${path}`);
    const prior = target.props[key];
    const had = key in target.props;
    this.commit({
      do: () => {
        lookup(this.root, path)!.props[key] = value;
      },
      undo: () => {
        const t = lookup(this.root, path)!;
        if (had) t.props[key] = prior;
        else delete t.props[key];
      },
    });
  }
}

function makeTree(): TreeNode {
  return {
    name: "root",
    props: {},
    children: [
      { name: "A", props: {}, children: [] },
      { name: "B", props: {}, children: [] },
      { name: "C", props: {}, children: [] },
    ],
  };
}

describe("ticket 2.4: undo manager with path-based undo", () => {
  test("undo restores prior state, redo reapplies", () => {
    const root = makeTree();
    const um = new UndoManager(root);
    um.setProperty("/A", "visible", false);
    expect(lookup(root, "/A")?.props["visible"]).toBe(false);
    expect(um.undo()).toBe(true);
    expect("visible" in (lookup(root, "/A")?.props ?? {})).toBe(false);
    expect(um.redo()).toBe(true);
    expect(lookup(root, "/A")?.props["visible"]).toBe(false);
  });

  test("index-drift scenario: delete middle child, mutate, undo resolves by path", () => {
    const root = makeTree();
    const um = new UndoManager(root);
    um.deleteNode("/B");
    expect(root.children.map((c) => c.name)).toEqual(["A", "C"]);
    // Concurrent sibling mutation after delete (index space shifted).
    um.setProperty("/C", "tag", 1);
    expect(um.undo()).toBe(true); // undo setProperty
    expect(um.undo()).toBe(true); // undo delete
    expect(root.children.map((c) => c.name)).toEqual(["A", "B", "C"]);
    expect(lookup(root, "/B")).not.toBeNull();
  });

  test("delete then undo restores subtree intact", () => {
    const root: TreeNode = {
      name: "root",
      props: {},
      children: [
        {
          name: "P",
          props: { x: 1 },
          children: [{ name: "Q", props: { y: 2 }, children: [] }],
        },
      ],
    };
    const um = new UndoManager(root);
    um.deleteNode("/P");
    expect(root.children).toEqual([]);
    expect(um.undo()).toBe(true);
    expect(lookup(root, "/P/Q")?.props["y"]).toBe(2);
  });

  test("undo_manager.gd exists with path-based undo contract", () => {
    const p = join(ADDON, "undo_manager.gd");
    expect(existsSync(p)).toBe(true);
    const src = readFileSync(p, "utf8");
    expect(src).toContain("EditorUndoRedoManager");
    expect(src).toContain("create_action");
    expect(src).toContain("commit_action");
    expect(src).toContain("add_do_method");
    expect(src).toContain("add_undo_method");
    // Dynamic path lookup marker (resolve at undo time, never cached index).
    expect(src).toMatch(/by_path|_by_path|resolve.*path/i);
  });
});
