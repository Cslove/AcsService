import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "@/infrastructure/events/EventBus.js";
import { EventType } from "@/shared/types/index.js";

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe("事件订阅和发布", () => {
    it("应该能够订阅和发布事件", () => {
      const listener = vi.fn();
      eventBus.on(EventType.MESSAGE_CREATED, listener);

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };
      eventBus.emit(EventType.MESSAGE_CREATED, data);

      expect(listener).toHaveBeenCalledWith(data);
    });

    it("应该支持多个监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on(EventType.MESSAGE_CREATED, listener1);
      eventBus.on(EventType.MESSAGE_CREATED, listener2);

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };
      eventBus.emit(EventType.MESSAGE_CREATED, data);

      expect(listener1).toHaveBeenCalledWith(data);
      expect(listener2).toHaveBeenCalledWith(data);
    });

    it("应该支持一次性监听器", () => {
      const listener = vi.fn();

      eventBus.once(EventType.MESSAGE_CREATED, listener);

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };
      eventBus.emit(EventType.MESSAGE_CREATED, data);
      eventBus.emit(EventType.MESSAGE_CREATED, data);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("事件去重", () => {
    it("应该在去重窗口内阻止重复事件", () => {
      const listener = vi.fn();
      eventBus.on(EventType.MESSAGE_CREATED, listener);

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };

      eventBus.emit(EventType.MESSAGE_CREATED, data);
      eventBus.emit(EventType.MESSAGE_CREATED, data);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("应该在去重窗口外允许重复事件", async () => {
      const listener = vi.fn();
      eventBus.on(EventType.MESSAGE_CREATED, listener);

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };

      eventBus.emit(EventType.MESSAGE_CREATED, data);

      // 等待去重窗口过期（1秒）
      await new Promise((resolve) => setTimeout(resolve, 1100));

      eventBus.emit(EventType.MESSAGE_CREATED, data);

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it("应该支持禁用去重", () => {
      const listener = vi.fn();
      eventBus.on(EventType.MESSAGE_CREATED, listener);

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };

      eventBus.emit(EventType.MESSAGE_CREATED, data, { deduplicate: false });
      eventBus.emit(EventType.MESSAGE_CREATED, data, { deduplicate: false });

      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe("命名空间隔离", () => {
    it("应该支持命名空间", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on(EventType.MESSAGE_CREATED, listener1, { namespace: "user1" });
      eventBus.on(EventType.MESSAGE_CREATED, listener2, { namespace: "user2" });

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };

      eventBus.emit(EventType.MESSAGE_CREATED, data, { namespace: "user1" });

      expect(listener1).toHaveBeenCalledWith(data);
      expect(listener2).not.toHaveBeenCalled();
    });

    it("应该能够移除命名空间下的所有监听器", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      eventBus.on(EventType.MESSAGE_CREATED, listener1, { namespace: "user1" });
      eventBus.on(EventType.MESSAGE_CREATED, listener2, { namespace: "user1" });
      eventBus.on(EventType.MESSAGE_CREATED, listener3, { namespace: "user2" });

      eventBus.removeAllListeners("user1");

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };
      eventBus.emit(EventType.MESSAGE_CREATED, data, { namespace: "user2" });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).toHaveBeenCalledWith(data);
    });
  });

  describe("优先级", () => {
    it("应该按照优先级顺序执行监听器", () => {
      const executionOrder: number[] = [];

      eventBus.on(EventType.MESSAGE_CREATED, () => executionOrder.push(1), { priority: 1 });
      eventBus.on(EventType.MESSAGE_CREATED, () => executionOrder.push(3), { priority: 3 });
      eventBus.on(EventType.MESSAGE_CREATED, () => executionOrder.push(2), { priority: 2 });

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };
      eventBus.emit(EventType.MESSAGE_CREATED, data);

      expect(executionOrder).toEqual([3, 2, 1]);
    });
  });

  describe("取消订阅", () => {
    it("应该能够取消订阅", () => {
      const listener = vi.fn();
      const listenerId = eventBus.on(EventType.MESSAGE_CREATED, listener);

      eventBus.off(listenerId);

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };
      eventBus.emit(EventType.MESSAGE_CREATED, data);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("监听器数量", () => {
    it("应该能够获取监听器数量", () => {
      eventBus.on(EventType.MESSAGE_CREATED, vi.fn());
      eventBus.on(EventType.MESSAGE_CREATED, vi.fn());
      eventBus.on(EventType.SESSION_CREATED, vi.fn());

      expect(eventBus.listenerCount(EventType.MESSAGE_CREATED)).toBe(2);
      expect(eventBus.listenerCount(EventType.SESSION_CREATED)).toBe(1);
    });

    it("应该能够获取命名空间下的监听器数量", () => {
      eventBus.on(EventType.MESSAGE_CREATED, vi.fn(), { namespace: "user1" });
      eventBus.on(EventType.MESSAGE_CREATED, vi.fn(), { namespace: "user1" });
      eventBus.on(EventType.MESSAGE_CREATED, vi.fn(), { namespace: "user2" });

      expect(eventBus.listenerCount(undefined, "user1")).toBe(2);
      expect(eventBus.listenerCount(undefined, "user2")).toBe(1);
    });
  });

  describe("事件名称", () => {
    it("应该能够获取所有事件名称", () => {
      eventBus.on(EventType.MESSAGE_CREATED, vi.fn());
      eventBus.on(EventType.SESSION_CREATED, vi.fn());

      const eventNames = eventBus.eventNames();

      expect(eventNames).toContain(EventType.MESSAGE_CREATED);
      expect(eventNames).toContain(EventType.SESSION_CREATED);
    });
  });

  describe("错误处理", () => {
    it("应该捕获监听器中的错误", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      eventBus.on(EventType.MESSAGE_CREATED, () => {
        throw new Error("Test error");
      });

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };

      // 不应该抛出错误
      expect(() => eventBus.emit(EventType.MESSAGE_CREATED, data)).not.toThrow();

      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe("销毁", () => {
    it("应该能够销毁事件总线", () => {
      const listener = vi.fn();
      eventBus.on(EventType.MESSAGE_CREATED, listener);

      eventBus.destroy();

      const data = {
        message: {
          id: "1",
          sessionId: "session-1",
          role: "user",
          content: [],
          timestamp: new Date(),
        },
      };
      eventBus.emit(EventType.MESSAGE_CREATED, data);

      expect(listener).not.toHaveBeenCalled();
      expect(eventBus.listenerCount()).toBe(0);
    });
  });

  describe("SSE 事件", () => {
    it("应该能够发布 SSE 事件", () => {
      const listener = vi.fn();
      eventBus.on(EventType.MESSAGE_CREATED, listener);

      const sseEvent = {
        type: EventType.MESSAGE_CREATED,
        data: {
          message: {
            id: "1",
            sessionId: "session-1",
            role: "user",
            content: [],
            timestamp: new Date(),
          },
        },
        timestamp: Date.now(),
        eventId: "event-1",
      };

      eventBus.emitSSEEvent(sseEvent);

      expect(listener).toHaveBeenCalledWith(sseEvent);
    });
  });
});
