import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  validateEnvironment,
  getEnvVar,
  getEnvVarNumber,
  getEnvVarBoolean,
  printEnvConfig,
  initEnvironment,
} from "@/shared/config/envValidator.js";

describe("envValidator", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // 重置环境变量
    process.env = { ...originalEnv };
    // 设置必需的环境变量
    process.env.GITHUB_TOKEN = "test_github_token";
    process.env.GITHUB_REPO_OWNER = "test_owner";
    process.env.GITHUB_REPO_NAME = "test_repo";
    process.env.DEEPSEEK_API_KEY = "test_deepseek_key";
    process.env.QWEN_API_KEY = "test_qwen_key";
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 恢复环境变量
    process.env = { ...originalEnv };
  });

  describe("validateEnvironment", () => {
    it("应该验证所有必需的环境变量都存在", () => {
      const result = validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("应该检测缺失的必需环境变量", () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.DEEPSEEK_API_KEY;

      const result = validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain("GITHUB_TOKEN");
      expect(result.missing).toContain("DEEPSEEK_API_KEY");
    });

    it("应该接受缺少可选环境变量的情况", () => {
      delete process.env.KIMI_API_KEY;
      delete process.env.GLM_API_KEY;

      const result = validateEnvironment();

      expect(result.valid).toBe(true);
    });
  });

  describe("getEnvVar", () => {
    it("应该返回存在的环境变量", () => {
      process.env.TEST_VAR = "test_value";

      const result = getEnvVar("TEST_VAR");

      expect(result).toBe("test_value");
    });

    it("应该使用默认值当环境变量不存在时", () => {
      const result = getEnvVar("NON_EXISTENT_VAR", "default_value");

      expect(result).toBe("default_value");
    });

    it("应该在环境变量不存在且没有默认值时抛出错误", () => {
      expect(() => getEnvVar("NON_EXISTENT_VAR")).toThrow(
        "Environment variable NON_EXISTENT_VAR is not set",
      );
    });
  });

  describe("getEnvVarNumber", () => {
    it("应该返回数字类型的环境变量", () => {
      process.env.PORT = "3000";

      const result = getEnvVarNumber("PORT");

      expect(result).toBe(3000);
      expect(typeof result).toBe("number");
    });

    it("应该使用默认值当环境变量不存在时", () => {
      const result = getEnvVarNumber("NON_EXISTENT_VAR", 8080);

      expect(result).toBe(8080);
    });

    it("应该在环境变量不是有效数字时抛出错误", () => {
      process.env.INVALID_NUMBER = "not_a_number";

      expect(() => getEnvVarNumber("INVALID_NUMBER")).toThrow(
        "Environment variable INVALID_NUMBER is not a valid number",
      );
    });

    it("应该在环境变量不存在且没有默认值时抛出错误", () => {
      expect(() => getEnvVarNumber("NON_EXISTENT_VAR")).toThrow(
        "Environment variable NON_EXISTENT_VAR is not set",
      );
    });
  });

  describe("getEnvVarBoolean", () => {
    it("应该返回true当环境变量为'true'时", () => {
      process.env.ENABLED = "true";

      const result = getEnvVarBoolean("ENABLED");

      expect(result).toBe(true);
    });

    it("应该返回true当环境变量为'1'时", () => {
      process.env.ENABLED = "1";

      const result = getEnvVarBoolean("ENABLED");

      expect(result).toBe(true);
    });

    it("应该返回false当环境变量为其他值时", () => {
      process.env.ENABLED = "false";

      const result = getEnvVarBoolean("ENABLED");

      expect(result).toBe(false);
    });

    it("应该使用默认值当环境变量不存在时", () => {
      const result = getEnvVarBoolean("NON_EXISTENT_VAR", true);

      expect(result).toBe(true);
    });

    it("应该在环境变量不存在且没有默认值时抛出错误", () => {
      expect(() => getEnvVarBoolean("NON_EXISTENT_VAR")).toThrow(
        "Environment variable NON_EXISTENT_VAR is not set",
      );
    });
  });

  describe("printEnvConfig", () => {
    it("应该打印环境配置", () => {
      // 设置一些环境变量
      process.env.NODE_ENV = "production";
      process.env.PORT = "8080";
      process.env.LOG_LEVEL = "debug";

      // 不应该抛出错误
      expect(() => printEnvConfig()).not.toThrow();
    });

    it("应该使用默认值当环境变量未设置时", () => {
      delete process.env.NODE_ENV;
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;

      // 不应该抛出错误
      expect(() => printEnvConfig()).not.toThrow();
    });
  });

  describe("initEnvironment", () => {
    it("应该在所有必需环境变量存在时初始化成功", () => {
      // 不应该抛出错误
      expect(() => initEnvironment()).not.toThrow();
    });

    it("应该在缺少必需环境变量时抛出错误", () => {
      delete process.env.GITHUB_TOKEN;

      expect(() => initEnvironment()).toThrow(
        "Missing required environment variables: GITHUB_TOKEN",
      );
    });

    it("应该在缺少多个必需环境变量时列出所有缺失的变量", () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.DEEPSEEK_API_KEY;
      delete process.env.QWEN_API_KEY;

      expect(() => initEnvironment()).toThrow(
        "Missing required environment variables: GITHUB_TOKEN, DEEPSEEK_API_KEY, QWEN_API_KEY",
      );
    });
  });

  describe("必需环境变量列表", () => {
    it("应该包含所有必需的环境变量", () => {
      // 验证必需的环境变量
      const requiredVars = [
        "GITHUB_TOKEN",
        "GITHUB_REPO_OWNER",
        "GITHUB_REPO_NAME",
        "DEEPSEEK_API_KEY",
        "QWEN_API_KEY",
      ];

      // 设置所有必需的环境变量
      requiredVars.forEach((varName) => {
        process.env[varName] = `test_${varName.toLowerCase()}`;
      });

      const result = validateEnvironment();

      expect(result.valid).toBe(true);
    });
  });

  describe("可选环境变量列表", () => {
    it("应该包含所有可选的环境变量", () => {
      // 验证可选的环境变量
      const optionalVars = [
        "KIMI_API_KEY",
        "GLM_API_KEY",
        "DEFAULT_MODEL_PROVIDER",
        "DEFAULT_MODEL_NAME",
        "PORT",
        "NODE_ENV",
        "LOG_LEVEL",
      ];

      // 不设置可选的环境变量
      optionalVars.forEach((varName) => {
        delete process.env[varName];
      });

      const result = validateEnvironment();

      // 应该仍然有效，因为这些都是可选的
      expect(result.valid).toBe(true);
    });
  });
});
