import { promises as fs } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export interface FileCacheOptions {
  cacheDir?: string;
  maxAge?: number;
  maxSize?: number;
}

export interface CacheIndexEntry {
  key: string;
  filename: string;
  createdAt: number;
  expiresAt: number;
  size: number;
}

export class FileCache<T = any> {
  private cacheDir: string;
  private maxAge: number;
  private maxSize: number;
  private indexFile: string;
  private index: Map<string, CacheIndexEntry>;
  private initialized: boolean = false;

  constructor(options: FileCacheOptions = {}) {
    this.cacheDir = options.cacheDir ?? path.join(process.cwd(), ".cache");
    this.maxAge = options.maxAge ?? 1000 * 60 * 60 * 24; // 默认 24 小时
    this.maxSize = options.maxSize ?? 100 * 1024 * 1024; // 默认 100MB
    this.indexFile = path.join(this.cacheDir, "index.json");
    this.index = new Map();
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await fs.mkdir(this.cacheDir, { recursive: true });
      await this.loadIndex();
      await this.cleanExpired();
      this.initialized = true;
    } catch (error) {
      console.error("Failed to initialize FileCache:", error);
      throw error;
    }
  }

  private async loadIndex(): Promise<void> {
    try {
      const data = await fs.readFile(this.indexFile, "utf-8");
      const entries: CacheIndexEntry[] = JSON.parse(data);
      this.index = new Map(entries.map((entry) => [entry.key, entry]));
    } catch {
      // Index file doesn't exist or is corrupted, start fresh
      this.index = new Map();
    }
  }

  private async saveIndex(): Promise<void> {
    const entries = Array.from(this.index.values());
    await fs.mkdir(path.dirname(this.indexFile), { recursive: true });
    await fs.writeFile(this.indexFile, JSON.stringify(entries, null, 2), "utf-8");
  }

  private async cleanExpired(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.index) {
      if (entry.expiresAt < now) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      await this.delete(key);
    }
  }

  private async enforceMaxSize(): Promise<void> {
    const totalSize = Array.from(this.index.values()).reduce((sum, entry) => sum + entry.size, 0);

    if (totalSize > this.maxSize) {
      // Sort by creation time and remove oldest entries
      const sortedEntries = Array.from(this.index.values()).sort(
        (a, b) => a.createdAt - b.createdAt,
      );
      let removedSize = 0;

      for (const entry of sortedEntries) {
        if (removedSize >= totalSize - this.maxSize) {
          break;
        }
        await this.delete(entry.key);
        removedSize += entry.size;
      }
    }
  }

  async get(key: string): Promise<T | null> {
    await this.ensureInitialized();

    const entry = this.index.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      await this.delete(key);
      return null;
    }

    try {
      const data = await fs.readFile(entry.filename, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      console.error(`Failed to read cache file for key ${key}:`, error);
      await this.delete(key);
      return null;
    }
  }

  async set(key: string, value: T, ttl?: number): Promise<void> {
    await this.ensureInitialized();

    const filename = path.join(this.cacheDir, `${uuidv4()}.json`);
    const data = JSON.stringify(value);
    const size = Buffer.byteLength(data, "utf-8");
    const now = Date.now();
    const expiresAt = ttl ? now + ttl : now + this.maxAge;

    try {
      // Ensure directory exists before writing
      await fs.mkdir(this.cacheDir, { recursive: true });
      await fs.writeFile(filename, data, "utf-8");

      const entry: CacheIndexEntry = {
        key,
        filename,
        createdAt: now,
        expiresAt,
        size,
      };

      this.index.set(key, entry);
      await this.saveIndex();
      await this.enforceMaxSize();
    } catch (error) {
      console.error(`Failed to write cache for key ${key}:`, error);
      // Clean up the file if it was created
      try {
        await fs.unlink(filename);
      } catch {
        // Ignore
      }
      throw error;
    }
  }

  async has(key: string): Promise<boolean> {
    await this.ensureInitialized();

    const entry = this.index.get(key);
    if (!entry) {
      return false;
    }

    if (entry.expiresAt < Date.now()) {
      await this.delete(key);
      return false;
    }

    return true;
  }

  async delete(key: string): Promise<boolean> {
    await this.ensureInitialized();

    const entry = this.index.get(key);
    if (!entry) {
      return false;
    }

    try {
      await fs.unlink(entry.filename);
    } catch {
      // File might not exist, ignore error
    }

    this.index.delete(key);
    await this.saveIndex();
    return true;
  }

  async clear(): Promise<void> {
    await this.ensureInitialized();

    for (const entry of this.index.values()) {
      try {
        await fs.unlink(entry.filename);
      } catch {
        // File might not exist, ignore error
      }
    }

    this.index.clear();
    try {
      await this.saveIndex();
    } catch {
      // Ignore save errors during clear
    }
  }

  async getStats(): Promise<{ size: number; count: number; totalSize: number }> {
    await this.ensureInitialized();

    const entries = Array.from(this.index.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);

    return {
      size: entries.length,
      count: entries.length,
      totalSize,
    };
  }
}
