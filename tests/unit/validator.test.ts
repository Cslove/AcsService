import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";
import {
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
} from "@/shared/utils/validator.js";

describe("validator", () => {
  describe("isValidEmail", () => {
    it("应该验证有效的邮箱地址", () => {
      expect(isValidEmail("test@example.com")).toBe(true);
      expect(isValidEmail("user.name+tag@domain.co.uk")).toBe(true);
    });

    it("应该拒绝无效的邮箱地址", () => {
      expect(isValidEmail("invalid")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("test@")).toBe(false);
      expect(isValidEmail("test@.com")).toBe(false);
    });
  });

  describe("isValidUrl", () => {
    it("应该验证有效的URL", () => {
      expect(isValidUrl("https://example.com")).toBe(true);
      expect(isValidUrl("http://localhost:3000")).toBe(true);
      expect(isValidUrl("ftp://example.com/file")).toBe(true);
    });

    it("应该拒绝无效的URL", () => {
      expect(isValidUrl("not-a-url")).toBe(false);
      expect(isValidUrl("example.com")).toBe(false);
      expect(isValidUrl("")).toBe(false);
    });
  });

  describe("isValidUuid", () => {
    it("应该验证有效的UUID", () => {
      expect(isValidUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
      expect(isValidUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
    });

    it("应该拒绝无效的UUID", () => {
      expect(isValidUuid("not-a-uuid")).toBe(false);
      expect(isValidUuid("550e8400-e29b-41d4-a716")).toBe(false);
      expect(isValidUuid("")).toBe(false);
    });
  });

  describe("isValidLength", () => {
    it("应该验证字符串长度在范围内", () => {
      expect(isValidLength("hello", 1, 10)).toBe(true);
      expect(isValidLength("hello", 5, 5)).toBe(true);
    });

    it("应该拒绝超出范围的字符串", () => {
      expect(isValidLength("hello", 10, 20)).toBe(false);
      expect(isValidLength("hello", 1, 3)).toBe(false);
    });
  });

  describe("isValidRange", () => {
    it("应该验证数字在范围内", () => {
      expect(isValidRange(5, 1, 10)).toBe(true);
      expect(isValidRange(1, 1, 10)).toBe(true);
      expect(isValidRange(10, 1, 10)).toBe(true);
    });

    it("应该拒绝超出范围的数字", () => {
      expect(isValidRange(0, 1, 10)).toBe(false);
      expect(isValidRange(11, 1, 10)).toBe(false);
    });
  });

  describe("isInteger", () => {
    it("应该验证整数", () => {
      expect(isInteger(1)).toBe(true);
      expect(isInteger(0)).toBe(true);
      expect(isInteger(-1)).toBe(true);
    });

    it("应该拒绝非整数", () => {
      expect(isInteger(1.5)).toBe(false);
      expect(isInteger(NaN)).toBe(false);
      expect(isInteger(Infinity)).toBe(false);
    });
  });

  describe("isPositive", () => {
    it("应该验证正数", () => {
      expect(isPositive(1)).toBe(true);
      expect(isPositive(0.5)).toBe(true);
    });

    it("应该拒绝非正数", () => {
      expect(isPositive(0)).toBe(false);
      expect(isPositive(-1)).toBe(false);
    });
  });

  describe("isNonEmptyString", () => {
    it("应该验证非空字符串", () => {
      expect(isNonEmptyString("hello")).toBe(true);
      expect(isNonEmptyString("  hello  ")).toBe(true);
    });

    it("应该拒绝空字符串", () => {
      expect(isNonEmptyString("")).toBe(false);
      expect(isNonEmptyString("   ")).toBe(false);
      expect(isNonEmptyString(null)).toBe(false);
      expect(isNonEmptyString(undefined)).toBe(false);
      expect(isNonEmptyString(123)).toBe(false);
    });
  });

  describe("isNonEmptyArray", () => {
    it("应该验证非空数组", () => {
      expect(isNonEmptyArray([1, 2, 3])).toBe(true);
      expect(isNonEmptyArray([1])).toBe(true);
    });

    it("应该拒绝空数组", () => {
      expect(isNonEmptyArray([])).toBe(false);
      expect(isNonEmptyArray(null)).toBe(false);
      expect(isNonEmptyArray(undefined)).toBe(false);
      expect(isNonEmptyArray("not an array")).toBe(false);
    });
  });

  describe("isObject", () => {
    it("应该验证对象", () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ key: "value" })).toBe(true);
    });

    it("应该拒绝非对象", () => {
      expect(isObject(null)).toBe(false);
      expect(isObject([])).toBe(false);
      expect(isObject("string")).toBe(false);
      expect(isObject(123)).toBe(false);
    });
  });

  describe("isValidDate", () => {
    it("应该验证有效的日期对象", () => {
      expect(isValidDate(new Date())).toBe(true);
      expect(isValidDate(new Date("2024-01-01"))).toBe(true);
    });

    it("应该拒绝无效的日期", () => {
      expect(isValidDate(new Date("invalid"))).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate("2024-01-01")).toBe(false);
    });
  });

  describe("validateEnvVars", () => {
    beforeEach(() => {
      // 保存原始环境变量
      const originalEnv = { ...process.env };
      vi.restoreAllMocks();
      process.env = { ...originalEnv };
    });

    it("应该验证所有必需的环境变量都存在", () => {
      process.env.VAR1 = "value1";
      process.env.VAR2 = "value2";

      const result = validateEnvVars(["VAR1", "VAR2"]);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("应该检测缺失的环境变量", () => {
      process.env.VAR1 = "value1";
      delete process.env.VAR2;
      delete process.env.VAR3;

      const result = validateEnvVars(["VAR1", "VAR2", "VAR3"]);

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["VAR2", "VAR3"]);
    });

    it("应该拒绝空字符串环境变量", () => {
      process.env.VAR1 = "";

      const result = validateEnvVars(["VAR1"]);

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(["VAR1"]);
    });
  });

  describe("validateSchema", () => {
    it("应该验证符合schema的数据", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = validateSchema({ name: "John", age: 30 }, schema);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ name: "John", age: 30 });
      }
    });

    it("应该拒绝不符合schema的数据", () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const result = validateSchema({ name: "John" }, schema);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors).toBeInstanceOf(z.ZodError);
      }
    });
  });

  describe("createValidator", () => {
    it("应该创建验证器函数", () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      const validator = createValidator(schema);

      const result = validator({ email: "test@example.com", age: 25 });

      expect(result).toEqual({ email: "test@example.com", age: 25 });
    });

    it("应该抛出验证错误", () => {
      const schema = z.object({
        email: z.string().email(),
        age: z.number().min(18),
      });

      const validator = createValidator(schema);

      expect(() => validator({ email: "invalid", age: 15 })).toThrow("Validation failed");
    });
  });

  describe("validatePaginationParams", () => {
    it("应该验证分页参数", () => {
      const result = validatePaginationParams({ page: 2, pageSize: 20 });

      expect(result).toEqual({ page: 2, pageSize: 20 });
    });

    it("应该使用默认值", () => {
      const result = validatePaginationParams({});

      expect(result).toEqual({ page: 1, pageSize: 10 });
    });

    it("应该限制page最小值为1", () => {
      const result = validatePaginationParams({ page: 0, pageSize: 10 });

      expect(result.page).toBe(1);
    });

    it("应该限制pageSize在1-100之间", () => {
      const result1 = validatePaginationParams({ pageSize: 0 });
      expect(result1.pageSize).toBe(1);

      const result2 = validatePaginationParams({ pageSize: 150 });
      expect(result2.pageSize).toBe(100);
    });
  });

  describe("validateSortParams", () => {
    it("应该验证排序参数", () => {
      const result = validateSortParams("name", ["name", "age", "email"]);

      expect(result).toEqual({ sortBy: "name", sortOrder: "asc" });
    });

    it("应该拒绝无效的排序字段", () => {
      expect(() => validateSortParams("invalid", ["name", "age"])).toThrow("Invalid sort field");
    });
  });

  describe("validateSearchParams", () => {
    it("应该验证搜索参数", () => {
      const result = validateSearchParams({
        query: "  test  ",
        filters: { category: "books" },
      });

      expect(result).toEqual({
        query: "test",
        filters: { category: "books" },
      });
    });

    it("应该使用默认值", () => {
      const result = validateSearchParams({});

      expect(result).toEqual({
        query: "",
        filters: {},
      });
    });
  });

  describe("sanitizeString", () => {
    it("应该清理字符串", () => {
      expect(sanitizeString("  hello   world  ")).toBe("hello world");
      expect(sanitizeString("  test  ")).toBe("test");
    });
  });

  describe("sanitizeObject", () => {
    it("应该清理对象", () => {
      const input = {
        name: "John",
        age: 30,
        email: "john@example.com",
        password: "secret",
      };

      const result = sanitizeObject(input, ["name", "email"]);

      expect(result).toEqual({
        name: "John",
        email: "john@example.com",
      });
    });

    it("应该保留undefined的键", () => {
      const input = {
        name: "John",
        age: undefined,
      };

      const result = sanitizeObject(input, ["name", "age"]);

      expect(result).toEqual({
        name: "John",
      });
    });
  });

  describe("validateFileExtension", () => {
    it("应该验证允许的文件扩展名", () => {
      expect(validateFileExtension("test.jpg", [".jpg", ".png"])).toBe(true);
      expect(validateFileExtension("document.pdf", [".pdf", ".doc"])).toBe(true);
    });

    it("应该拒绝不允许的文件扩展名", () => {
      expect(validateFileExtension("test.jpg", [".png", ".gif"])).toBe(false);
      expect(validateFileExtension("test", [".jpg"])).toBe(false);
    });

    it("应该不区分大小写", () => {
      expect(validateFileExtension("test.JPG", [".jpg", ".png"])).toBe(true);
    });
  });

  describe("validateFileSize", () => {
    it("应该验证文件大小在限制内", () => {
      expect(validateFileSize(1024, 2048)).toBe(true);
      expect(validateFileSize(2048, 2048)).toBe(true);
    });

    it("应该拒绝超过限制的文件大小", () => {
      expect(validateFileSize(4096, 2048)).toBe(false);
    });
  });
});
