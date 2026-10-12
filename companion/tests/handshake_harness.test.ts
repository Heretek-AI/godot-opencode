import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Ticket 2.1 harness: companion-side handshake verification logic mirrored
// in TS (GDScript runtime has no headless binary here). The GDScript
// connection.gd implements the same contract: HMAC-SHA256 over the canonical
// transcript "nonce:port:role", constant-time compare, generic reject.
import {
  createHandshakeProof,
  verifyHandshakeProof,
} from "../../packages/plugin/src/security/handshake";
import { generateCapabilities } from "../../packages/plugin/src/security/capability";

const ADDON = join(
  import.meta.dir,
  "..",
  "addons",
  "godot_opencode",
);

type Challenge = Record<string, unknown>;

// Mirror of connection.gd::_verify_auth_hello framing rules.
function verifyAuthHello(
  frame: unknown,
  wsCapability: string,
  port: number,
): { ok: true } | { ok: false; reason: string } {
  if (typeof frame !== "object" || frame === null || Array.isArray(frame))
    return { ok: false, reason: "malformed challenge" };
  const f = frame as Challenge;
  if (f["type"] !== "auth_hello") return { ok: false, reason: "malformed challenge" };
  const nonce = f["nonce"];
  const proof = f["proof"];
  if (typeof nonce !== "string" || !/^[0-9a-fA-F]{32}$/.test(nonce))
    return { ok: false, reason: "malformed challenge" };
  if (typeof proof !== "string" || !/^[0-9a-f]{64}$/.test(proof))
    return { ok: false, reason: "malformed challenge" };
  const ok = verifyHandshakeProof(wsCapability, nonce, port, "server", proof);
  return ok ? { ok: true } : { ok: false, reason: "authentication failed" };
}

describe("ticket 2.1: authenticated websocket handshake", () => {
  test("handshake success with valid proof", () => {
    const caps = generateCapabilities();
    const nonce = "ab".repeat(16);
    const proof = createHandshakeProof(caps.wsCapability, nonce, 9500, "server");
    const res = verifyAuthHello(
      { type: "auth_hello", nonce, proof },
      caps.wsCapability,
      9500,
    );
    expect(res.ok).toBe(true);
  });

  test("wrong-token reject (no credential detail in reason)", () => {
    const caps = generateCapabilities();
    const other = generateCapabilities();
    const nonce = "cd".repeat(16);
    const proof = createHandshakeProof(other.wsCapability, nonce, 9500, "server");
    const res = verifyAuthHello(
      { type: "auth_hello", nonce, proof },
      caps.wsCapability,
      9500,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.reason).toBe("authentication failed");
      expect(res.reason).not.toContain(caps.wsCapability);
    }
  });

  test("malformed challenge reject", () => {
    const caps = generateCapabilities();
    for (const bad of [
      null,
      "string",
      42,
      [],
      {},
      { type: "auth_hello" },
      { type: "auth_hello", nonce: "xyz", proof: "00".repeat(32) },
      { type: "auth_hello", nonce: "ab".repeat(16), proof: "short" },
      { type: "auth_hello", nonce: "ab".repeat(16) },
      { type: "wrong_type", nonce: "ab".repeat(16), proof: "00".repeat(32) },
      {
        type: "auth_hello",
        nonce: "ab".repeat(16),
        proof: "00".repeat(32),
        extra: "downgrade",
      },
    ]) {
      const res = verifyAuthHello(bad, caps.wsCapability, 9500);
      expect(res.ok).toBe(false);
    }
  });

  test("companion addon scaffold files exist", () => {
    for (const f of ["plugin.cfg", "plugin.gd", "connection.gd"]) {
      expect(existsSync(join(ADDON, f))).toBe(true);
    }
  });

  test("connection.gd has no credential leakage", () => {
    const src = readFileSync(join(ADDON, "connection.gd"), "utf8");
    expect(src).toContain("constant_time_equal");
    expect(src).not.toMatch(/print.*token|push_error.*token|push_warning.*capability/i);
    // Generic reject reason only.
    expect(src).toContain("authentication failed");
  });
});
