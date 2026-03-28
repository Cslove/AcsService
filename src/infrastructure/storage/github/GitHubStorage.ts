import { Octokit } from "octokit";
import type {
  GitHubStorageConfig,
  // buildFilePath,
  // buildUserFilePath,
} from "./GitHubStorageConfig.js";
import { z } from "zod";
import { logger } from "@/shared/utils/logger.js";
import { ErrorHandler, ErrorCode } from "@/shared/utils/errorHandler.js";
import { retryAsync } from "@/shared/utils/retry.js";

export class GitHubStorage {
  private octokit: Octokit;
  private config: Required<GitHubStorageConfig>;
  private writeQueue: Map<string, Promise<void>> = new Map();
  private maxRetries: number = 3;
  private retryDelay: number = 1000;

  constructor(config: GitHubStorageConfig) {
    this.config = {
      token: config.token,
      owner: config.owner,
      repo: config.repo,
      branch: config.branch || "main",
      basePath: config.basePath || "data",
    };

    this.octokit = new Octokit({
      auth: this.config.token,
    });
  }

  async readFile<T>(path: string, schema?: z.ZodSchema<T>): Promise<T | null> {
    return retryAsync(
      async () => {
        try {
          logger.debug(`Reading file: ${path}`);
          const { data } = await this.octokit.rest.repos.getContent({
            owner: this.config.owner,
            repo: this.config.repo,
            path,
            ref: this.config.branch,
          });

          if (!("content" in data)) {
            return null;
          }

          const content = Buffer.from(data.content, "base64").toString("utf-8");
          const parsed = JSON.parse(content);

          if (schema) {
            return schema.parse(parsed);
          }

          return parsed;
        } catch (error: any) {
          if (error.status === 404) {
            logger.debug(`File not found: ${path}`);
            return null;
          }
          throw ErrorHandler.handle(error, `readFile(${path})`);
        }
      },
      {
        maxAttempts: this.maxRetries,
        initialDelay: this.retryDelay,
        onRetry: (error, attempt) => {
          logger.warn(`Retrying read file ${path}, attempt ${attempt}`, {
            error: error.message,
          });
        },
      },
    );
  }

  async writeFile<T>(path: string, data: T, schema?: z.ZodSchema<T>): Promise<void> {
    // 数据校验
    if (schema) {
      try {
        schema.parse(data);
      } catch (error) {
        throw ErrorHandler.handle(error, `validateData(${path})`);
      }
    }

    // 检查是否已有正在进行的写入操作
    const existingWrite = this.writeQueue.get(path);
    if (existingWrite) {
      logger.debug(`Waiting for existing write to complete: ${path}`);
      await existingWrite;
    }

    // 创建写入Promise并加入队列
    const writePromise = retryAsync(
      async () => {
        try {
          logger.debug(`Writing file: ${path}`);
          // 序列化数据
          const content = JSON.stringify(data, null, 2);
          const contentBase64 = Buffer.from(content).toString("base64");

          // 获取文件的 SHA（如果存在）
          let sha: string | undefined;
          try {
            const { data: existingFile } = await this.octokit.rest.repos.getContent({
              owner: this.config.owner,
              repo: this.config.repo,
              path,
              ref: this.config.branch,
            });

            if ("sha" in existingFile) {
              sha = existingFile.sha;
            }
          } catch (error: any) {
            if (error.status !== 404) {
              throw error;
            }
          }

          // 创建或更新文件
          await this.octokit.rest.repos.createOrUpdateFileContents({
            owner: this.config.owner,
            repo: this.config.repo,
            path,
            message: `Update ${path}`,
            content: contentBase64,
            sha,
            branch: this.config.branch,
          });

          logger.info(`File written successfully: ${path}`);
        } catch (error) {
          throw ErrorHandler.handle(error, `writeFile(${path})`);
        } finally {
          // 完成后从队列中移除
          this.writeQueue.delete(path);
        }
      },
      {
        maxAttempts: this.maxRetries,
        initialDelay: this.retryDelay,
        shouldRetry: (error) => {
          // 只对网络错误和冲突错误重试
          return (
            error.code === ErrorCode.TIMEOUT ||
            error.code === ErrorCode.STORAGE_CONFLICT ||
            error.code === ErrorCode.STORAGE_ERROR
          );
        },
        onRetry: (error, attempt) => {
          logger.warn(`Retrying write file ${path}, attempt ${attempt}`, {
            error: error.message,
          });
        },
      },
    );

    this.writeQueue.set(path, writePromise);
    return writePromise;
  }

