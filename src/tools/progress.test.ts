import { describe, test, expect, mock } from "bun:test";
import { makeProgressEmitter } from "./progress.js";

describe("makeProgressEmitter", () => {
  test("returns null when no progressToken", () => {
    const sendNotification = mock(async () => {});
    const emitter = makeProgressEmitter(undefined, sendNotification);
    expect(emitter).toBeNull();
  });

  test("returns function when progressToken provided", () => {
    const sendNotification = mock(async () => {});
    const emitter = makeProgressEmitter("tok-1", sendNotification);
    expect(typeof emitter).toBe("function");
  });

  test("calls sendNotification with progress notification", async () => {
    const notifications: unknown[] = [];
    const sendNotification = mock(async (n: unknown) => { notifications.push(n); });
    const emitter = makeProgressEmitter("tok-abc", sendNotification);
    expect(emitter).not.toBeNull();
    await emitter!("hello chunk");
    expect(notifications.length).toBe(1);
    const n = notifications[0] as { method: string; params: { progressToken: string; message: string } };
    expect(n.method).toBe("notifications/progress");
    expect(n.params.progressToken).toBe("tok-abc");
    expect(n.params.message).toBe("hello chunk");
  });

  test("increments progress counter across calls", async () => {
    const notifications: unknown[] = [];
    const sendNotification = mock(async (n: unknown) => { notifications.push(n); });
    const emitter = makeProgressEmitter(42, sendNotification);
    await emitter!("a");
    await emitter!("b");
    const first = (notifications[0] as { params: { progress: number } }).params.progress;
    const second = (notifications[1] as { params: { progress: number } }).params.progress;
    expect(second).toBeGreaterThan(first);
  });

  test("swallows sendNotification errors silently", async () => {
    const sendNotification = mock(async () => { throw new Error("network error"); });
    const emitter = makeProgressEmitter("tok", sendNotification);
    await expect(emitter!("chunk")).resolves.toBeUndefined();
  });
});
