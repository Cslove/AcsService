import { describe, it, expect } from "vitest";
import { MessageBuilder } from "@/core/message/MessageBuilder.js";
import { Message, MessageType, MessageContentType } from "@/core/message/Message.js";
import { AppError } from "@/shared/utils/errorHandler.js";

describe("MessageBuilder", () => {
  describe("基本功能", () => {
    it("应该正确构建文本消息", () => {
      const message = new MessageBuilder({
        type: MessageType.USER,
        sessionId: "session-1",
      })
        .addText("Hello World")
        .build();

      expect(message.getType()).toBe(MessageType.USER);
      expect(message.getText()).toBe("Hello World");
      expect(message.getSessionId()).toBe("session-1");
    });

    it("应该正确构建 Markdown 消息", () => {
      const message = new MessageBuilder({
        type: MessageType.ASSISTANT,
      })
        .addMarkdown("**Bold** text")
        .build();

      expect(message.getType()).toBe(MessageType.ASSISTANT);
      expect(message.hasContentType(MessageContentType.MARKDOWN)).toBe(true);
    });

    it("应该正确构建代码消息", () => {
      const message = new MessageBuilder({
        type: MessageType.ASSISTANT,
      })
        .addCode("console.log('hello')", "javascript")
        .build();

      expect(message.getType()).toBe(MessageType.ASSISTANT);
      expect(message.hasContentType(MessageContentType.CODE)).toBe(true);
    });

    it("应该正确构建 JSON 消息", () => {
      const data = { key: "value" };
      const message = new MessageBuilder({
        type: MessageType.TOOL,
      })
        .addJson(data)
        .build();

      expect(message.getType()).toBe(MessageType.TOOL);
      expect(message.hasContentType(MessageContentType.JSON)).toBe(true);
    });

    it("应该正确构建图片消息", () => {
      const message = new MessageBuilder({
        type: MessageType.USER,
      })
        .addImage("https://example.com/image.jpg", "Caption")
        .build();

      expect(message.getType()).toBe(MessageType.USER);
      expect(message.hasContentType(MessageContentType.IMAGE)).toBe(true);
    });

    it("应该正确构建音频消息", () => {
      const message = new MessageBuilder({
        type: MessageType.USER,
      })
        .addAudio("https://example.com/audio.mp3", 120)
        .build();

      expect(message.getType()).toBe(MessageType.USER);
      expect(message.hasContentType(MessageContentType.AUDIO)).toBe(true);
    });

    it("应该正确构建视频消息", () => {
      const message = new MessageBuilder({
        type: MessageType.USER,
      })
        .addVideo("https://example.com/video.mp4", 300)
        .build();

      expect(message.getType()).toBe(MessageType.USER);
      expect(message.hasContentType(MessageContentType.VIDEO)).toBe(true);
    });

    it("应该正确构建文件消息", () => {
      const message = new MessageBuilder({
        type: MessageType.USER,
      })
        .addFile("https://example.com/file.pdf", "file.pdf", 1024)
        .build();

      expect(message.getType()).toBe(MessageType.USER);
      expect(message.hasContentType(MessageContentType.FILE)).toBe(true);
    });

    it("应该正确构建混合内容消息", () => {
      const message = new MessageBuilder({
        type: MessageType.ASSISTANT,
      })
        .addText("Hello")
        .addCode("console.log('hello')", "javascript")
        .addImage("https://example.com/image.jpg")
        .build();

      expect(message.getType()).toBe(MessageType.ASSISTANT);
      expect(message.hasContentType(MessageContentType.TEXT)).toBe(true);
      expect(message.hasContentType(MessageContentType.CODE)).toBe(true);
      expect(message.hasContentType(MessageContentType.IMAGE)).toBe(true);
    });
  });

  describe("链式调用", () => {
    it("应该支持链式调用", () => {
      const message = new MessageBuilder()
        .setId("msg-1")
        .setType(MessageType.USER)
        .setSessionId("session-1")
        .setUserId("user-1")
        .addText("Hello")
        .addMarkdown("**Bold**")
        .updateMetadata("key", "value")
        .build();

      expect(message.getId()).toBe("msg-1");
      expect(message.getType()).toBe(MessageType.USER);
      expect(message.getSessionId()).toBe("session-1");
      expect(message.getUserId()).toBe("user-1");
      expect(message.getMetadata()).toEqual({ key: "value" });
    });

    it("应该正确清空内容", () => {
      const builder = new MessageBuilder({
        type: MessageType.USER,
      })
        .addText("Hello")
        .addMarkdown("**Bold**")
        .clearContent();

      expect(() => builder.build()).toThrow(AppError);
    });
  });

  describe("静态方法", () => {
    it("应该正确创建用户消息", () => {
      const message = MessageBuilder.createUserMessage("Hello", "session-1");

      expect(message.getType()).toBe(MessageType.USER);
      expect(message.getText()).toBe("Hello");
      expect(message.getSessionId()).toBe("session-1");
    });

    it("应该正确创建助手消息", () => {
      const message = MessageBuilder.createAssistantMessage("Hi", "session-1");

      expect(message.getType()).toBe(MessageType.ASSISTANT);
      expect(message.getText()).toBe("Hi");
      expect(message.getSessionId()).toBe("session-1");
    });

    it("应该正确创建 Markdown 消息", () => {
      const message = MessageBuilder.createMarkdownMessage("**Bold**", "session-1");

      expect(message.getType()).toBe(MessageType.ASSISTANT);
      expect(message.hasContentType(MessageContentType.MARKDOWN)).toBe(true);
    });

    it("应该正确创建代码消息", () => {
      const message = MessageBuilder.createCodeMessage(
        "console.log('hello')",
        "javascript",
        "session-1",
      );

      expect(message.getType()).toBe(MessageType.ASSISTANT);
      expect(message.hasContentType(MessageContentType.CODE)).toBe(true);
    });

    it("应该正确创建混合内容消息", () => {
      const message = MessageBuilder.createMixedMessage(
        MessageType.ASSISTANT,
        [
          { type: "text", data: "Hello" },
          { type: "code", data: "console.log('hello')", language: "javascript" },
          { type: "image", data: "https://example.com/image.jpg" },
        ],
        "session-1",
      );

      expect(message.getType()).toBe(MessageType.ASSISTANT);
      expect(message.hasContentType(MessageContentType.TEXT)).toBe(true);
      expect(message.hasContentType(MessageContentType.CODE)).toBe(true);
      expect(message.hasContentType(MessageContentType.IMAGE)).toBe(true);
    });

    it("应该正确合并多个消息", () => {
      const msg1 = MessageBuilder.createUserMessage("Hello", "session-1");
      const msg2 = MessageBuilder.createAssistantMessage("Hi", "session-1");

      const merged = MessageBuilder.mergeMessages([msg1, msg2], MessageType.ASSISTANT);

      expect(merged.getType()).toBe(MessageType.ASSISTANT);
      expect(merged.getSessionId()).toBe("session-1");
    });
  });

  describe("格式化工具", () => {
    it("应该正确格式化 Markdown", () => {
      const formatted = MessageBuilder.formatMarkdown("**Bold** text");
      expect(formatted).toBe("**Bold** text");
    });

    it("应该正确格式化代码块", () => {
      const formatted = MessageBuilder.formatCodeBlock("console.log('hello')", "javascript");
      expect(formatted).toBe("```javascript\nconsole.log('hello')\n```");
    });

    it("应该正确格式化链接", () => {
      const formatted = MessageBuilder.formatLink("Text", "https://example.com");
      expect(formatted).toBe("[Text](https://example.com)");
    });

    it("应该正确格式化图片", () => {
      const formatted = MessageBuilder.formatImage("Alt", "https://example.com/image.jpg");
      expect(formatted).toBe("![Alt](https://example.com/image.jpg)");
    });

    it("应该正确格式化引用", () => {
      const formatted = MessageBuilder.formatQuote("Quote text");
      expect(formatted).toBe("> Quote text");
    });

    it("应该正确格式化列表项", () => {
      const unordered = MessageBuilder.formatListItem("Item", false);
      const ordered = MessageBuilder.formatListItem("Item", true, 1);

      expect(unordered).toBe("- Item");
      expect(ordered).toBe("1. Item");
    });

    it("应该正确格式化标题", () => {
      const h1 = MessageBuilder.formatHeading("Title", 1);
      const h2 = MessageBuilder.formatHeading("Title", 2);

      expect(h1).toBe("# Title");
      expect(h2).toBe("## Title");
    });

    it("应该正确格式化分割线", () => {
      const formatted = MessageBuilder.formatHorizontalRule();
      expect(formatted).toBe("---");
    });

    it("应该正确格式化表格行", () => {
      const header = MessageBuilder.formatTableRow(["Cell1", "Cell2"], true);
      const row = MessageBuilder.formatTableRow(["Cell1", "Cell2"], false);

      expect(header).toContain("| Cell1 | Cell2 |");
      expect(header).toContain("| --- | --- |");
      expect(row).toBe("| Cell1 | Cell2 |");
    });

    it("应该正确格式化 JSON", () => {
      const data = { key: "value" };
      const formatted = MessageBuilder.formatJson(data, 2);

      expect(formatted).toBe('{\n  "key": "value"\n}');
    });
  });

  describe("转换工具", () => {
    it("应该正确转换为纯文本", () => {
      const message = MessageBuilder.createUserMessage("Hello World");
      const plainText = MessageBuilder.toPlainText(message);

      expect(plainText).toBe("Hello World");
    });

    it("应该正确转换为 Markdown", () => {
      const message = MessageBuilder.createCodeMessage("console.log('hello')", "javascript");
      const markdown = MessageBuilder.toMarkdown(message);

      expect(markdown).toContain("```javascript");
      expect(markdown).toContain("console.log('hello')");
    });

    it("应该正确转换图片消息为纯文本", () => {
      const message = Message.createImageMessage(
        "msg-1",
        "https://example.com/image.jpg",
        "Caption",
      );
      const plainText = MessageBuilder.toPlainText(message);

      expect(plainText).toBe("[Image: Caption]");
    });

    it("应该正确转换代码消息为 Markdown", () => {
      const message = Message.createCodeMessage("msg-1", "console.log('hello')", "javascript");
      const markdown = MessageBuilder.toMarkdown(message);

      expect(markdown).toBe("```javascript\nconsole.log('hello')\n```");
    });
  });

  describe("错误处理", () => {
    it("应该拒绝构建空消息", () => {
      const builder = new MessageBuilder({
        type: MessageType.USER,
      });

      expect(() => builder.build()).toThrow(AppError);
    });

    it("应该拒绝合并空消息列表", () => {
      expect(() => MessageBuilder.mergeMessages([], MessageType.ASSISTANT)).toThrow(AppError);
    });
  });
});
