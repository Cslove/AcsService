/**
 * Agent 工厂类
 * 负责动态创建和管理 Agent 实例
 */

import { BaseAgent, type AgentConfig } from "./BaseAgent.js";
import { MainAgent, type MainAgentConfig } from "./MainAgent.js";
import { SubAgent, type SubAgentConfig } from "./SubAgent.js";
import { logger } from "../../shared/utils/logger.js";
import { AppError, ErrorCode } from "../../shared/utils/errorHandler.js";

/**
 * Agent 类型枚举
 */
export enum AgentType {
  MAIN = "main",
  SUB = "sub",
}

/**
 * Agent 创建配置
 */
export interface AgentCreateConfig {
  type: AgentType;
  config: AgentConfig | MainAgentConfig | SubAgentConfig;
}

/**
 * Agent 工厂类
 */
export class AgentFactory {
  private static agents: Map<string, BaseAgent> = new Map();

  /**
   * 创建 Agent
   */
  static createAgent(config: AgentCreateConfig): BaseAgent {
    const { type, config: agentConfig } = config;

    let agent: BaseAgent;

    switch (type) {
      case AgentType.MAIN:
        agent = new MainAgent(agentConfig as MainAgentConfig);
        break;

      case AgentType.SUB:
        agent = new SubAgent(agentConfig as SubAgentConfig);
        break;

      default:
        throw new AppError(`Unknown agent type: ${type}`, ErrorCode.INVALID_INPUT, 400);
    }

    // 检查是否已存在同名 Agent
    if (this.agents.has(agent.getName())) {
      throw new AppError(
        `Agent with name "${agent.getName()}" already exists`,
        ErrorCode.INVALID_INPUT,
        400,
      );
    }

    this.agents.set(agent.getName(), agent);
    logger.info(`Agent created: ${agent.getName()} (type: ${type})`);

    return agent;
  }

  /**
   * 创建 MainAgent
   */
  static createMainAgent(config: MainAgentConfig): MainAgent {
    const agent = this.createAgent({
      type: AgentType.MAIN,
      config,
    }) as MainAgent;

    return agent;
  }

  /**
   * 创建 SubAgent
   */
  static createSubAgent(config: SubAgentConfig): SubAgent {
    const agent = this.createAgent({
      type: AgentType.SUB,
      config,
    }) as SubAgent;

    return agent;
  }

  /**
   * 获取 Agent
   */
  static getAgent(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * 获取所有 Agent
   */
  static getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * 检查 Agent 是否存在
   */
  static hasAgent(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * 移除 Agent
   */
  static async removeAgent(name: string): Promise<boolean> {
    const agent = this.agents.get(name);
    if (!agent) {
      return false;
    }

    try {
      await agent.cleanup();
      this.agents.delete(name);
      logger.info(`Agent removed: ${name}`);
      return true;
    } catch (error) {
      logger.error(`Failed to remove agent: ${name}`, error);
      return false;
    }
  }

  /**
   * 清空所有 Agent
   */
  static async clearAll(): Promise<void> {
    const agentNames = Array.from(this.agents.keys());

    for (const name of agentNames) {
      await this.removeAgent(name);
    }

    logger.info("All agents cleared");
  }

  /**
   * 批量创建 Agent
   */
  static createAgents(configs: AgentCreateConfig[]): BaseAgent[] {
    const agents: BaseAgent[] = [];

    for (const config of configs) {
      try {
        const agent = this.createAgent(config);
        agents.push(agent);
      } catch (error) {
        logger.error(`Failed to create agent`, error);
      }
    }

    return agents;
  }

  /**
   * 获取 Agent 统计信息
   */
  static getStats(): {
    total: number;
    mainAgents: number;
    subAgents: number;
    byName: Record<string, string>;
  } {
    const agents = Array.from(this.agents.values());
    const mainAgents = agents.filter((a) => a instanceof MainAgent).length;
    const subAgents = agents.filter((a) => a instanceof SubAgent).length;

    const byName: Record<string, string> = {};
    for (const agent of agents) {
      byName[agent.getName()] = agent instanceof MainAgent ? AgentType.MAIN : AgentType.SUB;
    }

    return {
      total: agents.length,
      mainAgents,
      subAgents,
      byName,
    };
  }

  /**
   * 重置工厂状态（用于测试）
   */
  static reset(): void {
    this.agents.clear();
    logger.debug("AgentFactory reset");
  }
}

export default AgentFactory;
