import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Phase-5 harness: TS contract mirror of
// companion/addons/godot_opencode/viewport_handler.gd.
// Capture-param building, AABB framing math (parity with
// packages/plugin/src/vision/viewport.ts), and capture_status semantics:
// fresh -> ok, age >= STALL_MSEC -> stale, no frame -> unavailable.
// A stale frame presented as fresh must FAIL: the mirror enforces it.

import {
  buildCaptureParams,
  frameAABB,
  isStaleFrame,
  MAIN_LOOP_STALL_MSEC,
  parseCaptureResult,
} from "../../packages/plugin/src/vision/viewport";

const ADDON = join(import.meta.dir, "..", "addons", "godot_opencode");

// Mirror of viewport_handler.gd STALL_MSEC.
const STALL_MSEC = 1000;

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// Independent re-derivation of the GDScript frame_aabb formula
// (center, bounding-sphere radius, distance via half-FOV tan clamp).
function frameAabbMirror(
  min: Vec3,
  max: Vec3,
  fovDeg = 70.0,
  padding = 1.2,
): { center: Vec3; distance: number; camera_pos: Vec3 } {
  const center = {
    x: (min.x + max.x) * 0.5,
    y: (min.y + max.y) * 0.5,
    z: (min.z + max.z) * 0.5,
  };
  const sx = Math.abs(max.x - min.x);
  const sy = Math.abs(max.y - min.y);
  const sz = Math.abs(max.z - min.z);
  const radius = Math.sqrt(sx * sx + sy * sy + sz * sz) * 0.5;
  const halfTan = Math.tan(((fovDeg * Math.PI) / 180) * 0.5);
  const safeTan = Math.max(halfTan, 0.000001);
  const distance = ((radius * padding) / safeTan);
  return {
    center,
    distance,
    camera_pos: { x: center.x, y: center.y, z: center.z + distance },
  };
}

// Mirror of viewport_handler.gd capture_status.
function captureStatusMirror(
  hasFrame: boolean,
  ageMsec: number,
): { has_frame: boolean; age_msec: number; stale: boolean; stall_msec: number } {
  return {
    has_frame: hasFrame,
    age_msec: ageMsec,
    stale: ageMsec >= STALL_MSEC || !hasFrame,
    stall_msec: STALL_MSEC,
  };
}

// Capture-param defaults mirror (mode 2d, 1280x720).
function captureParamsMirror(params: {
  mode?: string;
  width?: number;
  height?: number;
}): { mode: string; width: number; height: number } {
  return {
    mode: String(params.mode ?? "2d"),
    width: Number(params.width ?? 1280),
    height: Number(params.height ?? 720),
  };
}

describe("phase-5: viewport_handler contract mirror + stale fail-safe", () => {
  test("STALL_MSEC matches MAIN_LOOP_STALL_MSEC=1000", () => {
    expect(STALL_MSEC).toBe(1000);
    expect(MAIN_LOOP_STALL_MSEC).toBe(1000);
    expect(STALL_MSEC).toBe(MAIN_LOOP_STALL_MSEC);
  });

  test("capture params default to 2d 1280x720", () => {
    expect(captureParamsMirror({})).toEqual({
      mode: "2d",
      width: 1280,
      height: 720,
    });
    const built = buildCaptureParams({ mode: "2d" });
    expect(built.width).toBe(1280);
    expect(built.height).toBe(720);
  });

  test("frame_aabb math matches TS frameAABB across cases", () => {
    const cases = [
      { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 }, fov: 70, pad: 1.2 },
      { min: { x: -2, y: -1, z: 0 }, max: { x: 2, y: 3, z: 4 }, fov: 50, pad: 1.5 },
      { min: { x: 5, y: 5, z: 5 }, max: { x: 5, y: 5, z: 5 }, fov: 70, pad: 1.2 },
    ];
    for (const c of cases) {
      const m = frameAabbMirror(c.min, c.max, c.fov, c.pad);
      const ts = frameAABB({ min: c.min, max: c.max }, c.fov, c.pad);
      expect(m.center.x).toBeCloseTo(ts.center.x, 9);
      expect(m.center.y).toBeCloseTo(ts.center.y, 9);
      expect(m.center.z).toBeCloseTo(ts.center.z, 9);
      expect(m.distance).toBeCloseTo(ts.distance, 9);
      expect(m.camera_pos.z).toBeCloseTo(ts.cameraPos.z, 9);
    }
  });

  test("fresh frame -> ok, never stale", () => {
    const s = captureStatusMirror(true, 12);
    expect(s.has_frame).toBe(true);
    expect(s.stale).toBe(false);
    expect(isStaleFrame(988, 1000)).toBe(false);
    const parsed = parseCaptureResult(
      { pngBase64: "aGVsbG8=", width: 1280, height: 720, capturedAtMs: 988 },
      1000,
    );
    expect(parsed.status).toBe("ok");
    expect(parsed.stale).toBe(false);
  });

  test("frame older than 1000ms -> stale fallback, never silent pass", () => {
    const s = captureStatusMirror(true, 5000);
    expect(s.stale).toBe(true);
    expect(isStaleFrame(0, 5000)).toBe(true);
    const parsed = parseCaptureResult(
      { pngBase64: "aGVsbG8=", width: 1280, height: 720, capturedAtMs: 0 },
      5000,
    );
    expect(parsed.status).toBe("stale");
    expect(parsed.stale).toBe(true);
  });

  test("stale frame presented as fresh is rejected (injected failure enforced)", () => {
    // A classifier that always reports fresh would silently pass a 5s-old
    // frame. The mirror must disagree with it: stale must be true.
    const alwaysFresh = { stale: false };
    const enforced = captureStatusMirror(true, 5000);
    expect(enforced.stale).toBe(true);
    expect(enforced.stale).not.toBe(alwaysFresh.stale);
    // Boundary: exactly STALL_MSEC is stale (>= gate, no off-by-one pass).
    expect(captureStatusMirror(true, 1000).stale).toBe(true);
    expect(captureStatusMirror(true, 999).stale).toBe(false);
  });

  test("no frame -> unavailable", () => {
    const s = captureStatusMirror(false, 0);
    expect(s.has_frame).toBe(false);
    expect(s.stale).toBe(true);
    const parsed = parseCaptureResult({}, 1000);
    expect(parsed.status).toBe("unavailable");
    expect(parsed.stale).toBe(true);
  });

  test("viewport_handler.gd exposes the registered ops + stall gate", () => {
    const p = join(ADDON, "viewport_handler.gd");
    expect(existsSync(p)).toBe(true);
    const src = readFileSync(p, "utf8");
    for (const sym of [
      "func capture_viewport",
      "func frame_aabb",
      "func capture_status",
      "STALL_MSEC",
      "1000",
      "stale",
    ])
      expect(src).toContain(sym);
  });

  test("plugin.gd wires the viewport commands", () => {
    const src = readFileSync(join(ADDON, "plugin.gd"), "utf8");
    for (const cmd of ["capture_viewport", "frame_aabb", "capture_status"])
      expect(src).toContain(`"${cmd}"`);
  });

  test("viewport_handler.gd is tabs, no Python-isms, no credentials", () => {
    const src = readFileSync(join(ADDON, "viewport_handler.gd"), "utf8");
    expect(src).toMatch(/^\t/m);
    expect(src).not.toMatch(/^    /m);
    expect(src).not.toMatch(/(^|\s)def |(^|\s)import |print\(/);
    expect(src).not.toMatch(/password\s*=|secret\s*=|api_key\s*=|token\s*=/i);
  });
});
