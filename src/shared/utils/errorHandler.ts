/**
 * 错误处理工具
 * 提供统一的错误处理机制
 */

export enum ErrorCode {
  // 通用错误 (1000-1999)
  UNKNOWN_ERROR = 1000,
  INVALID_INPUT = 1001,
  UNAUTHORIZED = 1002,
  FORBIDDEN = 1003,
  NOT_FOUND = 1004,
  INTERNAL_ERROR = 1005,
  RATE_LIMIT_EXCEEDED = 1006,
  TIMEOUT = 1007,
  INVALID_TOKEN = 1008,

  // 存储错误 (2000-2999)
  STORAGE_ERROR = 2000,
  STORAGE_READ_ERROR = 2001,
  STORAGE_WRITE_ERROR = 2002,
  STORAGE_DELETE_ERROR = 2003,
  STORAGE_CONFLICT = 2004,

  // LLM 错误 (3000-3999)
  LLM_ERROR = 3000,
  LLM_API_ERROR = 3001,
  LLM_TIMEOUT = 3002,
  LLM_RATE_LIMIT = 3003,
  LLM_INVALID_RESPONSE = 3004,

  // 缓存错误 (4000-4999)
  CACHE_ERROR = 4000,
  CACHE_MISS = 4001,
  CACHE_WRITE_ERROR = 4002,

  // 任务错误 (5000-5999)
  TASK_ERROR = 5000,
  TASK_TIMEOUT = 5001,
  TASK_CANCELLED = 5002,
  TASK_FAILED = 5003,

  // Agent 错误 (6000-6999)
  AGENT_ERROR = 6000,
  AGENT_NOT_FOUND = 6001,
  AGENT_EXECUTION_ERROR = 6002,
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    statusCode: number = 500,
    details?: any,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * 存储错误
 */
export class StorageError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.STORAGE_ERROR, 500, details);
  }
}

/**
 * LLM 错误
 */
export class LLMError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.LLM_ERROR, 500, details);
  }
}

/**
 * 缓存错误
 */
export class CacheError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.CACHE_ERROR, 500, details);
  }
}

/**
 * 任务错误
 */
export class TaskError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.TASK_ERROR, 500, details);
  }
}

/**
 * Agent 错误
 */
export class AgentError extends AppError {
  constructor(message: string, details?: any) {
    super(message, ErrorCode.AGENT_ERROR, 500, details);
  }
}

/**
 * 错误处理工具类
 */
export class ErrorHandler {
  /**
   * 处理错误并返回 AppError
   */
  static handle(error: unknown, context?: string): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      // 根据错误消息判断错误类型
      if (error.message.includes("timeout") || error.message.includes("ETIMEDOUT")) {
        return new AppError(`${context}: ${error.message}`, ErrorCode.TIMEOUT, 408, {
          originalError: error.message,
        });
      }

      if (error.message.includes("ECONNREFUSED")) {
        return new AppError(`${context}: Connection refused`, ErrorCode.INTERNAL_ERROR, 503, {
          originalError: error.message,
        });
      }

      return new AppError(`${context}: ${error.message}`, ErrorCode.INTERNAL_ERROR, 500, {
        stack: error.stack,
      });
    }

    return new AppError(`${context}: Unknown error`, ErrorCode.UNKNOWN_ERROR, 500, {
      originalError: String(error),
    });
  }

  /**
   * 异步错误处理包装器
   */
  static async wrapAsync<T>(fn: () => Promise<T>, context: string): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw this.handle(error, context);
    }
  }

  /**
   * 同步错误处理包装器
   */
  static wrapSync<T>(fn: () => T, context: string): T {
    try {
      return fn();
    } catch (error) {
      throw this.handle(error, context);
    }
  }

  /**
   * 判断是否为可重试的错误
   */
  static isRetryable(error: AppError): boolean {
    const retryableCodes = [
      ErrorCode.TIMEOUT,
      ErrorCode.LLM_RATE_LIMIT,
      ErrorCode.STORAGE_ERROR,
      ErrorCode.LLM_API_ERROR,
    ];
    return retryableCodes.includes(error.code);
  }

  /**
   * 判断是否为客户端错误
   */
  static isClientError(error: AppError): boolean {
    return error.statusCode >= 400 && error.statusCode < 500;
  }

  /**
   * 判断是否为服务器错误
   */
  static isServerError(error: AppError): boolean {
    return error.statusCode >= 500;
  }
}

export default ErrorHandler;
