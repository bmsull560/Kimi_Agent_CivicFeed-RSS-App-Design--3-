import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { logger } from "./logger.js";

describe("logger", () => {
  const logs: string[] = [];

  beforeEach(() => {
    process.env.CIVICFEED_LOG_LEVEL = "info";
    logs.length = 0;
    vi.stubGlobal("console", {
      log: (msg: string) => logs.push(msg),
      warn: (msg: string) => logs.push(msg),
      error: (msg: string) => logs.push(msg),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes structured JSON logs", () => {
    logger.info("test message", { key: "value" });
    expect(logs).toHaveLength(1);
    const entry = JSON.parse(logs[0]!);
    expect(entry.level).toBe("info");
    expect(entry.message).toBe("test message");
    expect(entry.key).toBe("value");
    expect(entry.timestamp).toBeDefined();
  });

  it("serializes errors", () => {
    logger.error("something failed", new Error("boom"));
    const entry = JSON.parse(logs[0]!);
    expect(entry.level).toBe("error");
    expect(entry.error.message).toBe("boom");
  });

  it("respects CIVICFEED_LOG_LEVEL=silent", () => {
    const original = process.env.CIVICFEED_LOG_LEVEL;
    process.env.CIVICFEED_LOG_LEVEL = "silent";
    logger.info("should not appear");
    process.env.CIVICFEED_LOG_LEVEL = original;
    expect(logs).toHaveLength(0);
  });
});
