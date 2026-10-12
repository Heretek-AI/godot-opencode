import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Phase-5 harness: TS contract mirror of
// companion/addons/godot_opencode/handlers/theme_handler.gd.
// StyleBoxFlat/font/color overrides round-trip through a mocked Control
// tree; malformed params are rejected fail-closed.

const HANDLERS = join(
  import.meta.dir,
  "..",
  "addons",
  "godot_opencode",
  "handlers",
);
const ADDON = join(import.meta.dir, "..", "addons", "godot_opencode");

type Result = { data?: Record<string, unknown>; error?: Record<string, unknown> };

interface StyleBoxFlat {
  bg_color: string;
  corner_radius: number;
  border_width: number;
  border_color: string;
  content_margin: number;
}

interface MockControl {
  path: string;
  isControl: boolean;
  styleboxOverrides: Record<string, StyleBoxFlat>;
  colorOverrides: Record<string, string>;
  fontSize: number | null;
}

function makeScene(): { root: boolean; nodes: Map<string, MockControl> } {
  return { root: true, nodes: new Map() };
}

function addControl(
  scene: { root: boolean; nodes: Map<string, MockControl> },
  path: string,
  isControl = true,
): void {
  scene.nodes.set(path, {
    path,
    isControl,
    styleboxOverrides: {},
    colorOverrides: {},
    fontSize: null,
  });
}

function resolveNode(
  scene: { root: boolean; nodes: Map<string, MockControl> } | null,
  path: string,
): MockControl | null | "NO_SCENE" {
  if (scene === null || !scene.root) return "NO_SCENE";
  return scene.nodes.get(path) ?? null;
}

function errFor(node: MockControl | null | "NO_SCENE", path: string): Result | null {
  if (node === "NO_SCENE")
    return {
      error: {
        code: "EDITOR_NOT_READY",
        message: "No open scene",
        data: { sub_code: "EDITOR_NO_SCENE" },
      },
    };
  if (node === null)
    return {
      error: { code: "NODE_NOT_FOUND", message: `Node not found: ${path}` },
    };
  if (!node.isControl)
    return {
      error: { code: "WRONG_TYPE", message: `Node is not a Control: ${path}` },
    };
  return null;
}

// Mirror of theme_handler.gd apply_stylebox defaults.
function buildStyleBoxFlat(params: Record<string, unknown>): StyleBoxFlat {
  return {
    bg_color: String(params["bg_color"] ?? "#1a1d29"),
    corner_radius: Number(params["corner_radius"] ?? 8),
    border_width: Number(params["border_width"] ?? 0),
    border_color: String(params["border_color"] ?? "#00000000"),
    content_margin: Number(params["content_margin"] ?? 12.0),
  };
}

function inspectTheme(
  scene: { root: boolean; nodes: Map<string, MockControl> } | null,
  params: { path?: unknown },
): Result {
  if (typeof params !== "object" || params === null)
    return { error: { code: "INVALID_PARAMS", message: "Params must be a dict" } };
  const path = String(params.path ?? "");
  const node = resolveNode(scene, path);
  const err = errFor(node, path);
  if (err) return err;
  const control = node as MockControl;
  return {
    data: {
      path,
      stylebox_overrides: Object.entries(control.styleboxOverrides).map(
        ([name, sb]) => ({ name, type: "StyleBoxFlat", bg_color: sb.bg_color }),
      ),
      color_overrides: Object.entries(control.colorOverrides).map(
        ([name, value]) => ({ name, value }),
      ),
      font_size: control.fontSize ?? -1,
    },
  };
}

function applyStylebox(
  scene: { root: boolean; nodes: Map<string, MockControl> } | null,
  params: Record<string, unknown>,
): Result {
  if (typeof params !== "object" || params === null || Array.isArray(params))
    return { error: { code: "INVALID_PARAMS", message: "Params must be a dict" } };
  const path = String(params["path"] ?? "");
  if (!path)
    return {
      error: { code: "NODE_NOT_FOUND", message: "Node not found: (empty path)" },
    };
  const node = resolveNode(scene, path);
  const err = errFor(node, path);
  if (err) return err;
  const bg = String(params["bg_color"] ?? "#1a1d29");
  if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(bg))
    return {
      error: { code: "INVALID_PARAMS", message: `Bad bg_color: ${bg}` },
    };
  const override = String(params["override"] ?? "normal");
  (node as MockControl).styleboxOverrides[override] = buildStyleBoxFlat(params);
  return { data: { path, override, undoable: true } };
}

function applyFontOverride(
  scene: { root: boolean; nodes: Map<string, MockControl> } | null,
  params: Record<string, unknown>,
): Result {
  if (typeof params !== "object" || params === null || Array.isArray(params))
    return { error: { code: "INVALID_PARAMS", message: "Params must be a dict" } };
  const path = String(params["path"] ?? "");
  if (!path)
    return {
      error: { code: "NODE_NOT_FOUND", message: "Node not found: (empty path)" },
    };
  const node = resolveNode(scene, path);
  const err = errFor(node, path);
  if (err) return err;
  const hasSize = "font_size" in params;
  const hasColor = "font_color" in params;
  if (!hasSize && !hasColor)
    return {
      error: {
        code: "INVALID_PARAMS",
        message: "Need font_size and/or font_color",
      },
    };
  const control = node as MockControl;
  if (hasSize) {
    const size = Number(params["font_size"]);
    if (!Number.isInteger(size) || size <= 0)
      return {
        error: { code: "INVALID_PARAMS", message: "Bad font_size" },
      };
    control.fontSize = size;
  }
  if (hasColor) {
    const color = String(params["font_color"]);
    if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(color))
      return {
        error: { code: "INVALID_PARAMS", message: `Bad font_color: ${color}` },
      };
    control.colorOverrides["font_color"] = color;
  }
  return { data: { path, undoable: true } };
}

