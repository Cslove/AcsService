/**
 * Qwen 模型适配器
 */

import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider.js";

export class QwenProvider extends OpenAICompatibleProvider {
  constructor(config: { apiKey: string; model?: string }) {
    super({
      apiKey: config.apiKey,
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: config.model ?? "qwen-turbo",
    });
  }
}
