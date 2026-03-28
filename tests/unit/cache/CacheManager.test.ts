import { describe, it, expect, beforeEach, afterEach, afterAll } from "vitest";
import { CacheManager } from "@/infrastructure/storage/cache/CacheManager.js";
import path from "path";
import { promises as fs } from "fs";

describe("CacheManager", () => {
  let cacheManager: CacheManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), ".cache-test", `test-${Date.now()}`);
    cacheManager = new CacheManager({
      memory: { maxSize: 10, maxAge: 1000 },
      file: { cacheDir: tempDir, maxAge: 1000 * 60 },
    });
  });

  afterEach(async () => {
    await cacheManager.clear();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore
    }
  });

  afterAll(async () => {
    // 全局清理：删除整个 .cache-test 目录
    const cacheTestDir = path.join(process.cwd(), ".cache-test");
    try {
      await fs.rm(cacheTestDir, { recursive: true, force: true });
    } catch {
      // Ignore if directory doesn't exist
    }
  });

  describe("read-through", () => {
    it("should read from memory cache first", async () => {
      await cacheManager.set("key1", { value: "test1" });

      const result = await cacheManager.get("key1");
      expect(result).toEqual({ value: "test1" });
    });

    it("should read from file cache when memory cache misses", async () => {
      await cacheManager.set("key1", { value: "test1" });

      // Clear memory cache
      cacheManager.clear();

      // Should still get value from file cache
      const result = await cacheManager.get("key1");
      expect(result).toEqual({ value: "test1" });
    });

    it("should update memory cache after file cache hit", async () => {
      await cacheManager.set("key1", { value: "test1" });

      // Clear memory cache
      cacheManager.clear();

      // First read should populate memory cache
      await cacheManager.get("key1");

      // Second read should be from memory cache
      await cacheManager.get("key1");
      const stats = await cacheManager.getStats();
      expect(stats.memory.hits).toBeGreaterThan(0);
    });

    it("should return null when both caches miss", async () => {
      const result = await cacheManager.get("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("write-through", () => {
    it("should write to both memory and file cache", async () => {
      await cacheManager.set("key1", { value: "test1" });

      // Check memory cache
      const stats = await cacheManager.getStats();
      expect(stats.memory.size).toBe(1);

      // Check file cache
      const fileStats = await cacheManager.getStats();
      expect(fileStats.file.count).toBe(1);
    });
  });

  describe("cache operations", () => {
    it("should check if key exists in memory cache", async () => {
      await cacheManager.set("key1", { value: "test1" });
      expect(cacheManager.has("key1")).toBe(true);
      expect(cacheManager.has("nonexistent")).toBe(false);
    });

    it("should delete from both caches", async () => {
      await cacheManager.set("key1", { value: "test1" });
      await cacheManager.delete("key1");

      expect(cacheManager.has("key1")).toBe(false);
      expect(await cacheManager.get("key1")).toBeNull();
    });

    it("should clear both caches", async () => {
      await cacheManager.set("key1", { value: "test1" });
      await cacheManager.set("key2", { value: "test2" });
      await cacheManager.clear();

      expect(cacheManager.has("key1")).toBe(false);
      expect(await cacheManager.get("key2")).toBeNull();
    });
  });

  describe("cache statistics", () => {
    it("should return combined statistics", async () => {
      await cacheManager.set("key1", { value: "test1" });
      await cacheManager.set("key2", { value: "test2" });

      const stats = await cacheManager.getStats();
      expect(stats.memory.size).toBe(2);
      expect(stats.file.count).toBe(2);
    });
  });

  describe("cache refresh", () => {
    it("should refresh cache from file cache", async () => {
      await cacheManager.set("key1", { value: "test1" });

      // Clear memory cache
      cacheManager.clear();

      // Refresh from file cache
      await cacheManager.refresh("key1");

      // Should now be in memory cache
      expect(cacheManager.has("key1")).toBe(true);
    });

    it("should do nothing when key does not exist", async () => {
      await cacheManager.refresh("nonexistent");
      expect(cacheManager.has("nonexistent")).toBe(false);
    });
  });

  describe("cache warmup", () => {
    it("should warmup multiple keys", async () => {
      await cacheManager.set("key1", { value: "test1" });
      await cacheManager.set("key2", { value: "test2" });
      await cacheManager.set("key3", { value: "test3" });

      // Clear memory cache only (not file cache)
      cacheManager["memoryCache"].clear();

      // Warmup keys
      await cacheManager.warmup(["key1", "key2", "key3"]);

      // All keys should be in memory cache
      expect(cacheManager.has("key1")).toBe(true);
      expect(cacheManager.has("key2")).toBe(true);
      expect(cacheManager.has("key3")).toBe(true);
    });
  });

  describe("reset statistics", () => {
    it("should reset memory cache statistics", async () => {
      await cacheManager.set("key1", { value: "test1" });
      await cacheManager.get("key1");

      cacheManager.resetStats();

      const stats = await cacheManager.getStats();
      expect(stats.memory.hits).toBe(0);
      expect(stats.memory.misses).toBe(0);
    });
  });
});