  async deleteFile(path: string): Promise<void> {
    return retryAsync(
      async () => {
        try {
          logger.debug(`Deleting file: ${path}`);
          // 获取文件的 SHA
          const { data: existingFile } = await this.octokit.rest.repos.getContent({
            owner: this.config.owner,
            repo: this.config.repo,
            path,
            ref: this.config.branch,
          });

          if (!("sha" in existingFile)) {
            throw new Error("File does not exist");
          }

          // 删除文件
          await this.octokit.rest.repos.deleteFile({
            owner: this.config.owner,
            repo: this.config.repo,
            path,
            message: `Delete ${path}`,
            sha: existingFile.sha,
            branch: this.config.branch,
          });

          logger.info(`File deleted successfully: ${path}`);
        } catch (error: any) {
          if (error.status === 404) {
            logger.debug(`File not found for deletion: ${path}`);
            return;
          }
          throw ErrorHandler.handle(error, `deleteFile(${path})`);
        }
      },
      {
        maxAttempts: this.maxRetries,
        initialDelay: this.retryDelay,
        onRetry: (error, attempt) => {
          logger.warn(`Retrying delete file ${path}, attempt ${attempt}`, {
            error: error.message,
          });
        },
      },
    );
  }

  async listFiles(path: string): Promise<string[]> {
    return retryAsync(
      async () => {
        try {
          logger.debug(`Listing files in: ${path}`);
          const { data } = await this.octokit.rest.repos.getContent({
            owner: this.config.owner,
            repo: this.config.repo,
            path,
            ref: this.config.branch,
          });

          if (!Array.isArray(data)) {
            return [];
          }

          return data.filter((item) => item.type === "file").map((item) => item.name);
        } catch (error: any) {
          if (error.status === 404) {
            logger.debug(`Directory not found: ${path}`);
            return [];
          }
          throw ErrorHandler.handle(error, `listFiles(${path})`);
        }
      },
      {
        maxAttempts: this.maxRetries,
        initialDelay: this.retryDelay,
        onRetry: (error, attempt) => {
          logger.warn(`Retrying list files ${path}, attempt ${attempt}`, {
            error: error.message,
          });
        },
      },
    );
  }

  async fileExists(path: string): Promise<boolean> {
    return retryAsync(
      async () => {
        try {
          await this.octokit.rest.repos.getContent({
            owner: this.config.owner,
            repo: this.config.repo,
            path,
            ref: this.config.branch,
          });
          return true;
        } catch (error: any) {
          if (error.status === 404) {
            return false;
          }
          throw ErrorHandler.handle(error, `fileExists(${path})`);
        }
      },
      {
        maxAttempts: this.maxRetries,
        initialDelay: this.retryDelay,
        onRetry: (error, attempt) => {
          logger.warn(`Retrying file exists check ${path}, attempt ${attempt}`, {
            error: error.message,
          });
        },
      },
    );
  }

  async getFileInfo(path: string): Promise<{ sha: string; size: number; modifiedAt: Date } | null> {
    return retryAsync(
      async () => {
        try {
          logger.debug(`Getting file info: ${path}`);
          const { data } = await this.octokit.rest.repos.getContent({
            owner: this.config.owner,
            repo: this.config.repo,
            path,
            ref: this.config.branch,
          });

          if (!("sha" in data) || !("size" in data)) {
            return null;
          }

          return {
            sha: data.sha,
            size: data.size,
            modifiedAt: new Date(),
          };
        } catch (error: any) {
          if (error.status === 404) {
            return null;
          }
          throw ErrorHandler.handle(error, `getFileInfo(${path})`);
        }
      },
      {
        maxAttempts: this.maxRetries,
        initialDelay: this.retryDelay,
        onRetry: (error, attempt) => {
          logger.warn(`Retrying get file info ${path}, attempt ${attempt}`, {
            error: error.message,
          });
        },
      },
    );
  }

  /**
   * 创建目录（通过创建 .gitkeep 文件）
   */
  async createDirectory(path: string): Promise<void> {
    const gitkeepPath = `${path}/.gitkeep`;
    await this.writeFile(gitkeepPath, {});
  }

  async readFiles<T>(paths: string[], schema?: z.ZodSchema<T>): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    await Promise.all(
      paths.map(async (path) => {
        const data = await this.readFile(path, schema);
        if (data !== null) {
          results.set(path, data);
        }
      }),
    );

    return results;
  }

  async writeFiles<T>(entries: Map<string, T>, schema?: z.ZodSchema<T>): Promise<void> {
    await Promise.all(
      Array.from(entries.entries()).map(([path, data]) => this.writeFile(path, data, schema)),
    );
  }

  /**
   * 获取配置
   */
  getConfig(): Required<GitHubStorageConfig> {
    return this.config;
  }
}
