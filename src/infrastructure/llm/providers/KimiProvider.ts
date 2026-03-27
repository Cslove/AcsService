/**
 * Kimi 模型适配器
 */

import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider.js";

export class KimiProvider extends OpenAICompatibleProvider {
  constructor(config: { apiKey: string; model?: string }) {
    super({
      apiKey: config.apiKey,
      baseURL: "https://api.moonshot.cn/v1",
      model: config.model ?? "moonshot-v1-8k",
    });
  }
}
