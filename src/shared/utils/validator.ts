/**
 * 数据验证工具
 * 提供常用的数据验证函数
 */

import { z } from "zod";

/**
 * 验证电子邮件地址
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 验证 URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 验证 UUID
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * 验证字符串长度
 */
export function isValidLength(str: string, min: number, max: number): boolean {
  return str.length >= min && str.length <= max;
}

/**
 * 验证数字范围
 */
export function isValidRange(num: number, min: number, max: number): boolean {
  return num >= min && num <= max;
}

/**
 * 验证是否为整数
 */
export function isInteger(num: number): boolean {
  return Number.isInteger(num);
}

/**
 * 验证是否为正数
 */
export function isPositive(num: number): boolean {
  return num > 0;
}

/**
 * 验证是否为非空字符串
 */
export function isNonEmptyString(str: any): boolean {
  return typeof str === "string" && str.trim().length > 0;
}

/**
 * 验证是否为非空数组
 */
export function isNonEmptyArray(arr: any): boolean {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * 验证是否为对象
 */
export function isObject(obj: any): boolean {
  return typeof obj === "object" && obj !== null && !Array.isArray(obj);
}

/**
 * 验证是否为日期对象
 */
export function isValidDate(date: any): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * 验证环境变量
 */
export function validateEnvVars(requiredVars: string[]): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value || value.trim() === "") {
      missing.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * 验证 Zod Schema
 */
export function validateSchema<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * 创建验证器函数
 */
export function createValidator<T>(schema: z.ZodSchema<T>) {
  return (data: unknown): T => {
    const result = validateSchema(data, schema);
    if (!result.success) {
      throw new Error(
        `Validation failed: ${result.errors.issues.map((e) => e.message).join(", ")}`,
      );
    }
    return result.data;
  };
}

/**
 * 验证分页参数
 */
export function validatePaginationParams(params: { page?: number; pageSize?: number }): {
  page: number;
  pageSize: number;
} {
  const page = Math.max(1, params.page || 1);
  const pageSize = params.pageSize !== undefined ? Math.max(1, Math.min(100, params.pageSize)) : 10;
  return { page, pageSize };
}

/**
 * 验证排序参数
 */
export function validateSortParams(
  sortBy: string,
  allowedFields: string[],
): { sortBy: string; sortOrder: "asc" | "desc" } {
  if (!allowedFields.includes(sortBy)) {
    throw new Error(`Invalid sort field: ${sortBy}`);
  }

  return {
    sortBy,
    sortOrder: "asc" as const,
  };
}

/**
 * 验证搜索参数
 */
export function validateSearchParams(params: { query?: string; filters?: Record<string, any> }): {
  query: string;
  filters: Record<string, any>;
} {
  const query = (params.query || "").trim();
  const filters = params.filters || {};

  return { query, filters };
}

/**
 * 验证并清理输入字符串
 */
export function sanitizeString(str: string): string {
  return str.trim().replace(/\s+/g, " ");
}

/**
 * 验证并清理输入对象
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  allowedKeys: (keyof T)[],
): Partial<T> {
  const sanitized: Partial<T> = {};

  for (const key of allowedKeys) {
    if (obj[key] !== undefined) {
      sanitized[key] = obj[key];
    }
  }

  return sanitized;
}

/**
 * 验证文件扩展名
 */
export function validateFileExtension(filename: string, allowedExtensions: string[]): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  const extWithDot = ext ? `.${ext}` : "";
  return allowedExtensions.some((allowed) => allowed.toLowerCase() === extWithDot);
}

/**
 * 验证文件大小
 */
export function validateFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}

export default {
  isValidEmail,
  isValidUrl,
  isValidUuid,
  isValidLength,
  isValidRange,
  isInteger,
  isPositive,
  isNonEmptyString,
  isNonEmptyArray,
  isObject,
  isValidDate,
  validateEnvVars,
  validateSchema,
  createValidator,
  validatePaginationParams,
  validateSortParams,
  validateSearchParams,
  sanitizeString,
  sanitizeObject,
  validateFileExtension,
  validateFileSize,
};
