import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Phase-5 harness: TS contract mirror of
// companion/addons/godot_opencode/handlers/shader_handler.gd.
// The GDScript handler owns runtime validation; this mirror pins the
// contract so CI (no Godot binary) still guards regressions.

const HANDLERS = join(
  import.meta.dir,
  "..",
  "addons",
  "godot_opencode",
  "handlers",
);
const ADDON = join(import.meta.dir, "..", "addons", "godot_opencode");

type Result = { data?: Record<string, unknown>; error?: Record<string, unknown> };

// Mirror of shader_handler.gd VALID_TYPES.
const VALID_TYPES = new Set([
  "spatial",
  "canvas_item",
  "particles",
  "sky",
  "fog",
]);

interface UniformEntry {
  name?: string;
  type?: string;
  hint?: string;
  default?: string;
}

function uniformDecl(entry: unknown): string {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry))
    return "";
  const d = entry as Record<string, unknown>;
  const name = String(d["name"] ?? "");
  const type = String(d["type"] ?? "");
  if (!name || !type) return "";
  let decl = `uniform ${type} ${name}`;
  if (String(d["hint"] ?? "") !== "") decl += ` : ${String(d["hint"])}`;
  if (String(d["default"] ?? "") !== "") decl += ` = ${String(d["default"])}`;
  return `${decl};`;
}

function generateShader(params: {
  mode?: string;
  uniforms?: unknown[];
  body?: string;
}): Result {
  const mode = String(params.mode ?? "spatial");
  if (!VALID_TYPES.has(mode))
    return {
      error: { code: "INVALID_PARAMS", message: `Unknown shader_type: ${mode}` },
    };
  const lines: string[] = [`shader_type ${mode};`];
  for (const entry of params.uniforms ?? []) {
    const decl = uniformDecl(entry);
    if (!decl)
      return {
        error: {
          code: "INVALID_PARAMS",
          message: "Uniform needs name + type",
        },
      };
    lines.push(decl);
  }
  let body = String(params.body ?? "");
  if (!body)
    body =
      mode === "spatial"
        ? "void fragment() {\n\tALBEDO = vec3(1.0);\n}"
        : "void fragment() {\n\tCOLOR = vec4(1.0);\n}";
  lines.push(body);
  return { data: { source: `${lines.join("\n")}\n`, mode } };
}

function injectUniform(params: { source?: string; uniform?: unknown }): Result {
  const source = String(params.source ?? "");
  if (!source.includes("shader_type"))
    return {
      error: {
        code: "INVALID_PARAMS",
        message: "Source has no shader_type header",
      },
    };
  const entry = params.uniform;
  const decl = uniformDecl(entry);
  if (!decl)
    return {
      error: { code: "INVALID_PARAMS", message: "Uniform needs name + type" },
    };
  const name =
    typeof entry === "object" && entry !== null
      ? String((entry as Record<string, unknown>)["name"] ?? "")
      : "";
  const dupRe = new RegExp(`^\\s*uniform\\s+\\S+\\s+${name}\\b`);
  const out: string[] = [];
  for (const line of source.split("\n")) {
    if (dupRe.test(line)) continue;
    out.push(line);
    if (line.includes("shader_type")) out.push(decl);
  }
  return { data: { source: out.join("\n") } };
}

function listUniforms(params: { source?: string }): Result {
  const found: Array<Record<string, string>> = [];
  for (const line of String(params.source ?? "").split("\n")) {
    const stripped = line.trim();
    if (!stripped.startsWith("uniform ")) continue;
    const parts = stripped.slice("uniform ".length).trim().split(/\s+/);
    if (parts.length >= 2)
      found.push({
        type: parts[0],
        name: parts[1].replace(/;$/, "").split(":")[0].split("=")[0].trim(),
      });
  }
  return { data: { uniforms: found } };
}

// Fail-closed dispatch mirror: only registered shader commands run;
// anything else is rejected, mirroring dispatcher.gd's UNKNOWN_COMMAND.
const SHADER_COMMANDS: Record<string, (p: never) => Result> = {
  generate_shader: generateShader as (p: never) => Result,
  inject_uniform: injectUniform as (p: never) => Result,
  list_uniforms: listUniforms as (p: never) => Result,
};

function dispatch(command: string, params: never): Result {
  const fn = SHADER_COMMANDS[command];
  if (!fn)
    return {
      error: { code: "UNKNOWN_COMMAND", message: `Unknown command: ${command}` },
    };
  return fn(params);
}

