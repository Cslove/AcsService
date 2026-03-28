/**
 * OpenAI 兼容的 Provider 基础实现
 * 基于 @ai-sdk/openai-compatible 实现
 * 支持错误处理和重试机制
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText } from "ai";
import {
  BaseProvider,
  type ChatCompletionOptions,
  type ChatCompletionResponse,
  type StreamChunk,
} from "./BaseProvider.js";
import { logger } from "@/shared/utils/logger.js";
import { ErrorHandler, ErrorCode } from "@/shared/utils/errorHandler.js";
import { retryAsync } from "@/shared/utils/retry.js";

export class OpenAICompatibleProvider extends BaseProvider {
  private client: ReturnType<typeof createOpenAICompatible>;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  private timeout: number = 30000;

  constructor(config: { apiKey: string; baseURL: string; model: string }) {
    super(config);
    this.client = createOpenAICompatible({
      name: "openai-compatible",
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
  }

  /**
   * 非流式对话补全（带错误处理和重试机制）
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    return retryAsync(
      async () => {
        logger.debug(`Starting chat completion with model: ${this.model}`);

        const result = await streamText({
          model: this.client(this.model),
          messages: options.messages,
          temperature: options.temperature,
          topP: options.topP,
        });

        const text = await result.text;
        const usage = await result.usage;

        logger.debug(`Chat completion successful`, {
          model: this.model,
          promptTokens: usage.inputTokens,
          completionTokens: usage.outputTokens,
        });

        return {
          content: text,
          model: this.model,
          usage: {
            promptTokens: usage.inputTokens ?? 0,
            completionTokens: usage.outputTokens ?? 0,
            totalTokens: usage.totalTokens ?? 0,
          },
        };
      },
      {
        maxAttempts: this.maxRetries,
        initialDelay: this.retryDelay,
        shouldRetry: (error) => {
          // 只对超时、网络错误和速率限制错误重试
          return (
            error.code === ErrorCode.TIMEOUT ||
            error.code === ErrorCode.LLM_RATE_LIMIT ||
            error.code === ErrorCode.LLM_API_ERROR
          );
        },
        onRetry: (error, attempt) => {
          logger.warn(`Retrying chat completion, attempt ${attempt}`, {
            model: this.model,
            error: error.message,
          });
        },
      },
    );
  }

  /**
   * 流式对话补全（带错误处理和重试机制）
   */
  async *streamChatCompletion(
    options: ChatCompletionOptions,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    try {
      logger.debug(`Starting stream chat completion with model: ${this.model}`);

      const result = await retryAsync(
        async () => {
          return streamText({
            model: this.client(this.model),
            messages: options.messages,
            temperature: options.temperature,
            maxOutputTokens: options.maxTokens,
            topP: options.topP,
          });
        },
        {
          maxAttempts: this.maxRetries,
          initialDelay: this.retryDelay,
          shouldRetry: (error) => {
            return (
              error.code === ErrorCode.TIMEOUT ||
              error.code === ErrorCode.LLM_RATE_LIMIT ||
              error.code === ErrorCode.LLM_API_ERROR
            );
          },
          onRetry: (error, attempt) => {
            logger.warn(`Retrying stream chat completion, attempt ${attempt}`, {
              model: this.model,
              error: error.message,
            });
          },
        },
      );

      for await (const chunk of result.textStream) {
        yield {
          content: chunk,
          done: false,
        };
      }

      logger.debug(`Stream chat completion successful`, { model: this.model });

      // 流结束标记
      yield {
        content: "",
        done: true,
      };
    } catch (error) {
      const appError = ErrorHandler.handle(error, `streamChatCompletion(${this.model})`);
      logger.error(`Stream chat completion failed`, {
        model: this.model,
        error: appError.message,
      });
      throw appError;
    }
  }
}
