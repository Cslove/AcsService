import { z } from "zod";

/**
 * 数据序列化选项
 */
export interface SerializerOptions {
  pretty?: boolean;
  space?: number;
}

/**
 * 数据反序列化选项
 */
export interface DeserializerOptions<T> {
  schema?: z.ZodSchema<T>;
  strict?: boolean;
}

/**
 * 数据序列化器
 * 处理数据的序列化和反序列化
 */
export class DataSerializer {
  /**
   * 序列化数据为 JSON 字符串
   */
  static serialize<T>(data: T, options: SerializerOptions = {}): string {
    const { pretty = true, space = 2 } = options;

    try {
      if (pretty) {
        return JSON.stringify(data, null, space);
      }
      return JSON.stringify(data);
    } catch (error: any) {
      throw new Error(`Failed to serialize data: ${error.message}`);
    }
  }

  /**
   * 反序列化 JSON 字符串为数据
   */
  static deserialize<T>(json: string, options: DeserializerOptions<T> = {}): T {
    const { schema } = options;

    try {
      const parsed = JSON.parse(json);

      if (schema) {
        return schema.parse(parsed);
      }

      return parsed;
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new Error(`Data validation failed: ${error.issues.map((e) => e.message).join(", ")}`);
      }
      throw new Error(`Failed to deserialize data: ${error.message}`);
    }
  }

  /**
   * 深度克隆数据
   */
  static clone<T>(data: T): T {
    const json = this.serialize(data, { pretty: false });
    return this.deserialize<T>(json);
  }

  /**
   * 合并数据
   */
  static merge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    return {
      ...target,
      ...source,
    };
  }

  /**
   * 验证数据
   */
  static validate<T>(data: unknown, schema: z.ZodSchema<T>): T {
    try {
      return schema.parse(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new Error(`Data validation failed: ${error.issues.map((e) => e.message).join(", ")}`);
      }
      throw error;
    }
  }

  /**
   * 创建数据校验器
   */
  static createValidator<T>(schema: z.ZodSchema<T>) {
    return (data: unknown): T => {
      return this.validate(data, schema);
    };
  }

  /**
   * 批量验证数据
   */
  static validateBatch<T>(items: unknown[], schema: z.ZodSchema<T>): T[] {
    return items.map((item) => this.validate(item, schema));
  }
}

/**
 * 创建带序列化的存储操作包装器
 */
export function withSerialization<T>(schema?: z.ZodSchema<T>) {
  return {
    serialize: (data: T): string => DataSerializer.serialize(data),
    deserialize: (json: string): T => DataSerializer.deserialize<T>(json, { schema }),
    validate: (data: unknown): T => {
      if (!schema) {
        return data as T;
      }
      return DataSerializer.validate(data, schema);
    },
  };
}
