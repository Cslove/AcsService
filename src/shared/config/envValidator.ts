import { logger } from "@/shared/utils/logger.js";
import { validateEnvVars } from "@/shared/utils/validator.js";

const REQUIRED_ENV_VARS = [
  "GITHUB_TOKEN",
  "GITHUB_REPO_OWNER",
  "GITHUB_REPO_NAME",
  "DEEPSEEK_API_KEY",
  "QWEN_API_KEY",
];

const OPTIONAL_ENV_VARS = [
  "KIMI_API_KEY",
  "GLM_API_KEY",
  "DEFAULT_MODEL_PROVIDER",
  "DEFAULT_MODEL_NAME",
  "PORT",
  "NODE_ENV",
  "LOG_LEVEL",
];

export function validateEnvironment(): { valid: boolean; missing: string[] } {
  logger.info("Validating environment variables...");

  const result = validateEnvVars(REQUIRED_ENV_VARS);

  if (!result.valid) {
    logger.error("Missing required environment variables:", {
      missing: result.missing,
    });
    return result;
  }

  logger.info("All required environment variables are present");

  // 验证可选环境变量（仅警告）
  const optionalResult = validateEnvVars(OPTIONAL_ENV_VARS);
  if (!optionalResult.valid) {
    logger.warn("Some optional environment variables are missing:", {
      missing: optionalResult.missing,
    });
  }

  return result;
}
export function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

export function getEnvVarNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not set`);
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} is not a valid number: ${value}`);
  }
  return num;
}

export function getEnvVarBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value.toLowerCase() === "true" || value === "1";
}

export function printEnvConfig(): void {
  logger.info("Environment configuration:", {
    NODE_ENV: process.env.NODE_ENV || "development",
    PORT: process.env.PORT || "3000",
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    GITHUB_REPO_OWNER: process.env.GITHUB_REPO_OWNER,
    GITHUB_REPO_NAME: process.env.GITHUB_REPO_NAME,
    DEFAULT_MODEL_PROVIDER: process.env.DEFAULT_MODEL_PROVIDER || "deepseek",
    DEFAULT_MODEL_NAME: process.env.DEFAULT_MODEL_NAME || "deepseek-chat",
    // API keys are masked
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? "***" : "not set",
    KIMI_API_KEY: process.env.KIMI_API_KEY ? "***" : "not set",
    QWEN_API_KEY: process.env.QWEN_API_KEY ? "***" : "not set",
    GLM_API_KEY: process.env.GLM_API_KEY ? "***" : "not set",
  });
}

export function initEnvironment(): void {
  const validation = validateEnvironment();

  if (!validation.valid) {
    throw new Error(`Missing required environment variables: ${validation.missing.join(", ")}`);
  }

  printEnvConfig();
}

export default {
  validateEnvironment,
  getEnvVar,
  getEnvVarNumber,
  getEnvVarBoolean,
  printEnvConfig,
  initEnvironment,
};
