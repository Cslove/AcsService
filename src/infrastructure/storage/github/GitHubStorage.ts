import { Octokit } from "octokit";
import type {
  GitHubStorageConfig,
  // buildFilePath,
  // buildUserFilePath,
} from "./GitHubStorageConfig.js";
import { z } from "zod";

/**
 * GitHub 存储适配器
 * 基于 GitHub API 实现数据存储
 */
export class GitHubStorage {
  private octokit: Octokit;
  private config: Required<GitHubStorageConfig>;

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

  /**
   * 读取文件
   */
  async readFile<T>(path: string, schema?: z.ZodSchema<T>): Promise<T | null> {
    try {
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
        return null;
      }
      throw new Error(`Failed to read file ${path}: ${error.message}`);
    }
  }

  /**
   * 写入文件
   */
  async writeFile<T>(path: string, data: T, schema?: z.ZodSchema<T>): Promise<void> {
    // 数据校验
    if (schema) {
      schema.parse(data);
    }

    // 序列化数据
    const content = JSON.stringify(data, null, 2);
    const contentBase64 = Buffer.from(content).toString("base64");

    try {
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
    } catch (error: any) {
      throw new Error(`Failed to write file ${path}: ${error.message}`);
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(path: string): Promise<void> {
    try {
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
    } catch (error: any) {
      if (error.status === 404) {
        return;
      }
      throw new Error(`Failed to delete file ${path}: ${error.message}`);
    }
  }

  /**
   * 列出目录中的文件
   */
  async listFiles(path: string): Promise<string[]> {
    try {
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
        return [];
      }
      throw new Error(`Failed to list files in ${path}: ${error.message}`);
    }
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(path: string): Promise<boolean> {
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
      throw error;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(path: string): Promise<{ sha: string; size: number; modifiedAt: Date } | null> {
    try {
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
      throw new Error(`Failed to get file info ${path}: ${error.message}`);
    }
  }

  /**
   * 创建目录（通过创建 .gitkeep 文件）
   */
  async createDirectory(path: string): Promise<void> {
    const gitkeepPath = `${path}/.gitkeep`;
    await this.writeFile(gitkeepPath, {});
  }

  /**
   * 批量读取文件
   */
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

  /**
   * 批量写入文件
   */
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
