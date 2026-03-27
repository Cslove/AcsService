/**
 * Provider 工厂类
 * 使用工厂模式创建不同的 Provider 实例
 */

import { BaseProvider } from "./BaseProvider.js";
import { DeepSeekProvider } from "./DeepSeekProvider.js";
import { KimiProvider } from "./KimiProvider.js";
import { QwenProvider } from "./QwenProvider.js";
import { GLMProvider } from "./GLMProvider.js";

export type ProviderType = "deepseek" | "kimi" | "qwen" | "glm";

export interface ProviderConfig {
  apiKey: string;
  model?: string;
}

export class ProviderFactory {
  private static providers: Map<ProviderType, new (config: ProviderConfig) => BaseProvider> =
    new Map([
      ["deepseek", DeepSeekProvider as unknown as new (config: ProviderConfig) => BaseProvider],
      ["kimi", KimiProvider as unknown as new (config: ProviderConfig) => BaseProvider],
      ["qwen", QwenProvider as unknown as new (config: ProviderConfig) => BaseProvider],
      ["glm", GLMProvider as unknown as new (config: ProviderConfig) => BaseProvider],
    ]);

  /**
   * 创建 Provider 实例
   */
  static create(type: ProviderType, config: ProviderConfig): BaseProvider {
    const ProviderClass = this.providers.get(type);

    if (!ProviderClass) {
      throw new Error(`Unsupported provider type: ${type}`);
    }

    return new ProviderClass(config);
  }

  /**
   * 获取支持的 Provider 类型列表
   */
  static getSupportedProviders(): ProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * 检查是否支持指定的 Provider 类型
   */
  static isSupported(type: ProviderType): boolean {
    return this.providers.has(type);
  }

  /**
   * 注册自定义 Provider
   */
  static registerProvider(
    type: ProviderType,
    providerClass: new (config: ProviderConfig) => BaseProvider,
  ): void {
    this.providers.set(type, providerClass);
  }
}
