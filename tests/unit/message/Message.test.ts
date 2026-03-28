import { describe, it, expect } from "vitest";
import {
  Message,
  MessageType,
  MessageContentType,
  type MessageConfig,
} from "@/core/message/Message.js";

describe("Message", () => {
  describe("基本功能", () => {
    it("应该正确创建用户消息", () => {
      const message = Message.createUserMessage("msg-1", "Hello", "session-1");

      expect(message.getId()).toBe("msg-1");
      expect(message.getType()).toBe(MessageType.USER);
      expect(message.getText()).toBe("Hello");
      expect(message.getSessionId()).toBe("session-1");
      expect(message.isUserMessage()).toBe(true);
    });

    it("应该正确创建助手消息", () => {
      const message = Message.createAssistantMessage("msg-2", "Hi", "session-1");

      expect(message.getId()).toBe("msg-2");
      expect(message.getType()).toBe(MessageType.ASSISTANT);
      expect(message.getText()).toBe("Hi");
      expect(message.isAssistantMessage()).toBe(true);
    });

    it("应该正确创建系统消息", () => {
      const message = Message.createSystemMessage("msg-3", "System message");

      expect(message.getId()).toBe("msg-3");
      expect(message.getType()).toBe(MessageType.SYSTEM);
      expect(message.getText()).toBe("System message");
      expect(message.isSystemMessage()).toBe(true);
    });

    it("应该正确创建工具消息", () => {
      const message = Message.createToolMessage(
        "msg-4",
        "tool-name",
        { result: "success" },
        "session-1",
      );

      expect(message.getId()).toBe("msg-4");
      expect(message.getType()).toBe(MessageType.TOOL);
      expect(message.isToolMessage()).toBe(true);
    });

    it("应该正确创建 Markdown 消息", () => {
      const message = Message.createMarkdownMessage(
        "msg-5",
        "**Bold** text",
        MessageType.ASSISTANT,
        "session-1",
      );

      expect(message.getId()).toBe("msg-5");
      expect(message.getType()).toBe(MessageType.ASSISTANT);
      expect(message.hasContentType(MessageContentType.MARKDOWN)).toBe(true);
    });

    it("应该正确创建代码消息", () => {
      const message = Message.createCodeMessage(
        "msg-6",
        "console.log('hello')",
        "javascript",
        MessageType.ASSISTANT,
        "session-1",
      );

      expect(message.getId()).toBe("msg-6");
      expect(message.getType()).toBe(MessageType.ASSISTANT);
      expect(message.hasContentType(MessageContentType.CODE)).toBe(true);
    });

    it("应该正确创建图片消息", () => {
      const message = Message.createImageMessage(
        "msg-7",
        "https://example.com/image.jpg",
        "Caption",
        MessageType.USER,
        "session-1",
      );

      expect(message.getId()).toBe("msg-7");
      expect(message.getType()).toBe(MessageType.USER);
      expect(message.hasContentType(MessageContentType.IMAGE)).toBe(true);
    });
  });

  describe("内容管理", () => {
    it("应该正确获取文本内容", () => {
      const message = Message.createUserMessage("msg-1", "Hello World");
      expect(message.getText()).toBe("Hello World");
    });

    it("应该正确获取所有文本内容", () => {
      const config: MessageConfig = {
        id: "msg-1",
        type: MessageType.USER,
        content: [
          {
            type: MessageContentType.TEXT,
            data: "First text",
          },
          {
            type: MessageContentType.TEXT,
            data: "Second text",
          },
        ],
      };

      const message = new Message(config);
      const allText = message.getAllText();

      expect(allText).toEqual(["First text", "Second text"]);
    });

    it("应该正确获取指定类型的内容", () => {
      const config: MessageConfig = {
        id: "msg-1",
        type: MessageType.USER,
        content: [
          {
            type: MessageContentType.TEXT,
            data: "Text content",
          },
          {
            type: MessageContentType.IMAGE,
            data: { url: "https://example.com/image.jpg" },
          },
        ],
      };

      const message = new Message(config);
      const textContents = message.getContentByType(MessageContentType.TEXT);
      const imageContents = message.getContentByType(MessageContentType.IMAGE);

      expect(textContents).toHaveLength(1);
      expect(textContents[0].data).toBe("Text content");
      expect(imageContents).toHaveLength(1);
      expect(imageContents[0].data.url).toBe("https://example.com/image.jpg");
    });

    it("应该正确检查内容类型", () => {
      const config: MessageConfig = {
        id: "msg-1",
        type: MessageType.USER,
        content: [
          {
            type: MessageContentType.TEXT,
            data: "Text content",
          },
        ],
      };

      const message = new Message(config);

      expect(message.hasContentType(MessageContentType.TEXT)).toBe(true);
      expect(message.hasContentType(MessageContentType.IMAGE)).toBe(false);
    });

    it("应该正确计算内容大小", () => {
      const config: MessageConfig = {
        id: "msg-1",
        type: MessageType.USER,
        content: {
          type: MessageContentType.TEXT,
          data: "Hello World",
        },
      };

      const message = new Message(config);
      const size = message.getContentSize();

      expect(size).toBe("Hello World".length);
    });
  });

  describe("消息类型检查", () => {
    it("应该正确检查用户消息", () => {
      const message = Message.createUserMessage("msg-1", "Hello");
      expect(message.isUserMessage()).toBe(true);
      expect(message.isAssistantMessage()).toBe(false);
      expect(message.isSystemMessage()).toBe(false);
      expect(message.isToolMessage()).toBe(false);
    });

    it("应该正确检查助手消息", () => {
      const message = Message.createAssistantMessage("msg-1", "Hi");
      expect(message.isUserMessage()).toBe(false);
      expect(message.isAssistantMessage()).toBe(true);
      expect(message.isSystemMessage()).toBe(false);
      expect(message.isToolMessage()).toBe(false);
    });

    it("应该正确检查文本消息", () => {
      const message = Message.createUserMessage("msg-1", "Hello");
      expect(message.isTextMessage()).toBe(true);
      expect(message.isMultimediaMessage()).toBe(false);
    });

    it("应该正确检查多媒体消息", () => {
      const message = Message.createImageMessage("msg-1", "https://example.com/image.jpg");
      expect(message.isTextMessage()).toBe(false);
      expect(message.isMultimediaMessage()).toBe(true);
    });
  });

  describe("元数据管理", () => {
    it("应该正确设置元数据", () => {
      const message = Message.createUserMessage("msg-1", "Hello");
      const metadata = { key1: "value1", key2: "value2" };

      message.setMetadata(metadata);
      expect(message.getMetadata()).toEqual(metadata);
    });

    it("应该正确更新元数据", () => {
      const message = Message.createUserMessage("msg-1", "Hello");

      message.updateMetadata("key1", "value1");
      message.updateMetadata("key2", "value2");

      expect(message.getMetadata()).toEqual({ key1: "value1", key2: "value2" });
    });
  });

  describe("会话和用户管理", () => {
    it("应该正确设置会话 ID", () => {
      const message = Message.createUserMessage("msg-1", "Hello");

      message.setSessionId("session-2");
      expect(message.getSessionId()).toBe("session-2");
    });

    it("应该正确获取时间戳", () => {
      const message = Message.createUserMessage("msg-1", "Hello");
      const timestamp = message.getTimestamp();

      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("JSON 序列化", () => {
    it("应该正确转换为 JSON", () => {
      const message = Message.createUserMessage("msg-1", "Hello", "session-1");
      const json = message.toJSON();

      expect(json.id).toBe("msg-1");
      expect(json.type).toBe(MessageType.USER);
      expect(json.content.type).toBe(MessageContentType.TEXT);
      expect(json.content.data).toBe("Hello");
      expect(json.sessionId).toBe("session-1");
      expect(json.timestamp).toBeDefined();
    });

    it("应该正确从 JSON 创建", () => {
      const message = Message.createUserMessage("msg-1", "Hello", "session-1");
      const json = message.toJSON();
      const restoredMessage = Message.fromJSON(json);

      expect(restoredMessage.getId()).toBe(message.getId());
      expect(restoredMessage.getType()).toBe(message.getType());
      expect(restoredMessage.getText()).toBe(message.getText());
      expect(restoredMessage.getSessionId()).toBe(message.getSessionId());
    });
  });

  describe("克隆功能", () => {
    it("应该正确克隆消息", () => {
      const message = Message.createUserMessage("msg-1", "Hello", "session-1");
      const clonedMessage = message.clone();

      expect(clonedMessage.getId()).toBe(message.getId());
      expect(clonedMessage.getType()).toBe(message.getType());
      expect(clonedMessage.getText()).toBe(message.getText());
      expect(clonedMessage.getSessionId()).toBe(message.getSessionId());
    });
  });
});
