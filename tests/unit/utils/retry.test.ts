import { describe, it, expect, vi } from "vitest";
import {
  retryAsync,
  retrySync,
  sleep,
  withRetry,
  type RetryOptions,
} from "@/shared/utils/retry.js";

describe("retry", () => {
  describe("retryAsync", () => {
    it("应该在第一次成功时返回结果", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await retryAsync(fn, { maxAttempts: 3 });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("应该在失败时重试", async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValue("success");

      const result = await retryAsync(fn, { maxAttempts: 3 });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("应该在达到最大重试次数后抛出错误", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(retryAsync(fn, { maxAttempts: 3 })).rejects.toThrow("fail");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("应该使用指数退避", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("success");

      const startTime = Date.now();
      await retryAsync(fn, { maxAttempts: 3, baseDelay: 100 });
      const endTime = Date.now();

      // 应该有延迟（第一次重试100ms，第二次200ms）
      expect(endTime - startTime).toBeGreaterThanOrEqual(300);
    });

    it("应该支持自定义退避策略", async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValue("success");

      const customDelay = vi.fn().mockReturnValue(50);
      await retryAsync(fn, { maxAttempts: 3, delay: customDelay });

      expect(customDelay).toHaveBeenCalled();
    });

    it("应该支持重试条件", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("retryable"))
        .mockRejectedValueOnce(new Error("non-retryable"))
        .mockResolvedValue("success");

      const shouldRetry = (error: Error) => error.message === "retryable";

      await expect(retryAsync(fn, { maxAttempts: 3, shouldRetry })).rejects.toThrow(
        "non-retryable",
      );
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("应该调用onRetry回调", async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error("fail")).mockResolvedValue("success");

      const onRetry = vi.fn();
      await retryAsync(fn, { maxAttempts: 3, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    });

    it("应该支持自定义错误包装", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      const wrapError = (error: Error, attempt: number) => {
        return new Error(`Attempt ${attempt} failed: ${error.message}`);
      };

      await expect(retryAsync(fn, { maxAttempts: 2, wrapError })).rejects.toThrow(
        "Attempt 2 failed: fail",
      );
    });
  });

  describe("retrySync", () => {
    it("应该在第一次成功时返回结果", () => {
      const fn = vi.fn().mockReturnValue("success");
      const result = retrySync(fn, { maxAttempts: 3 });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("应该在失败时重试", () => {
      const fn = vi.fn().mockReturnValueOnce(null).mockReturnValue("success");

      const result = retrySync(fn, {
        maxAttempts: 3,
        shouldRetry: (result) => result === null,
      });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("应该在达到最大重试次数后返回失败结果", () => {
      const fn = vi.fn().mockReturnValue(null);

      const result = retrySync(fn, {
        maxAttempts: 3,
        shouldRetry: (result) => result === null,
      });

      expect(result).toBe(null);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("应该支持同步重试条件", () => {
      const fn = vi.fn().mockReturnValueOnce("retry").mockReturnValueOnce("success");

      const shouldRetry = (result: string) => result === "retry";

      const result = retrySync(fn, { maxAttempts: 3, shouldRetry });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("应该调用onRetry回调", () => {
      const fn = vi.fn().mockReturnValueOnce("retry").mockReturnValue("success");

      const onRetry = vi.fn();
      retrySync(fn, {
        maxAttempts: 3,
        shouldRetry: (result) => result === "retry",
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith("retry", 1);
    });
  });

  describe("sleep", () => {
    it("应该等待指定的时间", async () => {
      const startTime = Date.now();
      await sleep(100);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it("应该支持不同的时间单位", async () => {
      const startTime = Date.now();
      await sleep(0.1, "seconds");
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe("withRetry", () => {
    it("应该装饰异步函数并添加重试功能", async () => {
      let attempts = 0;
      const fn = withRetry(async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error("fail");
        }
        return "success";
      });

      const result = await fn();

      expect(result).toBe("success");
      expect(attempts).toBe(2);
    });

    it("应该支持自定义重试选项", async () => {
      const fn = withRetry(
        async () => {
          throw new Error("fail");
        },
        { maxAttempts: 2 },
      );

      await expect(fn()).rejects.toThrow("fail");
    });

    it("应该保持函数的上下文", async () => {
      const context = { value: "test" };
      const fn = withRetry(function (this: typeof context) {
        return Promise.resolve(this.value);
      });

      const result = await fn.call(context);

      expect(result).toBe("test");
    });
  });

  describe("RetryOptions", () => {
    it("应该支持默认选项", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const options: RetryOptions = {};

      await retryAsync(fn, options);

      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("应该支持maxAttempts选项", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"));

      await expect(retryAsync(fn, { maxAttempts: 5 })).rejects.toThrow("fail");
      expect(fn).toHaveBeenCalledTimes(5);
    }, 35000);

    it("应该支持baseDelay和maxDelay选项", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail"))
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValue("success");

      const startTime = Date.now();
      await retryAsync(fn, { maxAttempts: 3, baseDelay: 100, maxDelay: 200 });
      const endTime = Date.now();

      // 第一次重试100ms，第二次应该被maxDelay限制为200ms
      expect(endTime - startTime).toBeGreaterThanOrEqual(300);
    });
  });
});
