/**
 * OpenAI 兼容的 Provider 基础实现
 * 基于 @ai-sdk/openai-compatible 实现
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import {
  BaseProvider,
  type ChatCompletionOptions,
  type ChatCompletionResponse,
  type StreamChunk,
} from "./BaseProvider.js";

export class OpenAICompatibleProvider extends BaseProvider {
  private client: ReturnType<typeof createOpenAICompatible>;

  constructor(config: { apiKey: string; baseURL: string; model: string }) {
    super(config);
    this.client = createOpenAICompatible({
      name: "openai-compatible",
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
  }

  /**
   * 非流式对话补全
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const result = await streamText({
      model: this.client(this.model),
      messages: options.messages,
      temperature: options.temperature,
      topP: options.topP,
    });

    const text = await result.text;
    const usage = await result.usage;

    return {
      content: text,
      model: this.model,
      usage: {
        promptTokens: usage.inputTokens ?? 0,
        completionTokens: usage.outputTokens ?? 0,
        totalTokens: usage.totalTokens ?? 0,
      },
    };
  }

  /**
   * 流式对话补全
   */
  async *streamChatCompletion(
    options: ChatCompletionOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const result = await streamText({
      model: this.client(this.model),
      messages: options.messages,
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
      topP: options.topP,
    });

    for await (const chunk of result.textStream) {
      yield {
        content: chunk,
        done: false,
      };
    }

    // 流结束标记
    yield {
      content: "",
      done: true,
    };
  }
}
