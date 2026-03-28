import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubStorage } from "@/infrastructure/storage/github/GitHubStorage.js";
import { DataSerializer } from "@/infrastructure/storage/github/serializer.js";
import { z } from "zod";

// Mock Octokit
const mockGetContent = vi.fn();
const mockCreateOrUpdateFileContents = vi.fn();
const mockDeleteFile = vi.fn();

vi.mock("octokit", () => {
  const OctokitMock = class {
    rest = {
      repos: {
        getContent: mockGetContent,
        createOrUpdateFileContents: mockCreateOrUpdateFileContents,
        deleteFile: mockDeleteFile,
      },
    };
  };
  return { Octokit: OctokitMock };
});

describe("GitHubStorage", () => {
  let storage: GitHubStorage;

  const config = {
    token: "test-token",
    owner: "test-owner",
    repo: "test-repo",
    branch: "main",
    basePath: "data",
  };

  beforeEach(() => {
    storage = new GitHubStorage(config);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("readFile", () => {
    it("should read and parse file content", async () => {
      const mockData = { name: "test", value: 123 };
      const mockContent = Buffer.from(JSON.stringify(mockData)).toString("base64");

      mockGetContent.mockResolvedValue({
        data: {
          content: mockContent,
        },
      });

      const result = await storage.readFile("test/file.json");
      expect(result).toEqual(mockData);
    });

    it("should return null for non-existent file", async () => {
      mockGetContent.mockRejectedValue({
        status: 404,
      });

      const result = await storage.readFile("non-existent.json");
      expect(result).toBeNull();
    });

    it("should validate data with schema", async () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const mockData = { name: "test", value: 123 };
      const mockContent = Buffer.from(JSON.stringify(mockData)).toString("base64");

      mockGetContent.mockResolvedValue({
        data: {
          content: mockContent,
        },
      });

      const result = await storage.readFile("test/file.json", schema);
      expect(result).toEqual(mockData);
    });

    it("should throw error for invalid data", async () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const mockData = { name: "test", value: "invalid" };
      const mockContent = Buffer.from(JSON.stringify(mockData)).toString("base64");

      mockGetContent.mockResolvedValue({
        data: {
          content: mockContent,
        },
      });

      await expect(storage.readFile("test/file.json", schema)).rejects.toThrow();
    });
  });

  describe("writeFile", () => {
    it("should write new file", async () => {
      const data = { name: "test", value: 123 };

      mockGetContent.mockRejectedValue({
        status: 404,
      });

      mockCreateOrUpdateFileContents.mockResolvedValue({
        data: {},
      });

      await storage.writeFile("test/file.json", data);

      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "test/file.json",
          message: "Update test/file.json",
          branch: "main",
        }),
      );
    });

    it("should update existing file", async () => {
      const data = { name: "test", value: 123 };

      mockGetContent.mockResolvedValue({
        data: {
          sha: "abc123",
        },
      });

      mockCreateOrUpdateFileContents.mockResolvedValue({
        data: {},
      });

      await storage.writeFile("test/file.json", data);

      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "test/file.json",
          sha: "abc123",
        }),
      );
    });

    it("should validate data with schema before writing", async () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const data = { name: "test", value: 123 };

      mockGetContent.mockRejectedValue({
        status: 404,
      });

      mockCreateOrUpdateFileContents.mockResolvedValue({
        data: {},
      });

      await storage.writeFile("test/file.json", data, schema);

      expect(mockCreateOrUpdateFileContents).toHaveBeenCalled();
    });

    it("should throw error for invalid data", async () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const data: any = { name: "test", value: "invalid" };

      await expect(storage.writeFile("test/file.json", data, schema)).rejects.toThrow();
    });
  });

  describe("deleteFile", () => {
    it("should delete existing file", async () => {
      mockGetContent.mockResolvedValue({
        data: {
          sha: "abc123",
        },
      });

      mockDeleteFile.mockResolvedValue({
        data: {},
      });

      await storage.deleteFile("test/file.json");

      expect(mockDeleteFile).toHaveBeenCalledWith(
        expect.objectContaining({
          path: "test/file.json",
          sha: "abc123",
          message: "Delete test/file.json",
        }),
      );
    });

    it("should handle non-existent file gracefully", async () => {
      mockGetContent.mockRejectedValue({
        status: 404,
      });

      await expect(storage.deleteFile("non-existent.json")).resolves.not.toThrow();
    });
  });

  describe("listFiles", () => {
    it("should list files in directory", async () => {
      mockGetContent.mockResolvedValue({
        data: [
          { name: "file1.json", type: "file" },
          { name: "file2.json", type: "file" },
          { name: "subdir", type: "dir" },
        ],
      });

      const result = await storage.listFiles("test/");
      expect(result).toEqual(["file1.json", "file2.json"]);
    });

    it("should return empty array for non-existent directory", async () => {
      mockGetContent.mockRejectedValue({
        status: 404,
      });

      const result = await storage.listFiles("non-existent/");
      expect(result).toEqual([]);
    });
  });

  describe("fileExists", () => {
    it("should return true for existing file", async () => {
      mockGetContent.mockResolvedValue({
        data: {},
      });

      const result = await storage.fileExists("test/file.json");
      expect(result).toBe(true);
    });

    it("should return false for non-existent file", async () => {
      mockGetContent.mockRejectedValue({
        status: 404,
      });

      const result = await storage.fileExists("non-existent.json");
      expect(result).toBe(false);
    });
  });

  describe("getFileInfo", () => {
    it("should return file info", async () => {
      mockGetContent.mockResolvedValue({
        data: {
          sha: "abc123",
          size: 1024,
        },
      });

      const result = await storage.getFileInfo("test/file.json");
      expect(result).toEqual({
        sha: "abc123",
        size: 1024,
        modifiedAt: expect.any(Date),
      });
    });

    it("should return null for non-existent file", async () => {
      mockGetContent.mockRejectedValue({
        status: 404,
      });

      const result = await storage.getFileInfo("non-existent.json");
      expect(result).toBeNull();
    });
  });

  describe("readFiles", () => {
    it("should read multiple files", async () => {
      const mockData1 = { name: "test1", value: 123 };
      const mockData2 = { name: "test2", value: 456 };

      mockGetContent
        .mockResolvedValueOnce({
          data: {
            content: Buffer.from(JSON.stringify(mockData1)).toString("base64"),
          },
        })
        .mockResolvedValueOnce({
          data: {
            content: Buffer.from(JSON.stringify(mockData2)).toString("base64"),
          },
        });

      const result = await storage.readFiles(["file1.json", "file2.json"]);
      expect(result.size).toBe(2);
      expect(result.get("file1.json")).toEqual(mockData1);
      expect(result.get("file2.json")).toEqual(mockData2);
    });

    it("should skip non-existent files", async () => {
      const mockData = { name: "test", value: 123 };

      mockGetContent
        .mockResolvedValueOnce({
          data: {
            content: Buffer.from(JSON.stringify(mockData)).toString("base64"),
          },
        })
        .mockRejectedValueOnce({
          status: 404,
        });

      const result = await storage.readFiles(["file1.json", "non-existent.json"]);
      expect(result.size).toBe(1);
      expect(result.get("file1.json")).toEqual(mockData);
    });
  });

  describe("writeFiles", () => {
    it("should write multiple files", async () => {
      const entries = new Map([
        ["file1.json", { name: "test1", value: 123 }],
        ["file2.json", { name: "test2", value: 456 }],
      ]);

      mockGetContent.mockRejectedValue({
        status: 404,
      });

      mockCreateOrUpdateFileContents.mockResolvedValue({
        data: {},
      });

      await storage.writeFiles(entries);

      expect(mockCreateOrUpdateFileContents).toHaveBeenCalledTimes(2);
    });
  });
});

