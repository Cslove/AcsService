import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Session, SessionState, type SessionConfig } from "@/core/session/Session.js";
import { Message, MessageType } from "@/core/message/Message.js";
import { AppError } from "@/shared/utils/errorHandler.js";

describe("Session", () => {
  let session: Session;

  beforeEach(() => {
    const config: SessionConfig = {
      id: "test-session-1",
      userId: "user-1",
      title: "Test Session",
      maxMessages: 10,
    };

    session = new Session(config);
  });

  afterEach(() => {
    session.cleanup();
  });

  describe("基本功能", () => {
    it("应该正确创建 Session", () => {
      expect(session.getId()).toBe("test-session-1");
      expect(session.getUserId()).toBe("user-1");
      expect(session.getTitle()).toBe("Test Session");
      expect(session.getState()).toBe(SessionState.ACTIVE);
    });

    it("应该正确设置标题", () => {
      session.setTitle("New Title");
      expect(session.getTitle()).toBe("New Title");
    });

    it("应该正确获取创建时间", () => {
      const createdAt = session.getCreatedAt();
      expect(createdAt).toBeInstanceOf(Date);
      expect(createdAt.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("应该正确获取更新时间", () => {
      const updatedAt = session.getUpdatedAt();
      expect(updatedAt).toBeInstanceOf(Date);
      expect(updatedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("状态管理", () => {
    it("应该正确设置状态", () => {
      session.setState(SessionState.PAUSED);
      expect(session.getState()).toBe(SessionState.PAUSED);
    });

    it("应该正确检查会话状态", () => {
      expect(session.isActive()).toBe(true);
      expect(session.isClosed()).toBe(false);
      expect(session.isArchived()).toBe(false);

      session.setState(SessionState.CLOSED);
      expect(session.isActive()).toBe(false);
      expect(session.isClosed()).toBe(true);

      session.setState(SessionState.ARCHIVED);
      expect(session.isArchived()).toBe(true);
    });

    it("应该正确暂停会话", () => {
      session.pause();
      expect(session.getState()).toBe(SessionState.PAUSED);
    });

    it("应该正确恢复会话", () => {
      session.pause();
      session.resume();
      expect(session.getState()).toBe(SessionState.ACTIVE);
    });

    it("应该正确关闭会话", () => {
      session.close();
      expect(session.getState()).toBe(SessionState.CLOSED);
    });

    it("应该正确归档会话", () => {
      session.archive();
      expect(session.getState()).toBe(SessionState.ARCHIVED);
    });

    it("应该拒绝暂停非活跃会话", () => {
      session.close();
      expect(() => session.pause()).toThrow(AppError);
    });

    it("应该拒绝恢复非暂停会话", () => {
      expect(() => session.resume()).toThrow(AppError);
    });

    it("应该拒绝关闭已关闭的会话", () => {
      session.close();
      expect(() => session.close()).toThrow(AppError);
    });

    it("应该拒绝归档已归档的会话", () => {
      session.archive();
      expect(() => session.archive()).toThrow(AppError);
    });
  });

  describe("消息管理", () => {
    it("应该正确添加消息", () => {
      const message = Message.createUserMessage("msg-1", "Hello", session.getId());
      session.addMessage(message);

      expect(session.getMessageCount()).toBe(1);
      expect(session.getLastMessage()).toBe(message);
    });

    it("应该正确获取所有消息", () => {
      const msg1 = Message.createUserMessage("msg-1", "Hello", session.getId());
      const msg2 = Message.createAssistantMessage("msg-2", "Hi", session.getId());

      session.addMessage(msg1);
      session.addMessage(msg2);

      const messages = session.getMessages();
      expect(messages).toHaveLength(2);
      expect(messages[0]).toBe(msg1);
      expect(messages[1]).toBe(msg2);
    });

    it("应该正确获取指定类型的消息", () => {
      const msg1 = Message.createUserMessage("msg-1", "Hello", session.getId());
      const msg2 = Message.createAssistantMessage("msg-2", "Hi", session.getId());

      session.addMessage(msg1);
      session.addMessage(msg2);

      const userMessages = session.getMessagesByType(MessageType.USER);
      const assistantMessages = session.getMessagesByType(MessageType.ASSISTANT);

      expect(userMessages).toHaveLength(1);
      expect(userMessages[0]).toBe(msg1);
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0]).toBe(msg2);
    });

    it("应该正确获取最后一条消息", () => {
      const msg1 = Message.createUserMessage("msg-1", "Hello", session.getId());
      const msg2 = Message.createAssistantMessage("msg-2", "Hi", session.getId());

      session.addMessage(msg1);
      expect(session.getLastMessage()).toBe(msg1);

      session.addMessage(msg2);
      expect(session.getLastMessage()).toBe(msg2);
    });

    it("应该正确获取消息数量", () => {
      expect(session.getMessageCount()).toBe(0);

      session.addMessage(Message.createUserMessage("msg-1", "Hello", session.getId()));
      expect(session.getMessageCount()).toBe(1);

      session.addMessage(Message.createAssistantMessage("msg-2", "Hi", session.getId()));
      expect(session.getMessageCount()).toBe(2);
    });

    it("应该正确清空消息列表", () => {
      session.addMessage(Message.createUserMessage("msg-1", "Hello", session.getId()));
      session.addMessage(Message.createAssistantMessage("msg-2", "Hi", session.getId()));

      session.clearMessages();
      expect(session.getMessageCount()).toBe(0);
      expect(session.getMessages()).toHaveLength(0);
    });

    it("应该正确获取最后消息时间", () => {
      expect(session.getLastMessageAt()).toBeNull();

      const message = Message.createUserMessage("msg-1", "Hello", session.getId());
      session.addMessage(message);

      const lastMessageAt = session.getLastMessageAt();
      expect(lastMessageAt).toBeInstanceOf(Date);
      expect(lastMessageAt!.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it("应该拒绝向已关闭的会话添加消息", () => {
      session.close();
      const message = Message.createUserMessage("msg-1", "Hello", session.getId());

      expect(() => session.addMessage(message)).toThrow(AppError);
    });

    it("应该正确限制最大消息数", () => {
      for (let i = 0; i < 15; i++) {
        const message = Message.createUserMessage(`msg-${i}`, `Message ${i}`, session.getId());
        session.addMessage(message);
      }

      expect(session.getMessageCount()).toBe(10);
    });
  });

  describe("元数据管理", () => {
    it("应该正确设置元数据", () => {
      const metadata = { key1: "value1", key2: "value2" };
      session.setMetadata(metadata);

      expect(session.getMetadata()).toEqual(metadata);
    });

    it("应该正确更新元数据", () => {
      session.updateMetadata("key1", "value1");
      session.updateMetadata("key2", "value2");

      expect(session.getMetadata()).toEqual({ key1: "value1", key2: "value2" });
    });

    it("应该正确覆盖元数据", () => {
      session.updateMetadata("key1", "value1");
      session.updateMetadata("key1", "new-value1");

      expect(session.getMetadata()).toEqual({ key1: "new-value1" });
    });
  });

  describe("JSON 序列化", () => {
    it("应该正确转换为 JSON", () => {
      const message = Message.createUserMessage("msg-1", "Hello", session.getId());
      session.addMessage(message);

      const json = session.toJSON();

      expect(json.id).toBe("test-session-1");
      expect(json.userId).toBe("user-1");
      expect(json.title).toBe("Test Session");
      expect(json.state).toBe(SessionState.ACTIVE);
      expect(json.messageCount).toBe(1);
      expect(json.messages).toHaveLength(1);
      expect(json.createdAt).toBeDefined();
      expect(json.updatedAt).toBeDefined();
    });

    it("应该正确从 JSON 创建", () => {
      const message = Message.createUserMessage("msg-1", "Hello", session.getId());
      session.addMessage(message);

      const json = session.toJSON();
      const restoredSession = Session.fromJSON(json);

      expect(restoredSession.getId()).toBe(session.getId());
      expect(restoredSession.getUserId()).toBe(session.getUserId());
      expect(restoredSession.getTitle()).toBe(session.getTitle());
      expect(restoredSession.getState()).toBe(session.getState());
      expect(restoredSession.getMessageCount()).toBe(session.getMessageCount());
      expect(restoredSession.getMessages()).toHaveLength(session.getMessages().length);
    });
  });

  describe("清理功能", () => {
    it("应该正确清理资源", () => {
      const message = Message.createUserMessage("msg-1", "Hello", session.getId());
      session.addMessage(message);

      session.cleanup();

      expect(session.getMessageCount()).toBe(0);
      expect(session.getMessages()).toHaveLength(0);
    });
  });
});
