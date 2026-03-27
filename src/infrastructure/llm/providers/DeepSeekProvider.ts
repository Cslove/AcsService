/**
 * DeepSeek 模型适配器
 */

import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider.js";

export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor(config: { apiKey: string; model?: string }) {
    super({
      apiKey: config.apiKey,
      baseURL: "https://api.deepseek.com/v1",
      model: config.model ?? "deepseek-chat",
    });
  }
}