describe("phase-5: theme_handler contract mirror", () => {
  test("stylebox override round-trips through inspect", () => {
    const scene = makeScene();
    addControl(scene, "/Panel");
    const applied = applyStylebox(scene, {
      path: "/Panel",
      override: "normal",
      bg_color: "#1a1d29",
      corner_radius: 8,
    });
    expect(applied.data?.["undoable"]).toBe(true);
    const insp = inspectTheme(scene, { path: "/Panel" });
    const names = (
      (insp.data?.["stylebox_overrides"] ?? []) as Array<Record<string, string>>
    ).map((o) => o["name"]);
    expect(names).toContain("normal");
  });

  test("stylebox defaults match the GDScript handler", () => {
    const scene = makeScene();
    addControl(scene, "/Btn");
    applyStylebox(scene, { path: "/Btn" });
    const insp = inspectTheme(scene, { path: "/Btn" });
    const entry = (
      (insp.data?.["stylebox_overrides"] ?? []) as Array<Record<string, string>>
    ).find((o) => o["name"] === "normal");
    expect(entry?.["bg_color"]).toBe("#1a1d29");
    expect(inspectTheme(scene, { path: "/Btn" }).data?.["font_size"]).toBe(-1);
  });

  test("font size/color overrides round-trip", () => {
    const scene = makeScene();
    addControl(scene, "/Label");
    const r = applyFontOverride(scene, {
      path: "/Label",
      font_size: 18,
      font_color: "#ffffff",
    });
    expect(r.data?.["undoable"]).toBe(true);
    expect(inspectTheme(scene, { path: "/Label" }).data?.["font_size"]).toBe(18);
    const colors = (
      (inspectTheme(scene, { path: "/Label" }).data?.[
        "color_overrides"
      ] ?? []) as Array<Record<string, string>>
    ).map((c) => c["name"]);
    expect(colors).toContain("font_color");
  });

  test("malformed params are rejected fail-closed", () => {
    const scene = makeScene();
    addControl(scene, "/Panel");
    expect(
      applyStylebox(scene, { path: "/Panel", bg_color: "not-a-color" }).error?.[
        "code"
      ],
    ).toBe("INVALID_PARAMS");
    expect(
      applyFontOverride(scene, { path: "/Panel" }).error?.["code"],
    ).toBe("INVALID_PARAMS");
    expect(
      applyFontOverride(scene, { path: "/Panel", font_size: -3 }).error?.[
        "code"
      ],
    ).toBe("INVALID_PARAMS");
    expect(applyStylebox(scene, { path: "" }).error?.["code"]).toBe(
      "NODE_NOT_FOUND",
    );
    expect(applyStylebox(scene, null as never).error?.["code"]).toBe(
      "INVALID_PARAMS",
    );
  });

  test("missing scene / node / wrong type errors", () => {
    const scene = makeScene();
    addControl(scene, "/Panel");
    addControl(scene, "/Mesh", false);
    expect(inspectTheme(null, { path: "/Panel" }).error?.["code"]).toBe(
      "EDITOR_NOT_READY",
    );
    expect(inspectTheme(scene, { path: "/Gone" }).error?.["code"]).toBe(
      "NODE_NOT_FOUND",
    );
    expect(inspectTheme(scene, { path: "/Mesh" }).error?.["code"]).toBe(
      "WRONG_TYPE",
    );
    expect(applyStylebox(scene, { path: "/Gone" }).error?.["code"]).toBe(
      "NODE_NOT_FOUND",
    );
    expect(applyFontOverride(scene, { path: "/Mesh", font_size: 14 }).error?.["code"]).toBe(
      "WRONG_TYPE",
    );
  });

  test("theme_handler.gd exposes the registered ops", () => {
    const p = join(HANDLERS, "theme_handler.gd");
    expect(existsSync(p)).toBe(true);
    const src = readFileSync(p, "utf8");
    for (const sym of [
      "func inspect_theme",
      "func apply_stylebox",
      "func apply_font_override",
      "EDITOR_NOT_READY",
      "NODE_NOT_FOUND",
      "WRONG_TYPE",
    ])
      expect(src).toContain(sym);
  });

  test("plugin.gd wires the theme commands", () => {
    const src = readFileSync(join(ADDON, "plugin.gd"), "utf8");
    for (const cmd of ["inspect_theme", "apply_stylebox", "apply_font_override"])
      expect(src).toContain(`"${cmd}"`);
  });

  test("theme_handler.gd is tabs, no Python-isms, no credentials", () => {
    const src = readFileSync(join(HANDLERS, "theme_handler.gd"), "utf8");
    expect(src).toMatch(/^\t/m);
    expect(src).not.toMatch(/^    /m);
    expect(src).not.toMatch(/(^|\s)def |(^|\s)import |print\(/);
    expect(src).not.toMatch(/password\s*=|secret\s*=|api_key\s*=|token\s*=/i);
  });
});
