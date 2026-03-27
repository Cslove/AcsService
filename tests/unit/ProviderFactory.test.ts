import { describe, it, expect } from "vitest";
import {
  ProviderFactory,
  type ProviderType,
} from "@/infrastructure/llm/providers/ProviderFactory.js";
import { DeepSeekProvider } from "@/infrastructure/llm/providers/DeepSeekProvider.js";
import { KimiProvider } from "@/infrastructure/llm/providers/KimiProvider.js";
import { QwenProvider } from "@/infrastructure/llm/providers/QwenProvider.js";
import { GLMProvider } from "@/infrastructure/llm/providers/GLMProvider.js";
import { BaseProvider } from "@/infrastructure/llm/providers/BaseProvider.js";

describe("ProviderFactory", () => {
  describe("create", () => {
    it("should create DeepSeekProvider", () => {
      const provider = ProviderFactory.create("deepseek", {
        apiKey: "test-api-key",
      });
      expect(provider).toBeInstanceOf(DeepSeekProvider);
      expect(provider.getModel()).toBe("deepseek-chat");
    });

    it("should create DeepSeekProvider with custom model", () => {
      const provider = ProviderFactory.create("deepseek", {
        apiKey: "test-api-key",
        model: "deepseek-coder",
      });
      expect(provider).toBeInstanceOf(DeepSeekProvider);
      expect(provider.getModel()).toBe("deepseek-coder");
    });

    it("should create KimiProvider", () => {
      const provider = ProviderFactory.create("kimi", {
        apiKey: "test-api-key",
      });
      expect(provider).toBeInstanceOf(KimiProvider);
      expect(provider.getModel()).toBe("moonshot-v1-8k");
    });

    it("should create QwenProvider", () => {
      const provider = ProviderFactory.create("qwen", {
        apiKey: "test-api-key",
      });
      expect(provider).toBeInstanceOf(QwenProvider);
      expect(provider.getModel()).toBe("qwen-turbo");
    });

    it("should create GLMProvider", () => {
      const provider = ProviderFactory.create("glm", {
        apiKey: "test-api-key",
      });
      expect(provider).toBeInstanceOf(GLMProvider);
      expect(provider.getModel()).toBe("glm-4");
    });

    it("should throw error for unsupported provider type", () => {
      expect(() => {
        ProviderFactory.create("unsupported" as ProviderType, {
          apiKey: "test-api-key",
        });
      }).toThrow("Unsupported provider type: unsupported");
    });
  });

  describe("getSupportedProviders", () => {
    it("should return all supported provider types", () => {
      const providers = ProviderFactory.getSupportedProviders();
      expect(providers).toEqual(["deepseek", "kimi", "qwen", "glm"]);
    });
  });

  describe("isSupported", () => {
    it("should return true for supported providers", () => {
      expect(ProviderFactory.isSupported("deepseek")).toBe(true);
      expect(ProviderFactory.isSupported("kimi")).toBe(true);
      expect(ProviderFactory.isSupported("qwen")).toBe(true);
      expect(ProviderFactory.isSupported("glm")).toBe(true);
    });

    it("should return false for unsupported providers", () => {
      expect(ProviderFactory.isSupported("unsupported" as ProviderType)).toBe(false);
    });
  });

  describe("registerProvider", () => {
    it("should register custom provider", () => {
      class CustomProvider extends BaseProvider {
        constructor(config: any) {
          super({
            apiKey: config.apiKey,
            baseURL: "https://api.example.com/v1",
            model: config.model ?? "custom-model",
          });
        }

        async chatCompletion() {
          return {
            content: "",
            model: this.model,
          };
        }

        async *streamChatCompletion() {
          yield { content: "", done: true };
        }
      }

      ProviderFactory.registerProvider("custom" as ProviderType, CustomProvider as any);

      const provider = ProviderFactory.create("custom" as ProviderType, {
        apiKey: "test-api-key",
        model: "custom-model",
      });

      expect(provider).toBeInstanceOf(CustomProvider);
      expect(provider.getModel()).toBe("custom-model");
    });
  });
});
