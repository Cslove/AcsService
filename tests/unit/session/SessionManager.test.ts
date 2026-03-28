import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SessionManager } from "@/core/session/SessionManager.js";
import { SessionState } from "@/core/session/Session.js";
import { Message } from "@/core/message/Message.js";
import { AppError } from "@/shared/utils/errorHandler.js";

describe("SessionManager", () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager({
      maxSessions: 10,
      maxMessagesPerSession: 100,
    });
  });

  afterEach(() => {
    sessionManager.reset();
  });

  describe("基本功能", () => {
    it("应该正确创建会话", () => {
      const session = sessionManager.createSession({
        id: "session-1",
        userId: "user-1",
        title: "Test Session",
      });

      expect(session.getId()).toBe("session-1");
      expect(sessionManager.hasSession("session-1")).toBe(true);
    });

    it("应该正确获取会话", () => {
      sessionManager.createSession({
        id: "session-1",
        userId: "user-1",
      });

      const session = sessionManager.getSession("session-1");
      expect(session).toBeDefined();
      expect(session?.getId()).toBe("session-1");
    });

    it("应该正确检查会话是否存在", () => {
      sessionManager.createSession({
        id: "session-1",
        userId: "user-1",
      });

      expect(sessionManager.hasSession("session-1")).toBe(true);
      expect(sessionManager.hasSession("session-2")).toBe(false);
    });

    it("应该正确获取所有会话", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      sessionManager.createSession({ id: "session-2", userId: "user-2" });

      const sessions = sessionManager.getAllSessions();
      expect(sessions).toHaveLength(2);
    });

    it("应该拒绝创建重复 ID 的会话", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });

      expect(() => sessionManager.createSession({ id: "session-1", userId: "user-2" })).toThrow(
        AppError,
      );
    });

    it("应该拒绝超过最大会话数限制", () => {
      for (let i = 0; i < 10; i++) {
        sessionManager.createSession({ id: `session-${i}`, userId: `user-${i}` });
      }

      expect(() => sessionManager.createSession({ id: "session-10", userId: "user-10" })).toThrow(
        AppError,
      );
    });
  });

  describe("会话查询", () => {
    beforeEach(() => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      sessionManager.createSession({ id: "session-2", userId: "user-1" });
      sessionManager.createSession({ id: "session-3", userId: "user-2" });

      sessionManager.getSession("session-1")?.pause();
      sessionManager.getSession("session-2")?.close();
      sessionManager.getSession("session-3")?.archive();
    });

    it("应该正确按状态获取会话", () => {
      const activeSessions = sessionManager.getActiveSessions();
      const pausedSessions = sessionManager.getPausedSessions();
      const closedSessions = sessionManager.getClosedSessions();
      const archivedSessions = sessionManager.getArchivedSessions();

      expect(activeSessions).toHaveLength(0);
      expect(pausedSessions).toHaveLength(1);
      expect(closedSessions).toHaveLength(1);
      expect(archivedSessions).toHaveLength(1);
    });

    it("应该正确按用户 ID 获取会话", () => {
      const user1Sessions = sessionManager.getSessionsByUserId("user-1");
      const user2Sessions = sessionManager.getSessionsByUserId("user-2");

      expect(user1Sessions).toHaveLength(2);
      expect(user2Sessions).toHaveLength(1);
    });
  });

  describe("会话管理", () => {
    it("应该正确更新会话", () => {
      sessionManager.createSession({
        id: "session-1",
        userId: "user-1",
        title: "Old Title",
      });

      const updatedSession = sessionManager.updateSession("session-1", {
        title: "New Title",
      });

      expect(updatedSession.getTitle()).toBe("New Title");
    });

    it("应该正确删除会话", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      expect(sessionManager.hasSession("session-1")).toBe(true);

      const deleted = sessionManager.deleteSession("session-1");
      expect(deleted).toBe(true);
      expect(sessionManager.hasSession("session-1")).toBe(false);
    });

    it("应该正确暂停会话", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });

      const session = sessionManager.pauseSession("session-1");
      expect(session.getState()).toBe(SessionState.PAUSED);
    });

    it("应该正确恢复会话", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      sessionManager.pauseSession("session-1");

      const session = sessionManager.resumeSession("session-1");
      expect(session.getState()).toBe(SessionState.ACTIVE);
    });

    it("应该正确关闭会话", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });

      const session = sessionManager.closeSession("session-1");
      expect(session.getState()).toBe(SessionState.CLOSED);
    });

    it("应该正确归档会话", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });

      const session = sessionManager.archiveSession("session-1");
      expect(session.getState()).toBe(SessionState.ARCHIVED);
    });

    it("应该拒绝操作不存在的会话", () => {
      expect(() => sessionManager.updateSession("nonexistent", {})).toThrow(AppError);
      expect(() => sessionManager.pauseSession("nonexistent")).toThrow(AppError);
      expect(() => sessionManager.resumeSession("nonexistent")).toThrow(AppError);
      expect(() => sessionManager.closeSession("nonexistent")).toThrow(AppError);
      expect(() => sessionManager.archiveSession("nonexistent")).toThrow(AppError);
    });
  });

  describe("消息管理", () => {
    it("应该正确向会话添加消息", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      const message = Message.createUserMessage("msg-1", "Hello", "session-1");

      const session = sessionManager.addMessageToSession("session-1", message);
      expect(session.getMessageCount()).toBe(1);
    });

    it("应该正确批量向会话添加消息", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      const messages = [
        Message.createUserMessage("msg-1", "Hello", "session-1"),
        Message.createAssistantMessage("msg-2", "Hi", "session-1"),
      ];

      const session = sessionManager.addMessagesToSession("session-1", messages);
      expect(session.getMessageCount()).toBe(2);
    });

    it("应该正确清空会话消息", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      const message = Message.createUserMessage("msg-1", "Hello", "session-1");

      sessionManager.addMessageToSession("session-1", message);
      const session = sessionManager.clearSessionMessages("session-1");

      expect(session.getMessageCount()).toBe(0);
    });
  });

  describe("统计信息", () => {
    it("应该正确获取统计信息", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      sessionManager.createSession({ id: "session-2", userId: "user-1" });
      sessionManager.getSession("session-1")?.pause();
      sessionManager.getSession("session-2")?.close();

      const message = Message.createUserMessage("msg-1", "Hello", "session-1");
      sessionManager.addMessageToSession("session-1", message);

      const stats = sessionManager.getStats();

      expect(stats.totalSessions).toBe(2);
      expect(stats.activeSessions).toBe(0);
      expect(stats.pausedSessions).toBe(1);
      expect(stats.closedSessions).toBe(1);
      expect(stats.archivedSessions).toBe(0);
      expect(stats.totalMessages).toBe(1);
    });
  });

  describe("批量操作", () => {
    it("应该正确清空所有会话", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      sessionManager.createSession({ id: "session-2", userId: "user-2" });

      sessionManager.clearAllSessions();
      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });

    it("应该正确清空指定状态的会话", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      sessionManager.createSession({ id: "session-2", userId: "user-2" });
      sessionManager.getSession("session-1")?.pause();
      sessionManager.getSession("session-2")?.close();

      sessionManager.clearSessionsByState(SessionState.CLOSED);

      expect(sessionManager.hasSession("session-1")).toBe(true);
      expect(sessionManager.hasSession("session-2")).toBe(false);
    });
  });

  describe("导入导出", () => {
    it("应该正确导出会话", () => {
      sessionManager.createSession({
        id: "session-1",
        userId: "user-1",
        title: "Test Session",
      });

      const exported = sessionManager.exportSession("session-1");

      expect(exported.id).toBe("session-1");
      expect(exported.userId).toBe("user-1");
      expect(exported.title).toBe("Test Session");
    });

    it("应该正确导入会话", () => {
      const json = {
        id: "session-1",
        userId: "user-1",
        title: "Imported Session",
        state: SessionState.ACTIVE,
        messageCount: 0,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessageAt: null,
      };

      const session = sessionManager.importSession(json);

      expect(session.getId()).toBe("session-1");
      expect(sessionManager.hasSession("session-1")).toBe(true);
    });

    it("应该正确导出所有会话", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      sessionManager.createSession({ id: "session-2", userId: "user-2" });

      const exported = sessionManager.exportAllSessions();

      expect(exported).toHaveLength(2);
      expect(exported[0].id).toBe("session-1");
      expect(exported[1].id).toBe("session-2");
    });

    it("应该正确批量导入会话", () => {
      const jsonArray = [
        {
          id: "session-1",
          userId: "user-1",
          title: "Session 1",
          state: SessionState.ACTIVE,
          messageCount: 0,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastMessageAt: null,
        },
        {
          id: "session-2",
          userId: "user-2",
          title: "Session 2",
          state: SessionState.ACTIVE,
          messageCount: 0,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastMessageAt: null,
        },
      ];

      const imported = sessionManager.importSessions(jsonArray);

      expect(imported).toHaveLength(2);
      expect(sessionManager.hasSession("session-1")).toBe(true);
      expect(sessionManager.hasSession("session-2")).toBe(true);
    });

    it("应该拒绝导入重复 ID 的会话", () => {
      const json = {
        id: "session-1",
        userId: "user-1",
        title: "Session 1",
        state: SessionState.ACTIVE,
        messageCount: 0,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastMessageAt: null,
      };

      sessionManager.importSession(json);
      expect(() => sessionManager.importSession(json)).toThrow(AppError);
    });
  });

  describe("配置管理", () => {
    it("应该正确获取配置", () => {
      const config = sessionManager.getConfig();

      expect(config.maxSessions).toBe(10);
      expect(config.maxMessagesPerSession).toBe(100);
    });

    it("应该正确更新配置", () => {
      sessionManager.updateConfig({ maxSessions: 20 });

      const config = sessionManager.getConfig();
      expect(config.maxSessions).toBe(20);
    });
  });

  describe("重置功能", () => {
    it("应该正确重置管理器", () => {
      sessionManager.createSession({ id: "session-1", userId: "user-1" });
      sessionManager.createSession({ id: "session-2", userId: "user-2" });

      sessionManager.reset();
      expect(sessionManager.getAllSessions()).toHaveLength(0);
    });
  });
});
