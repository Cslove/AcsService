/**
 * SkillRegistry 技能注册表
 * 管理所有技能的注册、查找、获取和卸载
 */

import { logger } from "@/shared/utils/logger.js";
import { AppError, ErrorCode } from "@/shared/utils/errorHandler.js";
import BaseSkill from "./BaseSkill.js";
import type { SkillType } from "./Skill.js";

/**
 * SkillRegistry 技能注册表类
 * 单例模式，全局唯一
 */
export class SkillRegistry {
  private static instance: SkillRegistry;
  private skills: Map<string, BaseSkill>;
  private skillsByType: Map<SkillType, BaseSkill[]>;
  private log: ReturnType<typeof logger.withContext>;

  private constructor() {
    this.skills = new Map();
    this.skillsByType = new Map();
    this.log = logger.withContext({ component: "SkillRegistry" });
    this.log.debug("SkillRegistry initialized");
  }

  /**
   * 获取 SkillRegistry 单例实例
   */
  static getInstance(): SkillRegistry {
    if (!SkillRegistry.instance) {
      SkillRegistry.instance = new SkillRegistry();
    }
    return SkillRegistry.instance;
  }

  /**
   * 注册技能
   */
  register(skill: BaseSkill): void {
    const skillId = skill.getId();

    if (this.skills.has(skillId)) {
      throw new AppError(`Skill already registered: ${skillId}`, ErrorCode.INVALID_INPUT, 409);
    }

    this.skills.set(skillId, skill);

    // 按类型索引
    const skillType = skill.getType() as SkillType;
    if (!this.skillsByType.has(skillType)) {
      this.skillsByType.set(skillType, []);
    }
    this.skillsByType.get(skillType)!.push(skill);

    this.log.info(`Skill registered: ${skill.getName()} (${skillId})`);
  }

  /**
   * 批量注册技能
   */
  registerBatch(skills: BaseSkill[]): void {
    for (const skill of skills) {
      this.register(skill);
    }
    this.log.info(`Batch registered ${skills.length} skills`);
  }

  /**
   * 注销技能
   */
  unregister(skillId: string): void {
    const skill = this.skills.get(skillId);

    if (!skill) {
      throw new AppError(`Skill not found: ${skillId}`, ErrorCode.NOT_FOUND, 404);
    }

    // 从类型索引中移除
    const skillType = skill.getType() as SkillType;
    const typeSkills = this.skillsByType.get(skillType);
    if (typeSkills) {
      const index = typeSkills.findIndex((s) => s.getId() === skillId);
      if (index !== -1) {
        typeSkills.splice(index, 1);
        if (typeSkills.length === 0) {
          this.skillsByType.delete(skillType);
        }
      }
    }

    // 清理技能资源
    skill.cleanup();

    this.skills.delete(skillId);
    this.log.info(`Skill unregistered: ${skillId}`);
  }

  /**
   * 获取技能
   */
  get(skillId: string): BaseSkill {
    const skill = this.skills.get(skillId);

    if (!skill) {
      throw new AppError(`Skill not found: ${skillId}`, ErrorCode.NOT_FOUND, 404);
    }

    return skill;
  }

  /**
   * 检查技能是否存在
   */
  has(skillId: string): boolean {
    return this.skills.has(skillId);
  }

  /**
   * 获取所有技能
   */
  getAll(): BaseSkill[] {
    return Array.from(this.skills.values());
  }

  /**
   * 根据类型获取技能
   */
  getByType(type: SkillType): BaseSkill[] {
    return this.skillsByType.get(type) || [];
  }

  /**
   * 根据名称搜索技能
   */
  searchByName(name: string): BaseSkill[] {
    const lowerName = name.toLowerCase();
    return this.getAll().filter((skill) => skill.getName().toLowerCase().includes(lowerName));
  }

  /**
   * 根据描述搜索技能
   */
  searchByDescription(description: string): BaseSkill[] {
    const lowerDesc = description.toLowerCase();
    return this.getAll().filter((skill) =>
      skill.getDescription().toLowerCase().includes(lowerDesc),
    );
  }

  /**
   * 获取所有技能 ID
   */
  getAllIds(): string[] {
    return Array.from(this.skills.keys());
  }

  /**
   * 获取所有技能类型
   */
  getAllTypes(): SkillType[] {
    return Array.from(this.skillsByType.keys());
  }

  /**
   * 获取技能数量
   */
  getCount(): number {
    return this.skills.size;
  }

  /**
   * 清空所有技能
   */
  clear(): void {
    for (const skill of this.skills.values()) {
      skill.cleanup();
    }
    this.skills.clear();
    this.skillsByType.clear();
    this.log.info("All skills cleared");
  }

  /**
   * 获取所有技能的 Tool Call 定义
   * 用于大模型工具调用
   */
  getAllToolCalls(): Array<{ type: string; function: any }> {
    return this.getAll().map((skill) => skill.toToolCall());
  }

  /**
   * 根据技能 ID 获取 Tool Call 定义
   */
  getToolCall(skillId: string): { type: string; function: any } | undefined {
    try {
      return this.get(skillId).toToolCall();
    } catch {
      return undefined;
    }
  }

  /**
   * 导出所有技能配置
   */
  exportAll(): any[] {
    return this.getAll().map((skill) => skill.toJSON());
  }

  /**
   * 导出指定技能配置
   */
  export(skillId: string): any {
    return this.get(skillId).toJSON();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    total: number;
    byType: Record<SkillType, number>;
    running: number;
    idle: number;
    completed: number;
    failed: number;
    cancelled: number;
  } {
    const byType: Record<SkillType, number> = {} as Record<SkillType, number>;
    for (const type of this.getAllTypes()) {
      byType[type] = this.getByType(type).length;
    }

    const stats = {
      total: this.getCount(),
      byType,
      running: 0,
      idle: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const skill of this.getAll()) {
      const state = skill.getState();
      if (state === "running") stats.running++;
      else if (state === "idle") stats.idle++;
      else if (state === "completed") stats.completed++;
      else if (state === "failed") stats.failed++;
      else if (state === "cancelled") stats.cancelled++;
    }

    return stats;
  }

  /**
   * 重置所有技能状态
   */
  resetAll(): void {
    for (const skill of this.getAll()) {
      try {
        skill.reset();
      } catch (error) {
        this.log.warn(`Failed to reset skill ${skill.getId()}`, { error });
      }
    }
    this.log.info("All skills reset");
  }

  /**
   * 获取技能健康状态
   */
  getHealthStatus(): {
    healthy: number;
    unhealthy: number;
    details: Array<{
      skillId: string;
      skillName: string;
      state: string;
      isHealthy: boolean;
    }>;
  } {
    const details = this.getAll().map((skill) => {
      const state = skill.getState();
      const isHealthy = state !== "failed" && state !== "cancelled";
      return {
        skillId: skill.getId(),
        skillName: skill.getName(),
        state,
        isHealthy,
      };
    });

    const healthy = details.filter((d) => d.isHealthy).length;
    const unhealthy = details.length - healthy;

    return { healthy, unhealthy, details };
  }
}

// 导出单例实例
export const skillRegistry = SkillRegistry.getInstance();

export default SkillRegistry;
