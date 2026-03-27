/**
 * 大模型 Provider 基础接口
 * 定义所有模型适配器必须实现的统一接口
 */

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

/**
 * Provider 基础接口
 * 所有模型适配器必须实现此接口
 */
export abstract class BaseProvider {
  protected apiKey: string;
  protected baseURL: string;
  protected model: string;

  constructor(config: { apiKey: string; baseURL: string; model: string }) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL;
    this.model = config.model;
  }

  /**
   * 非流式对话补全
   */
  abstract chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse>;

  /**
   * 流式对话补全
   */
  abstract streamChatCompletion(
    options: ChatCompletionOptions,
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /**
   * 获取模型名称
   */
  getModel(): string {
    return this.model;
  }

  /**
   * 获取基础 URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }
}
