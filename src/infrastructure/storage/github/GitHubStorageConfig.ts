/**
 * GitHub 存储配置
 */

export interface GitHubStorageConfig {
  token: string;
  owner: string;
  repo: string;
  branch?: string;
  basePath?: string;
}

/**
 * 默认配置
 */
export const DEFAULT_GITHUB_STORAGE_CONFIG: Partial<GitHubStorageConfig> = {
  branch: "main",
  basePath: "data",
};

/**
 * 数据目录结构
 */
export const DATA_DIR_STRUCTURE = {
  USERS: "users",
  SYSTEM: "system",
  CONVERSATIONS: "conversations",
  TASKS: "tasks",
  AGENTS: "agents",
  SKILLS: "skills",
  PREFERENCES: "preferences",
} as const;

/**
 * 构建文件路径
 */
export function buildFilePath(
  config: GitHubStorageConfig,
  type: keyof typeof DATA_DIR_STRUCTURE,
  ...segments: string[]
): string {
  const basePath = config.basePath || DEFAULT_GITHUB_STORAGE_CONFIG.basePath || "data";
  const dir = DATA_DIR_STRUCTURE[type];
  return [basePath, dir, ...segments].join("/");
}

/**
 * 构建用户文件路径
 */
export function buildUserFilePath(
  config: GitHubStorageConfig,
  userId: string,
  type: keyof typeof DATA_DIR_STRUCTURE,
  ...segments: string[]
): string {
  return buildFilePath(config, "USERS", userId, DATA_DIR_STRUCTURE[type], ...segments);
}
