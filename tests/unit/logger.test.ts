import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Logger, LogLevel } from "@/shared/utils/logger.js";

describe("Logger", () => {
  let logger: Logger;
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    logger = new Logger(LogLevel.INFO);
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    Object.values(consoleSpy).forEach((spy) => spy.mockRestore());
  });

  describe("日志级别", () => {
    it("应该记录ERROR级别日志", () => {
      logger.error("Error message");
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it("应该记录WARN级别日志", () => {
      logger.warn("Warning message");
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it("应该记录INFO级别日志", () => {
      logger.info("Info message");
      expect(consoleSpy.log).toHaveBeenCalled();
    });

    it("应该记录DEBUG级别日志", () => {
      logger.setLevel(LogLevel.DEBUG);
      logger.debug("Debug message");
      expect(consoleSpy.debug).toHaveBeenCalled();
    });

    it("应该根据日志级别过滤日志", () => {
      logger.setLevel(LogLevel.WARN);
      logger.debug("Debug message");
      logger.info("Info message");
      logger.warn("Warning message");
      logger.error("Error message");

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.log).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe("错误处理", () => {
    it("应该正确处理Error对象", () => {
      const error = new Error("Test error");
      logger.error("Error occurred", error);

      expect(consoleSpy.error).toHaveBeenCalled();
      const callArgs = consoleSpy.error.mock.calls[0][0] as string;
      expect(callArgs).toContain("Error occurred");
      expect(callArgs).toContain("Test error");
    });

    it("应该正确处理非Error对象", () => {
      logger.error("Error occurred", { message: "Custom error" });

      expect(consoleSpy.error).toHaveBeenCalled();
      const callArgs = consoleSpy.error.mock.calls[0][0] as string;
      expect(callArgs).toContain("Error occurred");
    });
  });

  describe("上下文", () => {
    it("应该支持添加上下文", () => {
      const contextLogger = logger.withContext({ userId: "123" });
      contextLogger.info("User action");

      expect(consoleSpy.log).toHaveBeenCalled();
      const callArgs = consoleSpy.log.mock.calls[0][0] as string;
      expect(callArgs).toContain("userId");
    });

    it("应该合并上下文", () => {
      const contextLogger = logger.withContext({ userId: "123" });
      contextLogger.info("User action", { action: "login" });

      expect(consoleSpy.log).toHaveBeenCalled();
      const callArgs = consoleSpy.log.mock.calls[0][0] as string;
      expect(callArgs).toContain("userId");
      expect(callArgs).toContain("action");
    });

    it("当context为空时不打印{}", () => {
      logger.info("Message", {});

      expect(consoleSpy.log).toHaveBeenCalled();
      const callArgs = consoleSpy.log.mock.calls[0][0] as string;
      // 不应该包含空的JSON对象
      expect(callArgs).not.toMatch(/\{\}/);
    });
  });

  describe("日志条目管理", () => {
    it("应该记录所有日志条目", () => {
      logger.info("Message 1");
      logger.warn("Message 2");
      logger.error("Message 3");

      const entries = logger.getEntries();
      expect(entries).toHaveLength(3);
    });

    it("应该限制日志条目数量", () => {
      const smallLogger = new Logger(LogLevel.INFO, {}, 2);
      smallLogger.info("Message 1");
      smallLogger.info("Message 2");
      smallLogger.info("Message 3");

      const entries = smallLogger.getEntries();
      // 由于maxEntries=2，应该只保留最后2条
      expect(entries).toHaveLength(2);
      expect(entries[0].message).toBe("Message 2");
      expect(entries[1].message).toBe("Message 3");
    });

    it("应该能够清空日志条目", () => {
      logger.info("Message 1");
      logger.clear();

      const entries = logger.getEntries();
      expect(entries).toHaveLength(0);
    });
  });

  describe("日志过滤", () => {
    beforeEach(() => {
      logger.info("Info message");
      logger.warn("Warning message");
      logger.error("Error message");
      logger.info("Another info");
    });

    it("应该能够按级别过滤日志", () => {
      const infoLogs = logger.filterByLevel(LogLevel.INFO);
      expect(infoLogs).toHaveLength(2);
      expect(infoLogs.every((entry) => entry.level === LogLevel.INFO)).toBe(true);
    });

    it("应该能够按时间范围过滤日志", () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const recentLogs = logger.filterByTimeRange(oneHourAgo, now);
      expect(recentLogs.length).toBeGreaterThan(0);
    });
  });

  describe("颜色输出", () => {
    it("应该在日志中包含ANSI颜色代码", () => {
      logger.info("Colored message");

      expect(consoleSpy.log).toHaveBeenCalled();
      const callArgs = consoleSpy.log.mock.calls[0][0] as string;
      // 检查是否包含ANSI颜色代码
      expect(callArgs).toContain("\x1b[");
    });

    it("不同级别应该有不同的颜色", () => {
      logger.error("Error");
      logger.warn("Warning");
      logger.info("Info");

      const errorCall = consoleSpy.error.mock.calls[0][0] as string;
      const warnCall = consoleSpy.warn.mock.calls[0][0] as string;
      const infoCall = consoleSpy.log.mock.calls[0][0] as string;

      // ERROR应该是红色
      expect(errorCall).toContain("\x1b[31m");
      // WARN应该是黄色
      expect(warnCall).toContain("\x1b[33m");
      // INFO应该是绿色
      expect(infoCall).toContain("\x1b[32m");
    });
  });
});