describe("DataSerializer", () => {
  describe("serialize", () => {
    it("should serialize data to JSON string", () => {
      const data = { name: "test", value: 123 };
      const result = DataSerializer.serialize(data);
      expect(result).toBe(JSON.stringify(data, null, 2));
    });

    it("should serialize without pretty print", () => {
      const data = { name: "test", value: 123 };
      const result = DataSerializer.serialize(data, { pretty: false });
      expect(result).toBe(JSON.stringify(data));
    });
  });

  describe("deserialize", () => {
    it("should deserialize JSON string to data", () => {
      const data = { name: "test", value: 123 };
      const json = JSON.stringify(data);
      const result = DataSerializer.deserialize(json);
      expect(result).toEqual(data);
    });

    it("should validate data with schema", () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const data = { name: "test", value: 123 };
      const json = JSON.stringify(data);
      const result = DataSerializer.deserialize(json, { schema });
      expect(result).toEqual(data);
    });

    it("should throw error for invalid data", () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const data = { name: "test", value: "invalid" };
      const json = JSON.stringify(data);

      expect(() => DataSerializer.deserialize(json, { schema })).toThrow();
    });

    it("should throw error for invalid JSON", () => {
      expect(() => DataSerializer.deserialize("invalid json")).toThrow();
    });
  });

  describe("clone", () => {
    it("should clone data", () => {
      const data = { name: "test", value: 123 };
      const cloned = DataSerializer.clone(data);
      expect(cloned).toEqual(data);
      expect(cloned).not.toBe(data);
    });
  });

  describe("merge", () => {
    it("should merge objects", () => {
      const target = { name: "test", value: 123 };
      const source = { value: 456, extra: "field" };
      const result = DataSerializer.merge(target, source);
      expect(result).toEqual({
        name: "test",
        value: 456,
        extra: "field",
      });
    });
  });

  describe("validate", () => {
    it("should validate data with schema", () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const data = { name: "test", value: 123 };
      const result = DataSerializer.validate(data, schema);
      expect(result).toEqual(data);
    });

    it("should throw error for invalid data", () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const data = { name: "test", value: "invalid" };

      expect(() => DataSerializer.validate(data, schema)).toThrow();
    });
  });

  describe("validateBatch", () => {
    it("should validate multiple items", () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const items = [
        { name: "test1", value: 123 },
        { name: "test2", value: 456 },
      ];

      const result = DataSerializer.validateBatch(items, schema);
      expect(result).toEqual(items);
    });

    it("should throw error for invalid item", () => {
      const schema = z.object({
        name: z.string(),
        value: z.number(),
      });

      const items = [
        { name: "test1", value: 123 },
        { name: "test2", value: "invalid" },
      ];

      expect(() => DataSerializer.validateBatch(items, schema)).toThrow();
    });
  });
});
