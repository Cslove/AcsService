/**
 * 重试机制工具
 * 提供指数退避重试策略
 */

import { logger } from "./logger.js";
import { AppError, ErrorHandler, ErrorCode } from "./errorHandler.js";

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: Error | AppError | any) => boolean;
  onRetry?: (error: Error | AppError | any, attempt: number) => void;
  delay?: (attempt: number) => number;
  wrapError?: (error: Error, attempt: number) => Error;
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  shouldRetry: () => true,
  onRetry: (error: any, attempt: number) => {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.warn(`Retry attempt ${attempt}`, { error: errorMsg });
  },
  delay: (attempt) => 1000 * Math.pow(2, attempt - 1),
  wrapError: (error, attempt) => error,
};

/**
 * 计算退避延迟时间
 */
function calculateBackoff(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffFactor: number,
): number {
  const delay = initialDelay * Math.pow(backoffFactor, attempt - 1);
  return Math.min(delay, maxDelay);
}

/**
 * 异步重试函数
 */
export async function retryAsync<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      // 检查是否应该重试
      if (!opts.shouldRetry || !opts.shouldRetry(err) || attempt === opts.maxAttempts) {
        // 如果有自定义错误包装器，使用它
        if (opts.wrapError) {
          throw opts.wrapError(err, attempt);
        }
        throw err;
      }

      // 计算延迟时间
      const delay = opts.delay
        ? opts.delay(attempt)
        : calculateBackoff(
            attempt,
            opts.baseDelay || opts.initialDelay,
            opts.maxDelay,
            opts.backoffFactor,
          );

      // 执行重试回调
      if (opts.onRetry) {
        opts.onRetry(err, attempt);
      }

      // 等待
      await sleep(delay);
    }
  }

  // 如果所有尝试都失败，使用wrapError包装最后的错误
  if (lastError && opts.wrapError) {
    throw opts.wrapError(lastError, opts.maxAttempts);
  }
  throw lastError || new Error("Retry failed");
}

/**
 * 同步重试函数
 */
export function retrySync<T>(fn: () => T, options: RetryOptions = {}): T {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | undefined;
  let lastResult: T | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = fn();
      lastResult = result;

      // 如果有自定义的shouldRetry函数，检查结果是否需要重试
      if (options.shouldRetry && opts.shouldRetry(result as any)) {
        if (attempt === opts.maxAttempts) {
          return result;
        }

        // 计算延迟时间
        const delay = opts.delay
          ? opts.delay(attempt)
          : calculateBackoff(
              attempt,
              opts.baseDelay || opts.initialDelay,
              opts.maxDelay,
              opts.backoffFactor,
            );

        // 执行重试回调
        if (opts.onRetry) {
          opts.onRetry(result as any, attempt);
        }

        // 同步等待
        sleepSync(delay);
        continue;
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      lastError = err;

      // 检查是否应该重试
      if (!opts.shouldRetry || !opts.shouldRetry(err) || attempt === opts.maxAttempts) {
        throw err;
      }

      // 计算延迟时间
      const delay = opts.delay
        ? opts.delay(attempt)
        : calculateBackoff(
            attempt,
            opts.baseDelay || opts.initialDelay,
            opts.maxDelay,
            opts.backoffFactor,
          );

      // 执行重试回调
      if (opts.onRetry) {
        opts.onRetry(err, attempt);
      }

      // 同步等待（使用阻塞式sleep）
      sleepSync(delay);
    }
  }

  return lastResult as T;
}

/**
 * 异步睡眠函数
 */
export function sleep(
  ms: number,
  unit: "milliseconds" | "seconds" = "milliseconds",
): Promise<void> {
  const duration = unit === "seconds" ? ms * 1000 : ms;
  return new Promise((resolve) => setTimeout(resolve, duration));
}

/**
 * 同步睡眠函数（仅用于测试）
 */
function sleepSync(ms: number): void {
  const start = Date.now();
  while (Date.now() - start < ms) {
    // 阻塞等待
  }
}

/**
 * 创建带重试的函数包装器
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {},
): T {
  return async function (this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
    return retryAsync(() => fn.apply(this, args), options);
  } as T;
}

export default {
  retryAsync,
  retrySync,
  sleep,
  withRetry,
};
