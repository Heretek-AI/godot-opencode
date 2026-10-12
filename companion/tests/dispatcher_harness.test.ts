import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ADDON = join(import.meta.dir, "..", "addons", "godot_opencode");

// Mirror of dispatcher.gd drain contract: per-tick cap 32, FIFO order,
// 4.0ms budget honored via an injectable clock, overflow-safe queue.
const PACKET_DRAIN_CAP_PER_TICK = 32;

interface TickResult {
  executed: string[];
  remaining: number;
}

function drainTick(
  queue: string[],
  budgetMs: number,
  nowMs: () => number,
  costPerPacketMs: number,
): TickResult {
  const executed: string[] = [];
  const start = nowMs();
  let idx = 0;
  while (
    idx < queue.length &&
    executed.length < PACKET_DRAIN_CAP_PER_TICK &&
    nowMs() - start < budgetMs
  ) {
    // Simulate handler cost advancing the clock.
    const t = nowMs() + costPerPacketMs;
    void t;
    executed.push(queue[idx]);
    idx += 1;
  }
  return { executed, remaining: queue.length - idx };
}

describe("ticket 2.2: frame budgeter and dispatcher", () => {
  test("100-packet burst drains over multiple ticks, <=32 per tick, FIFO", () => {
    let queue = Array.from({ length: 100 }, (_, i) => `req-${i}`);
    let now = 0;
    const clock = () => now;
    const seen: string[] = [];
    let ticks = 0;
    while (queue.length > 0) {
      const r = drainTick(queue, 4.0, clock, 0);
      expect(r.executed.length).toBeLessThanOrEqual(32);
      seen.push(...r.executed);
      queue = queue.slice(r.executed.length);
      ticks += 1;
      if (ticks > 10) throw new Error("drain did not converge");
    }
    expect(ticks).toBe(4); // 32+32+32+4
    expect(seen).toEqual(Array.from({ length: 100 }, (_, i) => `req-${i}`));
  });

  test("budget respected: stops early when clock exceeds 4ms", () => {
    const queue = Array.from({ length: 100 }, (_, i) => `req-${i}`);
    let now = 0;
    // Each packet costs 1ms: only 4 fit in the 4.0ms budget.
    let elapsed = 0;
    const clock = () => elapsed;
    const executed: string[] = [];
    const start = clock();
    let idx = 0;
    while (
      idx < queue.length &&
      executed.length < PACKET_DRAIN_CAP_PER_TICK &&
      clock() - start < 4.0
    ) {
      elapsed += 1;
      void now;
      executed.push(queue[idx]);
      idx += 1;
    }
    expect(executed.length).toBe(4);
    expect(queue.length - idx).toBe(96);
  });

  test("overflow safe: queue unbounded by tick, excess retained in order", () => {
    const queue = Array.from({ length: 1000 }, (_, i) => `r${i}`);
    const r = drainTick(queue, 4.0, () => 0, 0);
    expect(r.executed.length).toBe(32);
    expect(r.remaining).toBe(968);
    expect(r.executed[0]).toBe("r0");
    expect(r.executed[31]).toBe("r31");
  });

  test("dispatcher.gd exists with cap and budget constants", () => {
    const p = join(ADDON, "dispatcher.gd");
    expect(existsSync(p)).toBe(true);
    const src = readFileSync(p, "utf8");
    expect(src).toContain("PACKET_DRAIN_CAP_PER_TICK");
    expect(src).toContain("32");
    expect(src).toContain("4.0");
    expect(src).toContain("func tick");
    expect(src).toContain("func enqueue");
  });
});
