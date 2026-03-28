/**
 * 日志工具
 * 提供结构化的日志记录功能
 */

export enum LogLevel {
  ERROR = "error",
  WARN = "warn",
  INFO = "info",
  DEBUG = "debug",
}

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: Date;
  stack?: string;
}

class Logger {
  private level: LogLevel;
  private context: LogContext;
  private logEntries: LogEntry[] = [];
  private maxEntries: number = 1000;

  constructor(level: LogLevel = LogLevel.INFO, context: LogContext = {}) {
    this.level = level;
    this.context = context;
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 添加上下文
   */
  withContext(context: LogContext): Logger {
    return new Logger(this.level, { ...this.context, ...context });
  }

  /**
   * 记录错误日志
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, {
      ...context,
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
    });
  }

  /**
   * 记录警告日志
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * 记录信息日志
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * 记录调试日志
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * 记录日志
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    const levelOrder = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    if (levelOrder.indexOf(level) < levelOrder.indexOf(this.level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      context: { ...this.context, ...context },
      timestamp: new Date(),
    };

    this.logEntries.push(entry);

    // 保持日志条目数量在限制内
    if (this.logEntries.length > this.maxEntries) {
      this.logEntries.shift();
    }

    // 输出到控制台
    this.output(entry);
  }

  /**
   * 输出日志到控制台
   */
  private output(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : "";
    const stackStr = entry.context?.error?.stack ? `\n${entry.context.error.stack}` : "";

    const logMessage = `[${timestamp}] [${entry.level.toUpperCase()}] ${entry.message}${contextStr}${stackStr}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(logMessage);
        break;
      case LogLevel.WARN:
        console.warn(logMessage);
        break;
      case LogLevel.DEBUG:
        console.debug(logMessage);
        break;
      default:
        console.log(logMessage);
    }
  }

  /**
   * 获取所有日志条目
   */
  getEntries(): LogEntry[] {
    return [...this.logEntries];
  }

  /**
   * 清空日志条目
   */
  clear(): void {
    this.logEntries = [];
  }

  /**
   * 根据级别过滤日志
   */
  filterByLevel(level: LogLevel): LogEntry[] {
    return this.logEntries.filter((entry) => entry.level === level);
  }

  /**
   * 根据时间范围过滤日志
   */
  filterByTimeRange(start: Date, end: Date): LogEntry[] {
    return this.logEntries.filter((entry) => entry.timestamp >= start && entry.timestamp <= end);
  }
}

// 创建全局日志实例
export const logger = new Logger((process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO);

export default Logger;
