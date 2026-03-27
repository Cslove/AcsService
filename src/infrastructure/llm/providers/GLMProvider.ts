/**
 * GLM 模型适配器
 */

import { OpenAICompatibleProvider } from "./OpenAICompatibleProvider.js";

export class GLMProvider extends OpenAICompatibleProvider {
  constructor(config: { apiKey: string; model?: string }) {
    super({
      apiKey: config.apiKey,
      baseURL: "https://open.bigmodel.cn/api/paas/v4",
      model: config.model ?? "glm-4",
    });
  }
}