describe("phase-5: shader_handler contract mirror", () => {
  test("generate_shader accepts every valid shader_type", () => {
    for (const mode of ["spatial", "canvas_item", "particles", "sky", "fog"]) {
      const r = generateShader({ mode });
      expect(r.error).toBeUndefined();
      expect(r.data?.["mode"]).toBe(mode);
      expect(String(r.data?.["source"])).toContain(`shader_type ${mode};`);
    }
  });

  test("generate_shader rejects unknown mode with INVALID_PARAMS", () => {
    for (const bogus of ["bogus", "", "vertex", "SPATIAL", "compute"]) {
      const r = generateShader({ mode: bogus });
      expect(r.data).toBeUndefined();
      expect(r.error?.["code"]).toBe("INVALID_PARAMS");
    }
  });

  test("generate_shader rejects uniforms missing name or type", () => {
    expect(
      generateShader({ uniforms: [{ name: "tint" }] }).error?.["code"],
    ).toBe("INVALID_PARAMS");
    expect(generateShader({ uniforms: [{ type: "vec4" }] }).error?.["code"]).toBe(
      "INVALID_PARAMS",
    );
    expect(generateShader({ uniforms: ["tint"] }).error?.["code"]).toBe(
      "INVALID_PARAMS",
    );
    const ok = generateShader({
      mode: "canvas_item",
      uniforms: [{ name: "tint", type: "vec4", hint: "source_color" }],
    });
    expect(ok.data?.["mode"]).toBe("canvas_item");
    expect(String(ok.data?.["source"])).toContain(
      "uniform vec4 tint : source_color;",
    );
  });

  test("inject_uniform requires a shader_type header", () => {
    const r = injectUniform({
      source: "void fragment() {}",
      uniform: { name: "tint", type: "vec4" },
    });
    expect(r.error?.["code"]).toBe("INVALID_PARAMS");
  });

  test("inject_uniform replaces duplicates instead of doubling", () => {
    const src =
      "shader_type spatial;\nuniform vec4 tint;\nvoid fragment() {\n}\n";
    const once = injectUniform({
      source: src,
      uniform: { name: "tint", type: "vec4" },
    });
    const lines = String(once.data?.["source"]).split("\n");
    expect(lines.filter((l) => /uniform\s+\S+\s+tint\b/.test(l))).toHaveLength(1);
    expect(String(once.data?.["source"])).toContain("shader_type spatial;");
    const twice = injectUniform({
      source: String(once.data?.["source"]),
      uniform: { name: "tint", type: "vec3" },
    });
    const relines = String(twice.data?.["source"]).split("\n");
    expect(
      relines.filter((l) => /uniform\s+\S+\s+tint\b/.test(l)),
    ).toHaveLength(1);
    expect(String(twice.data?.["source"])).toContain("uniform vec3 tint;");
  });

  test("list_uniforms round-trips injected uniforms", () => {
    const made = generateShader({
      uniforms: [
        { name: "albedo_color", type: "vec4" },
        { name: "rough", type: "float" },
      ],
    });
    const listed = listUniforms({ source: String(made.data?.["source"]) });
    const names = (
      (listed.data?.["uniforms"] ?? []) as Array<Record<string, string>>
    ).map((u) => u["name"]);
    expect(names).toEqual(["albedo_color", "rough"]);
  });

  test("unknown-method dispatch fails closed", () => {
    for (const bad of ["compile_shader", "delete_shader", "", "GENERATE_SHADER"]) {
      const r = dispatch(bad, {} as never);
      expect(r.data).toBeUndefined();
      expect(r.error?.["code"]).toBe("UNKNOWN_COMMAND");
    }
    expect(dispatch("generate_shader", { mode: "sky" } as never).data?.["mode"]).toBe(
      "sky",
    );
  });

  test("shader_handler.gd exposes the registered ops", () => {
    const p = join(HANDLERS, "shader_handler.gd");
    expect(existsSync(p)).toBe(true);
    const src = readFileSync(p, "utf8");
    for (const sym of [
      "func generate_shader",
      "func inject_uniform",
      "func list_uniforms",
      "VALID_TYPES",
      "INVALID_PARAMS",
    ])
      expect(src).toContain(sym);
  });

  test("plugin.gd wires the shader commands", () => {
    const src = readFileSync(join(ADDON, "plugin.gd"), "utf8");
    for (const cmd of ["generate_shader", "inject_uniform", "list_uniforms"])
      expect(src).toContain(`"${cmd}"`);
  });

  test("shader_handler.gd is tabs, no Python-isms, no credentials", () => {
    const src = readFileSync(join(HANDLERS, "shader_handler.gd"), "utf8");
    expect(src).toMatch(/^\t/m);
    expect(src).not.toMatch(/^    /m);
    expect(src).not.toMatch(/(^|\s)def |(^|\s)import |print\(/);
    expect(src).not.toMatch(/password\s*=|secret\s*=|api_key\s*=|token\s*=/i);
  });
});
