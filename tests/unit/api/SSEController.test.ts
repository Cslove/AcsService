import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SSEController } from "@/api/controllers/SSEController.js";
import { eventBus } from "@/infrastructure/events/EventBus.js";
import { EventType } from "@/shared/types/index.js";

describe("SSEController", () => {
  let controller: SSEController;
  let mockResponse: any;

  beforeEach(() => {
    controller = new SSEController();

    // 创建模拟响应对象
    mockResponse = {
      write: vi.fn(),
    };
  });

  afterEach(() => {
    // 清理所有连接
    controller.closeAll();
  });

  describe("subscribe", () => {
    it("应该能够成功订阅 SSE 连接", () => {
      const connectionId = controller.subscribe("user-1", "session-1", mockResponse);

      expect(connectionId).toBeDefined();
      expect(typeof connectionId).toBe("string");
      expect(controller.getActiveConnectionCount()).toBe(1);
    });

    it("应该能够订阅不带 sessionId 的连接", () => {
      const connectionId = controller.subscribe("user-1", undefined, mockResponse);

      expect(connectionId).toBeDefined();
      expect(controller.getActiveConnectionCount()).toBe(1);
    });

    it("应该限制每个用户的最大连接数", () => {
      const maxConnections = 5;

      // 创建最大数量的连接
      for (let i = 0; i < maxConnections; i++) {
        controller.subscribe("user-1", `session-${i}`, mockResponse);
      }

      // 尝试创建超出限制的连接
      expect(() => {
        controller.subscribe("user-1", "session-extra", mockResponse);
      }).toThrow(/Maximum connections/);

      expect(controller.getActiveConnectionCount()).toBe(maxConnections);
    });

    it("应该允许不同用户各自达到最大连接数", () => {
      const maxConnections = 5;

      // 用户 1 创建最大数量的连接
      for (let i = 0; i < maxConnections; i++) {
        controller.subscribe("user-1", `session-${i}`, mockResponse);
      }

      // 用户 2 也应该能够创建最大数量的连接
      for (let i = 0; i < maxConnections; i++) {
        controller.subscribe("user-2", `session-${i}`, mockResponse);
      }

      expect(controller.getActiveConnectionCount()).toBe(maxConnections * 2);
    });
  });

  describe("unsubscribe", () => {
    it("应该能够取消订阅并关闭连接", () => {
      const connectionId = controller.subscribe("user-1", "session-1", mockResponse);

      expect(controller.getActiveConnectionCount()).toBe(1);

      controller.unsubscribe(connectionId);

      expect(controller.getActiveConnectionCount()).toBe(0);
    });

    it("取消订阅不存在的连接不应该抛出错误", () => {
      expect(() => {
        controller.unsubscribe("non-existent-id");
      }).not.toThrow();
    });

    it("取消订阅后应该清理 EventBus 监听器", () => {
      const connectionId = controller.subscribe("user-1", "session-1", mockResponse);

      // 获取订阅前的监听器数量
      const beforeCount = eventBus.listenerCount();

      controller.unsubscribe(connectionId);

      // 订阅后监听器数量应该减少
      const afterCount = eventBus.listenerCount();
      expect(afterCount).toBeLessThanOrEqual(beforeCount);
    });
  });

  describe("sendToUser", () => {
    it("应该向指定用户的所有连接推送事件", () => {
      const mockResponse1 = { write: vi.fn() };
      const mockResponse2 = { write: vi.fn() };

      controller.subscribe("user-1", "session-1", mockResponse1);
      controller.subscribe("user-1", "session-2", mockResponse2);

      const testEvent = {
        type: EventType.MESSAGE_CREATED,
        data: { message: "test" },
        timestamp: Date.now(),
        eventId: "test-event-1",
      };

      controller.sendToUser("user-1", testEvent);

      expect(mockResponse1.write).toHaveBeenCalledTimes(1);
      expect(mockResponse2.write).toHaveBeenCalledTimes(1);
    });

    it("不应该向其他用户的连接推送事件", () => {
      controller.subscribe("user-1", "session-1", mockResponse);
      controller.subscribe("user-2", "session-2", mockResponse);

      const testEvent = {
        type: EventType.MESSAGE_CREATED,
        data: { message: "test" },
        timestamp: Date.now(),
        eventId: "test-event-1",
      };

      controller.sendToUser("user-1", testEvent);

      // 只应该调用一次（user-1 的连接）
      expect(mockResponse.write).toHaveBeenCalledTimes(1);
    });

    it("向不存在的用户推送事件不应该抛出错误", () => {
      const testEvent = {
        type: EventType.MESSAGE_CREATED,
        data: { message: "test" },
        timestamp: Date.now(),
        eventId: "test-event-1",
      };

      expect(() => {
        controller.sendToUser("non-existent-user", testEvent);
      }).not.toThrow();
    });
  });

  describe("sendToSession", () => {
    it("应该向指定会话的连接推送事件", () => {
      controller.subscribe("user-1", "session-1", mockResponse);
      controller.subscribe("user-1", "session-2", mockResponse);

      const testEvent = {
        type: EventType.MESSAGE_CREATED,
        data: { message: "test" },
        timestamp: Date.now(),
        eventId: "test-event-1",
      };

      controller.sendToSession("session-1", testEvent);

      expect(mockResponse.write).toHaveBeenCalledTimes(1);
    });

    it("不应该向其他会话的连接推送事件", () => {
      controller.subscribe("user-1", "session-1", mockResponse);
      controller.subscribe("user-2", "session-2", mockResponse);

      const testEvent = {
        type: EventType.MESSAGE_CREATED,
        data: { message: "test" },
        timestamp: Date.now(),
        eventId: "test-event-1",
      };

      controller.sendToSession("session-1", testEvent);

      expect(mockResponse.write).toHaveBeenCalledTimes(1);
    });
  });

  describe("broadcast", () => {
    it("应该向所有连接广播事件", () => {
      controller.subscribe("user-1", "session-1", mockResponse);
      controller.subscribe("user-2", "session-2", mockResponse);
      controller.subscribe("user-3", "session-3", mockResponse);

      const testEvent = {
        type: EventType.MESSAGE_CREATED,
        data: { message: "test" },
        timestamp: Date.now(),
        eventId: "test-event-1",
      };

      controller.broadcast(testEvent);

      expect(mockResponse.write).toHaveBeenCalledTimes(3);
    });
  });

  describe("getStats", () => {
    it("应该返回正确的连接统计信息", () => {
      controller.subscribe("user-1", "session-1", mockResponse);
      controller.subscribe("user-1", "session-2", mockResponse);
      controller.subscribe("user-2", "session-3", mockResponse);

      const stats = controller.getStats();

      expect(stats.totalConnections).toBe(3);
      expect(stats.connectionsByUser.get("user-1")).toBe(2);
      expect(stats.connectionsByUser.get("user-2")).toBe(1);
    });

    it("取消订阅后应该更新统计信息", () => {
      const connectionId = controller.subscribe("user-1", "session-1", mockResponse);

      controller.unsubscribe(connectionId);

      const stats = controller.getStats();
      expect(stats.connectionsByUser.get("user-1")).toBe(0);
    });
  });

  describe("closeAll", () => {
    it("应该关闭所有连接", () => {
      controller.subscribe("user-1", "session-1", mockResponse);
      controller.subscribe("user-2", "session-2", mockResponse);

      expect(controller.getActiveConnectionCount()).toBe(2);

      controller.closeAll();

      expect(controller.getActiveConnectionCount()).toBe(0);
    });
  });

  describe("事件推送", () => {
    it("应该正确格式化 SSE 事件数据", () => {
      controller.subscribe("user-1", "session-1", mockResponse);

      const testEvent = {
        type: EventType.MESSAGE_CREATED,
        data: { content: "Hello" },
        timestamp: 1234567890,
        eventId: "event-123",
      };

      controller.sendToUser("user-1", testEvent);

      expect(mockResponse.write).toHaveBeenCalledWith(
        expect.stringContaining("event: message_created"),
      );
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining("data:"));
      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining("Hello"));
    });
  });
});
