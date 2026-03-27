import { describe, it, expect, beforeEach } from "vitest";
import { DeepSeekProvider } from "@/infrastructure/llm/providers/DeepSeekProvider.js";
import { KimiProvider } from "@/infrastructure/llm/providers/KimiProvider.js";
import { QwenProvider } from "@/infrastructure/llm/providers/QwenProvider.js";
import { GLMProvider } from "@/infrastructure/llm/providers/GLMProvider.js";

describe("Providers", () => {
  describe("DeepSeekProvider", () => {
    let provider: DeepSeekProvider;

    beforeEach(() => {
      provider = new DeepSeekProvider({
        apiKey: "test-api-key",
      });
    });

    it("should have correct base URL", () => {
      expect(provider.getBaseURL()).toBe("https://api.deepseek.com/v1");
    });

    it("should have default model", () => {
      expect(provider.getModel()).toBe("deepseek-chat");
    });

    it("should support custom model", () => {
      const customProvider = new DeepSeekProvider({
        apiKey: "test-api-key",
        model: "deepseek-coder",
      });
      expect(customProvider.getModel()).toBe("deepseek-coder");
    });
  });

  describe("KimiProvider", () => {
    let provider: KimiProvider;

    beforeEach(() => {
      provider = new KimiProvider({
        apiKey: "test-api-key",
      });
    });

    it("should have correct base URL", () => {
      expect(provider.getBaseURL()).toBe("https://api.moonshot.cn/v1");
    });

    it("should have default model", () => {
      expect(provider.getModel()).toBe("moonshot-v1-8k");
    });

    it("should support custom model", () => {
      const customProvider = new KimiProvider({
        apiKey: "test-api-key",
        model: "moonshot-v1-32k",
      });
      expect(customProvider.getModel()).toBe("moonshot-v1-32k");
    });
  });

  describe("QwenProvider", () => {
    let provider: QwenProvider;

    beforeEach(() => {
      provider = new QwenProvider({
        apiKey: "test-api-key",
      });
    });

    it("should have correct base URL", () => {
      expect(provider.getBaseURL()).toBe("https://dashscope.aliyuncs.com/compatible-mode/v1");
    });

    it("should have default model", () => {
      expect(provider.getModel()).toBe("qwen-turbo");
    });

    it("should support custom model", () => {
      const customProvider = new QwenProvider({
        apiKey: "test-api-key",
        model: "qwen-plus",
      });
      expect(customProvider.getModel()).toBe("qwen-plus");
    });
  });

  describe("GLMProvider", () => {
    let provider: GLMProvider;

    beforeEach(() => {
      provider = new GLMProvider({
        apiKey: "test-api-key",
      });
    });

    it("should have correct base URL", () => {
      expect(provider.getBaseURL()).toBe("https://open.bigmodel.cn/api/paas/v4");
    });

    it("should have default model", () => {
      expect(provider.getModel()).toBe("glm-4");
    });

    it("should support custom model", () => {
      const customProvider = new GLMProvider({
        apiKey: "test-api-key",
        model: "glm-4-plus",
      });
      expect(customProvider.getModel()).toBe("glm-4-plus");
    });
  });
});
