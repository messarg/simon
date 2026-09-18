import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { watchParent } from "./parent-watch.ts";

describe("watchParent", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("does nothing while the parent that started us is still our parent", () => {
    const onGone = vi.fn();
    watchParent({ expected: 4242, onGone, currentParent: () => 4242 });
    vi.advanceTimersByTime(60_000);
    expect(onGone).not.toHaveBeenCalled();
  });

  it("fires once when we are handed to a new parent — the app died without stopping us", () => {
    let parent = 4242;
    const onGone = vi.fn();
    watchParent({ expected: 4242, onGone, intervalMs: 1_000, currentParent: () => parent });
    vi.advanceTimersByTime(3_000);
    parent = 1;
    vi.advanceTimersByTime(1_000);
    vi.advanceTimersByTime(10_000);
    expect(onGone).toHaveBeenCalledTimes(1);
  });

  it("is off when nothing asked for it, as on a shop install", () => {
    const onGone = vi.fn();
    watchParent({ expected: 0, onGone, currentParent: () => 1 });
    vi.advanceTimersByTime(60_000);
    expect(onGone).not.toHaveBeenCalled();
  });
});
