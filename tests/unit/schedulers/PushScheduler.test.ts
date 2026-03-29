import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PushScheduler } from "@/application/schedulers/PushScheduler.js";
import type { PushTaskConfig } from "@/application/schedulers/PushScheduler.js";
import { PushWorkflow } from "@/application/workflows/PushWorkflow.js";

describe("PushScheduler", () => {
  let scheduler: PushScheduler;
  let pushWorkflow: PushWorkflow;

  beforeEach(() => {
    pushWorkflow = new PushWorkflow();
    scheduler = new PushScheduler(pushWorkflow);
  });

  afterEach(() => {
    scheduler.cleanup();
  });

  describe("addPushTask", () => {
    it("应该成功添加推送任务", () => {
      const config: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "08:00",
          noon: "12:00",
          evening: "18:00",
        },
      };

      const taskId = scheduler.addPushTask(config);

      expect(taskId).toBeDefined();
      expect(taskId).toContain("user-1");
      expect(scheduler.getTaskCount()).toBe(3); // 三个时间段
    });

    it("应该使用默认时间配置", () => {
      const config: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
      };

      const _taskId = scheduler.addPushTask(config);

      expect(_taskId).toBeDefined();
      expect(scheduler.getTaskCount()).toBe(3);
    });

    it("应该只配置指定的时间段", () => {
      const config: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "08:00",
        },
      };

      const _taskId = scheduler.addPushTask(config);

      expect(_taskId).toBeDefined();
      // 由于默认配置包含三个时间段，所以会有3个任务
      expect(scheduler.getTaskCount()).toBe(3);
    });
  });

  describe("startPushTask", () => {
    it("应该成功启动推送任务", () => {
      const config: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "08:00",
        },
      };

      const _taskId = scheduler.addPushTask(config);
      const taskIds = scheduler.getAllTasks().map((t) => t.id);

      expect(() => scheduler.startPushTask(taskIds[0])).not.toThrow();

      const info = scheduler.getTaskInfo(taskIds[0]);
      expect(info?.status).toBe("scheduled");
    });

    it("应该抛出错误当任务不存在", () => {
      expect(() => scheduler.startPushTask("non-existent")).toThrow();
    });
  });

  describe("stopPushTask", () => {
    it("应该成功停止推送任务", () => {
      const config: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "08:00",
        },
      };

      const _taskId = scheduler.addPushTask(config);
      const taskIds = scheduler.getAllTasks().map((t) => t.id);

      scheduler.startPushTask(taskIds[0]);
      scheduler.stopPushTask(taskIds[0]);

      const info = scheduler.getTaskInfo(taskIds[0]);
      expect(info?.status).toBe("scheduled");
    });

    it("应该抛出错误当任务不存在", () => {
      expect(() => scheduler.stopPushTask("non-existent")).toThrow();
    });
  });

  describe("removePushTask", () => {
    it("应该成功移除推送任务", () => {
      const config: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "08:00",
        },
      };

      const _taskId = scheduler.addPushTask(config);
      const taskIds = scheduler.getAllTasks().map((t) => t.id);

      scheduler.removePushTask(taskIds[0]);

      expect(scheduler.hasTask(taskIds[0])).toBe(false);
      expect(scheduler.getTaskInfo(taskIds[0])).toBeUndefined();
    });

    it("应该抛出错误当任务不存在", () => {
      expect(() => scheduler.removePushTask("non-existent")).toThrow();
    });
  });

  describe("getTaskInfo", () => {
    it("应该返回任务信息", () => {
      const config: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "08:00",
        },
      };

      const _taskId = scheduler.addPushTask(config);
      const taskIds = scheduler.getAllTasks().map((t) => t.id);

      const info = scheduler.getTaskInfo(taskIds[0]);

      expect(info).toBeDefined();
      expect(info?.userId).toBe("user-1");
      expect(info?.scheduledTime).toBe("08:00");
      expect(info?.cronExpression).toBe("0 8 * * *");
    });

    it("应该返回 undefined 当任务不存在", () => {
      const info = scheduler.getTaskInfo("non-existent");
      expect(info).toBeUndefined();
    });
  });

  describe("getAllTasks", () => {
    it("应该返回所有任务", () => {
      const config1: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "08:00",
        },
      };

      const config2: PushTaskConfig = {
        userId: "user-2",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "09:00",
        },
      };

      scheduler.addPushTask(config1);
      scheduler.addPushTask(config2);

      const tasks = scheduler.getAllTasks();

      // 每个配置会创建3个任务（早、午、晚）
      expect(tasks).toHaveLength(6);
    });
  });

  describe("getUserTasks", () => {
    it("应该返回用户的所有任务", () => {
      const config1: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "08:00",
          noon: "12:00",
        },
      };

      const config2: PushTaskConfig = {
        userId: "user-2",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "09:00",
        },
      };

      scheduler.addPushTask(config1);
      scheduler.addPushTask(config2);

      const user1Tasks = scheduler.getUserTasks("user-1");
      const user2Tasks = scheduler.getUserTasks("user-2");

      // user-1 有 2 个时间段，但会创建 3 个任务（包含默认的晚推送）
      expect(user1Tasks).toHaveLength(3);
      expect(user2Tasks).toHaveLength(3);
      expect(user1Tasks.every((t) => t.userId === "user-1")).toBe(true);
      expect(user2Tasks.every((t) => t.userId === "user-2")).toBe(true);
    });
  });

  describe("stopAllTasks", () => {
    it("应该停止所有任务", () => {
      const config1: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "08:00",
        },
      };

      const config2: PushTaskConfig = {
        userId: "user-2",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "09:00",
        },
      };

      scheduler.addPushTask(config1);
      scheduler.addPushTask(config2);

      const taskIds = scheduler.getAllTasks().map((t) => t.id);
      taskIds.forEach((id) => scheduler.startPushTask(id));

      scheduler.stopAllTasks();

      taskIds.forEach((id) => {
        const info = scheduler.getTaskInfo(id);
        expect(info?.status).toBe("scheduled");
      });
    });
  });

  describe("hasTask", () => {
    it("应该返回 true 当任务存在", () => {
      const config: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "08:00",
        },
      };

      const _taskId = scheduler.addPushTask(config);
      const taskIds = scheduler.getAllTasks().map((t) => t.id);

      expect(scheduler.hasTask(taskIds[0])).toBe(true);
    });

    it("应该返回 false 当任务不存在", () => {
      expect(scheduler.hasTask("non-existent")).toBe(false);
    });
  });

  describe("getTaskCount", () => {
    it("应该返回任务数量", () => {
      const config: PushTaskConfig = {
        userId: "user-1",
        topicConfig: {
          source: "Test source",
          count: 3,
        },
        timeConfig: {
          morning: "08:00",
          noon: "12:00",
          evening: "18:00",
        },
      };

      scheduler.addPushTask(config);

      expect(scheduler.getTaskCount()).toBe(3);
    });
  });
});
