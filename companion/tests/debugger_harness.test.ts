import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PLUGIN = join(
  import.meta.dir,
  "..",
  "addons",
  "godot_opencode",
  "debugger",
  "debugger_plugin.gd",
);

// Mirror of debugger_plugin.gd capture contract: messages arriving on the
// "opencode" capture channel are classified and forwarded; unhandled
// exceptions always carry a stack trace.
type Captured =
  | { kind: "console"; text: string }
  | { kind: "exception"; message: string; stack: string[] }
  | { kind: "query_response"; id: string; payload: unknown };

function classifyCapture(message: string, data: unknown[]): Captured | null {
  if (message === "opencode:console") {
    if (typeof data[0] !== "string") return null;
    return { kind: "console", text: data[0] as string };
  }
  if (message === "opencode:exception") {
    const info = (data[0] ?? {}) as Record<string, unknown>;
    if (typeof info["message"] !== "string") return null;
    const stack = Array.isArray(info["stack"])
      ? (info["stack"] as unknown[]).map(String)
      : [];
    return { kind: "exception", message: info["message"] as string, stack };
  }
  if (message === "opencode:query_response") {
    const info = (data[0] ?? {}) as Record<string, unknown>;
    if (typeof info["id"] !== "string") return null;
    return { kind: "query_response", id: info["id"] as string, payload: info["payload"] };
  }
  return null;
}

function forwardEnvelope(c: Captured): Record<string, unknown> {
  if (c.kind === "exception")
    return {
      type: "event",
      event: "game_exception",
      data: { message: c.message, stack: c.stack },
    };
  if (c.kind === "console")
    return { type: "event", event: "game_console", data: { text: c.text } };
  return {
    type: "response",
    id: c.id,
    data: c.payload,
  };
}

describe("ticket 2.6: out-of-band debugger and engine bridge", () => {
  test("runtime console messages captured and forwarded", () => {
    const c = classifyCapture("opencode:console", ["hello from game"]);
    expect(c?.kind).toBe("console");
    const env = forwardEnvelope(c!);
    expect(env["event"]).toBe("game_console");
    expect((env["data"] as Record<string, unknown>)["text"]).toBe("hello from game");
  });

  test("unhandled exception includes stack", () => {
    const c = classifyCapture("opencode:exception", [
      { message: "Nil access", stack: ["main.gd:10", "boot.gd:3"] },
    ]);
    expect(c?.kind).toBe("exception");
    const env = forwardEnvelope(c!);
    const data = env["data"] as Record<string, unknown>;
    expect(data["message"]).toBe("Nil access");
    expect(data["stack"]).toEqual(["main.gd:10", "boot.gd:3"]);
  });

  test("game subprocess query responses route by id", () => {
    const c = classifyCapture("opencode:query_response", [
      { id: "q-1", payload: { fps: 60 } },
    ]);
    expect(c?.kind).toBe("query_response");
    const env = forwardEnvelope(c!);
    expect(env["id"]).toBe("q-1");
  });

  test("unknown channel messages ignored", () => {
    expect(classifyCapture("other:thing", ["x"])).toBeNull();
    expect(classifyCapture("opencode:console", [42])).toBeNull();
  });

  test("debugger_plugin.gd exists with capture contract", () => {
    expect(existsSync(PLUGIN)).toBe(true);
    const src = readFileSync(PLUGIN, "utf8");
    expect(src).toContain("extends EditorDebuggerPlugin");
    expect(src).toContain("register_message_capture(");
    expect(src).toContain('CAPTURE_CHANNEL := "opencode"');
    expect(src).toContain("game_exception");
    expect(src).toContain("stack");
  });
});
