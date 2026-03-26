import { EventEmitter as EventEmitter3 } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type { EventType, SSEEvent } from '@/shared/types/index.js';

/**
 * 事件监听器包装器
 */
interface EventListenerWrapper {
  id: string;
  listener: (...args: any[]) => void;
  once: boolean;
  priority: number;
  namespace?: string;
}

/**
 * 事件总线类
 * 基于 EventEmitter3 实现，支持命名空间、事件去重和优先级
 */
export class EventBus {
  private emitter: EventEmitter3;
  private listeners: Map<string, EventListenerWrapper[]> = new Map();
  private recentEvents: Map<string, number> = new Map();
  private readonly deduplicationWindow: number = 1000; // 1秒去重窗口

  constructor() {
    this.emitter = new EventEmitter3();
  }

  /**
   * 订阅事件
   * @param event 事件类型
   * @param listener 事件监听器
   * @param options 选项
   */
  on(
    event: EventType | string,
    listener: (...args: any[]) => void,
    options?: {
      once?: boolean;
      priority?: number;
      namespace?: string;
    }
  ): string {
    const listenerId = uuidv4();
    const wrapper: EventListenerWrapper = {
      id: listenerId,
      listener,
      once: options?.once || false,
      priority: options?.priority || 0,
      namespace: options?.namespace,
    };

    const key = this.getEventKey(event, wrapper.namespace);
    
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    
    const listeners = this.listeners.get(key)!;
    listeners.push(wrapper);
    
    // 按优先级排序（优先级高的先执行）
    listeners.sort((a, b) => b.priority - a.priority);

    return listenerId;
  }

  /**
   * 订阅一次性事件
   */
  once(
    event: EventType | string,
    listener: (...args: any[]) => void,
    options?: {
      priority?: number;
      namespace?: string;
    }
  ): string {
    return this.on(event, listener, { ...options, once: true });
  }

  /**
   * 取消订阅
   * @param listenerId 监听器 ID
   */
  off(listenerId: string): void {
    for (const [key, listeners] of this.listeners.entries()) {
      const index = listeners.findIndex((wrapper) => wrapper.id === listenerId);
      if (index !== -1) {
        listeners.splice(index, 1);
        
        if (listeners.length === 0) {
          this.listeners.delete(key);
        }
        break;
      }
    }
  }

  /**
   * 发布事件
   * @param event 事件类型
   * @param data 事件数据
   * @param options 选项
   */
  emit(
    event: EventType | string,
    data: any,
    options?: {
      namespace?: string;
      deduplicate?: boolean;
    }
  ): boolean {
    const key = this.getEventKey(event, options?.namespace);
    
    // 事件去重
    if (options?.deduplicate !== false) {
      const now = Date.now();
      const lastTime = this.recentEvents.get(key);
      
      if (lastTime && now - lastTime < this.deduplicationWindow) {
        return false;
      }
      
      this.recentEvents.set(key, now);
      
      // 清理过期的事件记录
      setTimeout(() => {
        this.recentEvents.delete(key);
      }, this.deduplicationWindow);
    }

    // 获取监听器列表并按优先级执行
    const listeners = this.listeners.get(key);
    if (!listeners || listeners.length === 0) {
      return false;
    }

    let emitted = false;
    for (const wrapper of listeners) {
      try {
        wrapper.listener(data);
        emitted = true;
        
        // 如果是一次性监听器，移除它
        if (wrapper.once) {
          this.off(wrapper.id);
        }
      } catch (error) {
        console.error(`Error in event listener [${wrapper.id}]:`, error);
      }
    }

    return emitted;
  }

  /**
   * 发布 SSE 事件
   */
  emitSSEEvent(event: SSEEvent): boolean {
    return this.emit(event.type, event, { deduplicate: false });
  }

  /**
   * 移除命名空间下的所有监听器
   * @param namespace 命名空间
   */
  removeAllListeners(namespace?: string): void {
    if (namespace) {
      const keysToRemove: string[] = [];
      
      for (const [key, listeners] of this.listeners.entries()) {
        const remainingListeners = listeners.filter((wrapper) => wrapper.namespace !== namespace);
        
        if (remainingListeners.length === 0) {
          keysToRemove.push(key);
        } else {
          this.listeners.set(key, remainingListeners);
        }
      }
      
      keysToRemove.forEach((key) => this.listeners.delete(key));
    } else {
      this.listeners.clear();
    }
  }

  /**
   * 获取事件监听器数量
   * @param event 事件类型
   * @param namespace 命名空间
   */
  listenerCount(event?: EventType | string, namespace?: string): number {
    if (event) {
      const key = this.getEventKey(event, namespace);
      const listeners = this.listeners.get(key);
      return listeners ? listeners.length : 0;
    }
    
    if (namespace) {
      let count = 0;
      for (const listeners of this.listeners.values()) {
        count += listeners.filter((wrapper) => wrapper.namespace === namespace).length;
      }
      return count;
    }
    
    return this.listeners.size;
  }

  /**
   * 获取所有事件名称
   */
  eventNames(): string[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * 销毁事件总线
   */
  destroy(): void {
    this.removeAllListeners();
    this.recentEvents.clear();
  }


  /**
   * 获取事件键
   */
  private getEventKey(event: EventType | string, namespace?: string): string {
    const eventStr: string = typeof event === 'string' ? event : (event as string);
    return namespace ? `${namespace}:${eventStr}` : eventStr;
  }
}

// 创建全局事件总线实例
export const eventBus = new EventBus();
