/**
 * ConversationService 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConversationService } from "@/application/services/ConversationService.js";
import { SessionState } from "@/core/session/Session.js";
import { MessageType } from "@/core/message/Message.js";

describe("ConversationService", () => {
  let service: ConversationService;

  beforeEach(() => {
    service = new ConversationService();
  });

  afterEach(async () => {
    await service.cleanup();
  });

  describe("createConversation", () => {
    it("应该创建新对话", async () => {
      const session = await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
        title: "Test Conversation",
      });

      expect(session.getId()).toBe("session-1");
      expect(session.getUserId()).toBe("user-1");
      expect(session.getTitle()).toBe("Test Conversation");
      expect(session.getState()).toBe(SessionState.ACTIVE);
    });

    it("应该使用默认标题", async () => {
      const session = await service.createConversation({
        sessionId: "session-2",
        userId: "user-2",
      });

      expect(session.getTitle()).toBe("Session session-2");
    });
  });

  describe("getConversation", () => {
    it("应该获取存在的对话", async () => {
      await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
      });

      const session = service.getConversation("session-1");

      expect(session).toBeDefined();
      expect(session?.getId()).toBe("session-1");
    });

    it("应该返回 undefined 对于不存在的对话", () => {
      const session = service.getConversation("non-existent");
      expect(session).toBeUndefined();
    });
  });

  describe("sendMessage", () => {
    it("应该发送消息并获取回复", async () => {
      await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
      });

      const response = await service.sendMessage("session-1", "Hello, how are you?", "user-1");

      expect(response.sessionId).toBe("session-1");
      expect(response.content).toBeDefined();
      expect(response.messageId).toBeDefined();
    });

    it("应该对不存在的会话抛出错误", async () => {
      await expect(service.sendMessage("non-existent", "Hello", "user-1")).rejects.toThrow();
    });
  });

  describe("getConversationHistory", () => {
    it("应该获取对话历史", async () => {
      await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
      });

      await service.sendMessage("session-1", "Hello", "user-1");

      const history = service.getConversationHistory("session-1");

      expect(history.length).toBe(2); // 用户消息 + 助手消息
      expect(history[0].getType()).toBe(MessageType.USER);
      expect(history[1].getType()).toBe(MessageType.ASSISTANT);
    });
  });

  describe("getConversationSummary", () => {
    it("应该获取对话摘要", async () => {
      await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
        title: "Test",
      });

      const summary = service.getConversationSummary("session-1");

      expect(summary.id).toBe("session-1");
      expect(summary.userId).toBe("user-1");
      expect(summary.title).toBe("Test");
      expect(summary.state).toBe(SessionState.ACTIVE);
    });
  });

  describe("pauseConversation", () => {
    it("应该暂停对话", async () => {
      await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
      });

      const session = service.pauseConversation("session-1");

      expect(session.getState()).toBe(SessionState.PAUSED);
    });
  });

  describe("resumeConversation", () => {
    it("应该恢复对话", async () => {
      await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
      });

      service.pauseConversation("session-1");
      const session = service.resumeConversation("session-1");

      expect(session.getState()).toBe(SessionState.ACTIVE);
    });
  });

  describe("closeConversation", () => {
    it("应该关闭对话", async () => {
      await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
      });

      const session = service.closeConversation("session-1");

      expect(session.getState()).toBe(SessionState.CLOSED);
    });
  });

  describe("deleteConversation", () => {
    it("应该删除对话", async () => {
      await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
      });

      const deleted = service.deleteConversation("session-1");

      expect(deleted).toBe(true);
      expect(service.getConversation("session-1")).toBeUndefined();
    });
  });

  describe("getUserConversations", () => {
    it("应该获取用户的所有对话", async () => {
      await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
      });
      await service.createConversation({
        sessionId: "session-2",
        userId: "user-1",
      });
      await service.createConversation({
        sessionId: "session-3",
        userId: "user-2",
      });

      const user1Conversations = service.getUserConversations("user-1");

      expect(user1Conversations.length).toBe(2);
    });
  });

  describe("getActiveConversations", () => {
    it("应该获取活跃对话", async () => {
      await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
      });
      await service.createConversation({
        sessionId: "session-2",
        userId: "user-2",
      });

      const activeConversations = service.getActiveConversations();

      expect(activeConversations.length).toBe(2);
    });
  });

  describe("getStats", () => {
    it("应该获取统计信息", async () => {
      await service.createConversation({
        sessionId: "session-1",
        userId: "user-1",
      });

      await service.sendMessage("session-1", "Hello", "user-1");

      const stats = service.getStats();

      expect(stats.totalConversations).toBe(1);
      expect(stats.activeConversations).toBe(1);
      expect(stats.totalMessages).toBe(2);
    });
  });
});
