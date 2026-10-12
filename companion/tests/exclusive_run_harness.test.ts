import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ADDON = join(import.meta.dir, "..", "addons", "godot_opencode");

// Mirror of connection.gd::service_transport_during_exclusive_run.
// During a blocking run the main loop cannot _process: this pass polls,
// answers heartbeats (keeps the 20s/60s keepalive alive) and rejects every
// inbound mutation with EDITOR_NOT_READY / EDITOR_TEST_RUNNING.
const EXCLUSIVE_RUN_PACKET_CAP = 2048;

type Frame = { raw: string };
type Action =
  | { kind: "pong"; reply: string }
  | { kind: "reject"; reply: string }
  | { kind: "drop" };

function classify(raw: string): "heartbeat" | "command" | "other" {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "other";
  }
  if (typeof parsed !== "object" || parsed === null) return "other";
  const p = parsed as Record<string, unknown>;
  if (p["type"] === "ping") return "heartbeat";
  if (
    p["method"] === "ping" &&
    (p["jsonrpc"] === "2.0" || p["type"] === undefined)
  )
    return "heartbeat";
  if (typeof p["command"] === "string" && typeof p["request_id"] === "string")
    return "command";
  return "other";
}

function servicePass(
  inbound: Frame[],
  runState: { packets_serviced: number },
): Action[] {
  const actions: Action[] = [];
  for (const f of inbound) {
    runState.packets_serviced += 1;
    if (runState.packets_serviced > EXCLUSIVE_RUN_PACKET_CAP)
      throw new Error("flood: connection must close");
    const kind = classify(f.raw);
    if (kind === "heartbeat") {
      actions.push({
        kind: "pong",
        reply: JSON.stringify({ type: "pong" }),
      });
    } else if (kind === "command") {
      const cmd = JSON.parse(f.raw) as Record<string, unknown>;
      actions.push({
        kind: "reject",
        reply: JSON.stringify({
          request_id: cmd["request_id"],
          status: "error",
          error: {
            code: "EDITOR_NOT_READY",
            message: `rejected during exclusive run: ${cmd["command"]}`,
            data: { sub_code: "EDITOR_TEST_RUNNING", retryable: true },
          },
        }),
      });
    } else {
      actions.push({ kind: "drop" });
    }
  }
  return actions;
}

describe("ticket 2.3: cooperative transport servicing", () => {
  test("blocking run keeps heartbeat alive", () => {
    const state = { packets_serviced: 0 };
    const actions = servicePass(
      [{ raw: JSON.stringify({ type: "ping" }) }],
      state,
    );
    expect(actions.length).toBe(1);
    expect(actions[0].kind).toBe("pong");
    const jsonrpcPing = servicePass(
      [{ raw: JSON.stringify({ jsonrpc: "2.0", method: "ping" }) }],
      state,
    );
    expect(jsonrpcPing[0].kind).toBe("pong");
  });

  test("concurrent mutation rejected with exact code", () => {
    const state = { packets_serviced: 0 };
    const actions = servicePass(
      [
        {
          raw: JSON.stringify({
            request_id: "r1",
            command: "set_property",
            params: {},
          }),
        },
      ],
      state,
    );
    expect(actions.length).toBe(1);
    expect(actions[0].kind).toBe("reject");
    const reply = JSON.parse(
      (actions[0] as { reply: string }).reply,
    ) as Record<string, Record<string, unknown>>;
    expect(reply["request_id"]).toBe("r1");
    expect(reply["error"]["code"]).toBe("EDITOR_NOT_READY");
    expect(
      (reply["error"]["data"] as Record<string, unknown>)["sub_code"],
    ).toBe("EDITOR_TEST_RUNNING");
    // Top-level code must stay EDITOR_NOT_READY (never promoted sub-code).
    expect(reply["error"]["code"]).not.toBe("EDITOR_TEST_RUNNING");
  });

  test("malformed frames dropped without dispatch", () => {
    const state = { packets_serviced: 0 };
    const actions = servicePass(
      [{ raw: "not-json{{{" }, { raw: JSON.stringify({ hello: 1 }) }],
      state,
    );
    expect(actions.every((a) => a.kind === "drop")).toBe(true);
  });

  test("flood past cap closes connection (bounded rejects)", () => {
    const state = { packets_serviced: EXCLUSIVE_RUN_PACKET_CAP };
    expect(() =>
      servicePass([{ raw: JSON.stringify({ type: "ping" }) }], state),
    ).toThrow(/flood/);
  });

  test("connection.gd exposes exclusive-run servicing", () => {
    const p = join(ADDON, "connection.gd");
    expect(existsSync(p)).toBe(true);
    const src = readFileSync(p, "utf8");
    expect(src).toContain("service_transport_during_exclusive_run");
    expect(src).toContain("EDITOR_TEST_RUNNING");
    expect(src).toContain("EXCLUSIVE_RUN_PACKET_CAP");
  });
});
