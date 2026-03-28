/**
 * 重试机制工具
 * 提供指数退避重试策略
 */

import { logger } from "./logger.js";
import { AppError, ErrorHandler, ErrorCode } from "./errorHandler.js";

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  shouldRetry?: (error: AppError) => boolean;
  onRetry?: (attempt: number, error: AppError) => void;
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  shouldRetry: ErrorHandler.isRetryable,
  onRetry: (attempt, error) => {
    logger.warn(`Retry attempt ${attempt}`, { error: error.message });
  },
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
  let lastError: AppError | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const appError = ErrorHandler.handle(error, "retryAsync");
      lastError = appError;

      // 检查是否应该重试
      if (!opts.shouldRetry(appError) || attempt === opts.maxAttempts) {
        throw appError;
      }

      // 计算延迟时间
      const delay = calculateBackoff(attempt, opts.initialDelay, opts.maxDelay, opts.backoffFactor);

      // 执行重试回调
      if (opts.onRetry) {
        opts.onRetry(attempt, appError);
      }

      // 等待
      await sleep(delay);
    }
  }

  throw lastError || new AppError("Retry failed", ErrorCode.UNKNOWN_ERROR);
}

/**
 * 同步重试函数
 */
export function retrySync<T>(fn: () => T, options: RetryOptions = {}): T {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: AppError | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return fn();
    } catch (error) {
      const appError = ErrorHandler.handle(error, "retrySync");
      lastError = appError;

      // 检查是否应该重试
      if (!opts.shouldRetry(appError) || attempt === opts.maxAttempts) {
        throw appError;
      }

      // 计算延迟时间
      const delay = calculateBackoff(attempt, opts.initialDelay, opts.maxDelay, opts.backoffFactor);

      // 执行重试回调
      if (opts.onRetry) {
        opts.onRetry(attempt, appError);
      }

      // 同步等待（使用阻塞式sleep）
      sleepSync(delay);
    }
  }

  throw lastError || new AppError("Retry failed", ErrorCode.UNKNOWN_ERROR);
}

/**
 * 异步睡眠函数
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    return retryAsync(() => fn(...args), options);
  }) as T;
}

export default {
  retryAsync,
  retrySync,
  sleep,
  withRetry,
};
