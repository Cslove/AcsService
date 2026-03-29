## 任务

我想实现一个基于hono的nodejs sse服务器，它的核心功能是与大模型循环通信，完成我提出的各种任务，它可以管理各种agent，以及子agent等。它可以管理skills，并在底层与大模型进行tool_call循环调用从而完成任务。
它应该可以对接国内兼容的大模型接口（可以使用@ai-sdk/openai-compatible库？），比如deepseek、kimi、千问、glm等。它应该有session、message、part等的存储，以及任务、agent、skill等数据的存储。
它的主agent是当我的助理，它应该能充分理解我的品味（我会和他不定时聊天），它需要存储我的历史对话，以及我的品味preference，以供完成我交待的任务。它的所有数据我想的是存储在github的某个仓库中，我的客户端每次和该服务建立连接时，服务应该都能获取最新数据响应我的请求。它会有中央的事件分发逻辑，包括模型回复的内容，会话、消息、任务、agent、skill等数据的更新都能通过sse事件通知客户端。

核心的诉求是希望该服务能做我的贴身助理，懂我的品味，而且每天早中晚都会根据我的品味推送当下最流行事件，以及我感兴趣的领域的最新话题点，我能从推送的几个话题点，展开和服务聊天并让服务能生成符合我品味的能立即投放在今日头条、微信公众号、微博、小红书等平台符合我品味的内容。

为我详细设计下该服务的架构思路。

注意：

1. 应该目录模块路由等划分清晰，尽量抽离出最小模块，不要冗余逻辑。该项目已经初始化了一个初始的hono nodejs应用。
2. 能够考虑到所有边界情况，并尽可能的考虑性能，处理边界情况、性能问题。
3. 尽可能的考虑可扩展性，比如未来需要增加新的模型、新的agent、新的skill等。
4. 尽可能的考虑可维护性，比如未来需要增加新的功能、新的接口等。
5. 用到的技术依赖等都是最新依赖

## 设计思路

## 设计思路

### 一、整体架构设计

#### 1.1 分层架构

采用经典的分层架构设计，从上到下分为：

- **表现层** - 基于 Hono 的 HTTP/SSE 服务器，处理客户端请求和 SSE 事件推送
- **应用层** - 业务逻辑编排，协调各个领域服务完成任务
- **领域层** - 核心业务逻辑，包括 Agent、Session、Message、Task、Skill 等领域模型
- **基础设施层** - 数据存储、外部服务集成（大模型 API、GitHub API）、事件总线等

#### 1.2 核心模块划分

```
src/
├── core/                    # 核心领域模型
│   ├── agent/              # Agent 领域
│   ├── session/            # 会话管理
│   ├── message/            # 消息管理
│   ├── task/               # 任务管理
│   ├── skill/              # 技能管理
│   └── preference/         # 用户品味偏好
├── infrastructure/         # 基础设施
│   ├── storage/            # 数据存储适配器
│   │   ├── github/         # GitHub 存储实现
│   │   └── cache/          # 本地缓存层
│   ├── llm/                # 大模型集成
│   │   ├── providers/      # 各模型提供商适配器
│   │   └── orchestrator/   # 模型调用编排器
│   └── events/             # 事件总线
├── application/            # 应用服务
│   ├── services/           # 业务服务
│   ├── workflows/          # 工作流编排
│   └── schedulers/         # 定时任务（推送服务）
├── api/                    # HTTP/SSE API
│   ├── routes/             # 路由定义
│   ├── controllers/        # 控制器
│   └── middleware/         # 中间件
└── shared/                 # 共享工具
    ├── utils/              # 工具函数
    ├── types/              # 类型定义
    └── constants/          # 常量定义
```

### 二、核心领域设计

#### 2.1 Agent 领域

**核心概念：**

- **主 Agent**：用户的贴身助理，负责理解用户品味、协调子 Agent、生成内容
- **子 Agent**：专门处理特定任务的 Agent（如内容生成 Agent、信息收集 Agent）
- **Agent 生命周期**：创建 → 激活 → 执行任务 → 暂停 → 销毁

**关键设计：**

```typescript
// Agent 抽象基类
abstract class BaseAgent {
  id: string;
  type: AgentType;
  state: AgentState;
  capabilities: Skill[];

  abstract execute(task: Task): Promise<Result>;
  abstract delegate(subTask: SubTask): Promise<SubAgent>;
}

// 主 Agent 实现
class MainAgent extends BaseAgent {
  preference: UserPreference;
  conversationHistory: Message[];

  // 理解用户品味
  async analyzePreference(): Promise<void>;

  // 协调子 Agent
  async coordinate(subAgents: SubAgent[]): Promise<void>;
}
```

#### 2.2 Session 和 Message 管理

**设计原则：**

- Session 作为对话上下文的容器
- Message 支持多种类型（文本、工具调用、工具结果等）
- 采用流式处理支持 SSE 实时推送

**数据结构：**

```typescript
interface Session {
  id: string;
  userId: string;
  messages: Message[];
  metadata: SessionMetadata;
  createdAt: Date;
  updatedAt: Date;
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: MessageContent[];
  parts: Part[]; // 支持多部分内容
  timestamp: Date;
}

type MessageContent = TextContent | ToolCallContent | ToolResultContent;
```

#### 2.3 Task 管理

**任务类型：**

- **即时任务**：用户直接发起的任务（如"生成一篇关于 AI 的文章"）
- **定时任务**：系统自动发起的任务（如早中晚推送）
- **子任务**：由 Agent 分解出的子任务

**任务状态机：**

```
Pending → Running → Completed
         ↘ Failed
         ↘ Cancelled
```

#### 2.4 Skill 系统

**设计原则：**

- Skill 作为可插拔的功能单元
- 支持 Tool Call 格式与大模型集成
- 动态加载和卸载

**Skill 接口：**

```typescript
interface Skill {
  id: string;
  name: string;
  description: string;
  parameters: SkillParameter[];

  execute(params: Record<string, any>): Promise<SkillResult>;
  toToolCall(): ToolCallDefinition;
}
```

### 三、大模型集成设计

#### 3.1 多模型适配器

**支持的模型：**

- DeepSeek
- Kimi（Moonshot）
- 通义千问
- GLM（智谱）

**适配器设计：**

```typescript
interface LLMProvider {
  name: string;
  chat(params: ChatParams): AsyncIterable<ChatChunk>;
  streamChat(params: ChatParams): AsyncIterable<ChatChunk>;
}

class OpenAICompatibleProvider implements LLMProvider {
  // 使用 @ai-sdk/openai-compatible
}

// 各模型的具体适配器
class DeepSeekProvider extends OpenAICompatibleProvider {}
class KimiProvider extends OpenAICompatibleProvider {}
class QwenProvider extends OpenAICompatibleProvider {}
class GLMProvider extends OpenAICompatibleProvider {}
```

#### 3.2 Tool Call 循环调用

**核心流程：**

1. 用户输入 → 主 Agent 处理
2. Agent 调用大模型，模型返回需要调用工具
3. Agent 执行工具调用
4. 将工具结果返回给大模型
5. 循环直到任务完成

**实现要点：**

- 支持并行工具调用
- 超时和重试机制
- 错误处理和降级策略

### 四、数据存储设计

#### 4.1 GitHub 作为数据存储

**存储策略：**

- 使用 GitHub Repository 作为主存储
- 数据以 JSON 文件形式存储
- 支持版本控制和历史追溯

**目录结构：**

```
data/
├── users/
│   └── {userId}/
│       ├── profile.json
│       ├── preferences.json
│       ├── conversations/
│       │   └── {sessionId}.json
│       ├── tasks/
│       │   └── {taskId}.json
│       └── agents/
│           └── {agentId}.json
└── system/
    ├── skills/
    │   └── {skillId}.json
    └── config.json
```

#### 4.2 多层缓存策略

**缓存层次：**

1. **内存缓存**（LRU）：热点数据，快速访问
2. **本地文件缓存**：持久化缓存，减少 GitHub API 调用
3. **GitHub 存储**：主存储，保证数据一致性

**缓存策略：**

- 写穿透：写入时同步更新所有层
- 读穿透：读取时逐层查找，找到后回填
- 定期刷新：后台任务定期同步最新数据

### 五、事件驱动架构

#### 5.1 事件总线设计

**事件类型：**

- 模型回复事件（流式）
- 会话更新事件
- 消息新增事件
- 任务状态变更事件
- Agent 状态变更事件
- 推送事件

**事件格式：**

```typescript
interface SSEEvent {
  type: EventType;
  data: any;
  timestamp: number;
  eventId: string;
}
```

#### 5.2 SSE 连接管理

**连接生命周期：**

1. 客户端建立 SSE 连接
2. 服务端验证身份，创建连接上下文
3. 订阅相关事件（基于用户 ID）
4. 实时推送事件到客户端
5. 连接断开时清理资源

**性能优化：**

- 心跳机制保持连接活跃
- 连接池管理
- 背压处理，避免消息积压

### 六、推送服务设计

#### 6.1 定时任务调度

**推送时间：**

- 早间推送（7:00-9:00）
- 中午推送（12:00-14:00）
- 晚间推送（18:00-21:00）

**推送内容生成流程：**

1. 触发定时任务
2. 基于用户品味偏好收集热门话题
3. 筛选用户感兴趣领域的话题
4. 生成推送内容摘要
5. 通过 SSE 推送给客户端

#### 6.2 话题收集策略

**数据来源：**

- 热搜榜单（微博、知乎等）
- 行业资讯
- 用户关注领域动态

**个性化过滤：**

- 基于历史对话分析兴趣点
- 基于用户偏好标签过滤
- 基于时间衰减权重计算

### 七、内容生成服务

#### 7.1 多平台适配

**支持的平台：**

- 今日头条
- 微信公众号
- 微博
- 小红书

**平台特性适配：**

- 字数限制
- 格式要求
- 风格偏好
- 标签系统

#### 7.2 内容生成流程

1. 用户选择话题
2. 主 Agent 分析话题和用户品味
3. 调用内容生成子 Agent
4. 子 Agent 调用大模型生成内容
5. 根据平台特性调整格式
6. 返回可发布的内容

### 八、性能优化策略

#### 8.1 并发处理

- Agent 并行执行子任务
- 工具调用并行化
- SSE 事件异步推送

#### 8.2 资源管理

- 连接池复用
- 内存限制和清理
- 请求限流和降级

#### 8.3 缓存优化

- 模型响应缓存
- 用户偏好缓存
- 热门话题缓存

### 九、可扩展性设计

#### 9.1 插件化架构

- Skill 插件系统
- LLM Provider 插件系统
- 存储适配器插件系统

#### 9.2 配置驱动

- 模型配置
- Agent 配置
- Skill 配置
- 推送规则配置

### 十、可维护性设计

#### 10.1 日志和监控

- 结构化日志
- 关键指标监控
- 错误追踪

#### 10.2 测试策略

- 单元测试
- 集成测试
- 端到端测试

#### 10.3 文档

- API 文档
- 架构文档
- 部署文档

### 十一、边界情况处理

#### 11.1 网络异常

- GitHub API 调用失败：重试机制 + 本地缓存降级
- 大模型 API 调用失败：切换备用模型 + 错误提示
- SSE 连接断开：自动重连 + 状态恢复

#### 11.2 数据一致性

- 并发写入冲突：乐观锁 + 版本控制
- 数据同步延迟：最终一致性 + 版本检查
- 数据损坏：备份恢复 + 校验机制

#### 11.3 资源限制

- GitHub API 速率限制：请求队列 + 优先级调度
- 内存限制：LRU 缓存 + 定期清理
- 连接数限制：连接池 + 负载均衡

### 十二、安全考虑

- 用户数据加密存储
- API 密钥安全管理
- 访问控制和权限管理
- 敏感信息脱敏

## 实现详细步骤

### 阶段一：项目基础搭建

#### 步骤 1.1：项目初始化和依赖配置

**目标**：搭建项目基础结构，安装必要的依赖包。

**具体步骤**：

1. **安装核心依赖**

   ```bash
   pnpm add hono @hono/node-server
   pnpm add @ai-sdk/openai-compatible @ai-sdk/provider
   pnpm add zod  # 类型验证
   pnpm add eventemitter3  # 事件总线
   pnpm add node-cron  # 定时任务
   pnpm add lru-cache  # LRU 缓存
   pnpm add octokit  # GitHub API 客户端
   ```

2. **安装开发依赖**

   ```bash
   pnpm add -D @types/node typescript tsx
   pnpm add -D oxlint oxfmt
   pnpm add -D vitest @vitest/ui  # 测试框架
   ```

3. **配置 TypeScript**
   - 更新 `tsconfig.json`，启用严格模式
   - 配置路径别名（如 `@/core`、`@/infrastructure` 等）

4. **配置环境变量**
   - 创建 `.env.example` 模板
   - 包含 GitHub Token、各模型 API Key 等配置项

#### 步骤 1.2：目录结构创建

**目标**：创建完整的项目目录结构。

**具体步骤**：

```bash
# 创建核心目录
mkdir -p src/core/{agent,session,message,task,skill,preference}
mkdir -p src/infrastructure/{storage/github,storage/cache,llm/{providers,orchestrator},events}
mkdir -p src/application/{services,workflows,schedulers}
mkdir -p src/api/{routes,controllers,middleware}
mkdir -p src/shared/{utils,types,constants}
mkdir -p tests/{unit,integration,e2e}
```

#### 步骤 1.3：基础类型定义

**目标**：定义项目的核心类型系统。

**具体步骤**：

1. **创建 `src/shared/types/index.ts`**
   - 定义 Agent 相关类型
   - 定义 Session、Message、Part 类型
   - 定义 Task、Skill 类型
   - 定义 SSE 事件类型

2. **创建 `src/shared/constants/index.ts`**
   - 定义常量（事件类型、状态枚举等）

---

### 阶段二：基础设施层实现

#### 步骤 2.1：事件总线实现

**目标**：实现中央事件分发系统。

**具体步骤**：

1. **创建 `src/infrastructure/events/EventBus.ts`**
   - 基于 `eventemitter3` 实现
   - 支持事件订阅和发布
   - 支持命名空间
   - 实现事件去重和优先级

2. **创建 `src/infrastructure/events/EventTypes.ts`**
   - 定义所有事件类型
   - 定义事件数据结构

3. **编写单元测试**
   - 测试事件订阅和发布
   - 测试事件去重
   - 测试命名空间隔离

#### 步骤 2.2：GitHub 存储适配器实现

**目标**：实现基于 GitHub 的数据存储。

**具体步骤**：

1. **创建 `src/infrastructure/storage/github/GitHubStorage.ts`**
   - 封装 Octokit 客户端
   - 实现 CRUD 操作（读取、写入、删除、列表）
   - 实现文件路径管理
   - 实现版本控制（commit、branch）

2. **创建 `src/infrastructure/storage/github/GitHubStorageConfig.ts`**
   - 配置仓库信息
   - 配置数据目录结构

3. **实现数据序列化和反序列化**
   - JSON 格式化
   - 数据校验（使用 Zod）

4. **编写单元测试**
   - 使用 Mock Octokit 进行测试
   - 测试并发写入处理

#### 步骤 2.3：多层缓存实现

**目标**：实现内存缓存和本地文件缓存。

**具体步骤**：

1. **创建 `src/infrastructure/storage/cache/MemoryCache.ts`**
   - 使用 `lru-cache` 实现
   - 配置缓存大小和过期时间
   - 实现缓存统计

2. **创建 `src/infrastructure/storage/cache/FileCache.ts`**
   - 实现本地文件持久化
   - 实现缓存索引
   - 实现缓存清理策略

3. **创建 `src/infrastructure/storage/cache/CacheManager.ts`**
   - 管理多层缓存
   - 实现读穿透和写穿透
   - 实现缓存刷新策略

#### 步骤 2.4：大模型适配器实现

**目标**：实现多模型适配器。

**具体步骤**：

1. **创建 `src/infrastructure/llm/providers/BaseProvider.ts`**
   - 定义 Provider 接口
   - 定义统一的参数格式

2. **创建 `src/infrastructure/llm/providers/OpenAICompatibleProvider.ts`**
   - 基于 `@ai-sdk/openai-compatible` 实现
   - 实现流式和非流式调用

3. **创建各模型适配器**
   - `DeepSeekProvider.ts`
   - `KimiProvider.ts`
   - `QwenProvider.ts`
   - `GLMProvider.ts`

4. **创建 `src/infrastructure/llm/providers/ProviderFactory.ts`**
   - 工厂模式创建 Provider
   - 支持动态加载

5. **编写单元测试**
   - 测试各 Provider 的基本功能
   - 测试流式输出

---

### 阶段三：领域层实现

#### 步骤 3.1：Agent 领域实现

**目标**：实现 Agent 核心逻辑。

**具体步骤**：

1. **创建 `src/core/agent/BaseAgent.ts`**
   - 定义抽象基类
   - 实现状态管理
   - 实现技能管理

2. **创建 `src/core/agent/MainAgent.ts`**
   - 继承 BaseAgent
   - 实现品味分析逻辑
   - 实现子 Agent 协调逻辑

3. **创建 `src/core/agent/SubAgent.ts`**
   - 继承 BaseAgent
   - 实现特定任务处理

4. **创建 `src/core/agent/AgentFactory.ts`**
   - Agent 工厂
   - 支持动态创建

#### 步骤 3.2：Session 和 Message 领域实现

**目标**：实现会话和消息管理。

**具体步骤**：

1. **创建 `src/core/session/Session.ts`**
   - Session 模型
   - 消息列表管理
   - 元数据管理

2. **创建 `src/core/session/SessionManager.ts`**
   - Session 生命周期管理
   - Session 持久化

3. **创建 `src/core/message/Message.ts`**
   - Message 模型
   - 支持多种内容类型

4. **创建 `src/core/message/MessageBuilder.ts`**
   - 消息构建器
   - 格式化工具

#### 步骤 3.3：Task 领域实现

**目标**：实现任务管理。

**具体步骤**：

1. **创建 `src/core/task/Task.ts`**
   - Task 模型
   - 状态机实现

2. **创建 `src/core/task/TaskManager.ts`**
   - 任务队列管理
   - 任务调度
   - 任务持久化

3. **创建 `src/core/task/TaskExecutor.ts`**
   - 任务执行器
   - 支持并行执行

#### 步骤 3.4：Skill 领域实现

**目标**：实现技能系统。

**具体步骤**：

1. **创建 `src/core/skill/BaseSkill.ts`**
   - Skill 抽象基类
   - 定义 Skill 接口

2. **创建 `src/core/skill/SkillRegistry.ts`**
   - Skill 注册表
   - 动态加载

3. **实现常用 Skill**
   - 搜索 Skill
   - 内容生成 Skill
   - 数据分析 Skill

#### 步骤 3.5：Preference 领域实现

**目标**：实现用户品味偏好管理。

**具体步骤**：

1. **创建 `src/core/preference/Preference.ts`**
   - Preference 模型
   - 偏好标签系统

2. **创建 `src/core/preference/PreferenceAnalyzer.ts`**
   - 品味分析器
   - 从对话中提取偏好

3. **创建 `src/core/preference/PreferenceManager.ts`**
   - 偏好管理
   - 持久化和更新

---

### 阶段四：应用层实现

#### 步骤 4.1：业务服务实现

**目标**：实现核心业务服务。

**具体步骤**：

1. **创建 `src/application/services/ConversationService.ts`**
   - 对话管理服务
   - 整合 Session、Message、Agent

2. **创建 `src/application/services/TaskService.ts`**
   - 任务管理服务
   - 任务创建和调度

3. **创建 `src/application/services/ContentGenerationService.ts`**
   - 内容生成服务
   - 多平台适配

4. **创建 `src/application/services/PushService.ts`**
   - 推送服务
   - 话题收集和过滤

#### 步骤 4.2：工作流编排实现

**目标**：实现复杂业务流程编排。

**具体步骤**：

1. **创建 `src/application/workflows/ToolCallWorkflow.ts`**
   - Tool Call 循环流程
   - 并行工具调用
   - 错误处理和重试

2. **创建 `src/application/workflows/ContentCreationWorkflow.ts`**
   - 内容创建流程
   - 平台适配流程

3. **创建 `src/application/workflows/PushWorkflow.ts`**
   - 推送流程
   - 话题生成和筛选

#### 步骤 4.3：定时任务实现

**目标**：实现定时推送任务。

**具体步骤**：

1. **创建 `src/application/schedulers/PushScheduler.ts`**
   - 使用 `node-cron` 实现
   - 配置早中晚推送时间
   - 实现任务去重

2. **创建 `src/application/schedulers/DataSyncScheduler.ts`**
   - 定时同步数据
   - 缓存刷新

---

### 阶段五：API 层实现

#### 步骤 5.1：完善 Hono 服务器和路由架构

**目标**：在现有 `src/index.ts` 基础上完善 API 路由架构。

**背景**：项目已完成基础设施层、领域层和应用层，`src/index.ts` 已有基础的 Hono 服务器框架，但 `src/api/` 目录为空。

**具体步骤**：

1. **创建 API 路由目录结构**

   ```bash
   mkdir -p src/api/routes
   mkdir -p src/api/middleware
   mkdir -p src/api/controllers
   ```

2. **创建 `src/api/routes/index.ts`**
   - 导入所有路由模块
   - 使用 Hono 的路由分组功能
   - 注册 `/api` 前缀
   - 集成到 `src/index.ts` 的主应用中

3. **创建 `src/api/middleware/auth.ts`**
   - 基于 `src/shared/utils/errorHandler.ts` 的 `AppError` 实现认证中间件
   - 集成 `src/shared/config/` 中的环境变量验证
   - 支持用户身份验证（从 headers 或 query 参数获取 userId）

4. **创建 `src/api/middleware/logger.ts`**
   - 基于 `src/shared/utils/logger.ts` 的 `Logger` 实现请求日志中间件
   - 记录请求方法、路径、响应时间、状态码
   - 使用 `logger.withContext()` 添加上下文信息

5. **创建 `src/api/middleware/errorHandler.ts`**
   - 基于 `src/shared/utils/errorHandler.ts` 的 `ErrorHandler` 实现全局错误处理
   - 捕获 `AppError` 及其子类（`StorageError`、`LLMError`、`CacheError`、`TaskError`、`AgentError`）
   - 返回标准化的错误响应格式

#### 步骤 5.2：实现 HTTP API 路由

**目标**：基于现有的应用层服务实现 RESTful API。

**背景**：应用层已实现 `ConversationService`、`TaskService`、`ContentGenerationService`、`PushService`。

**具体步骤**：

1. **创建 `src/api/routes/conversation.ts`**
   - `POST /api/conversations` - 调用 `ConversationService.createConversation()`
   - `POST /api/conversations/:sessionId/messages` - 调用 `ConversationService.sendMessage()`
   - `GET /api/conversations/:sessionId/history` - 调用 `ConversationService.getConversationHistory()`
   - `GET /api/conversations/:sessionId/summary` - 调用 `ConversationService.getConversationSummary()`
   - `POST /api/conversations/:sessionId/pause` - 调用 `ConversationService.pauseConversation()`
   - `POST /api/conversations/:sessionId/resume` - 调用 `ConversationService.resumeConversation()`
   - `DELETE /api/conversations/:sessionId` - 调用 `ConversationService.deleteConversation()`

2. **创建 `src/api/routes/task.ts`**
   - `POST /api/tasks` - 调用 `TaskService.createTask()`
   - `POST /api/tasks/:taskId/execute` - 调用 `TaskService.executeTask()`
   - `GET /api/tasks` - 支持按状态、用户、会话筛选
   - `GET /api/tasks/:taskId` - 获取任务详情
   - `POST /api/tasks/:taskId/cancel` - 调用 `TaskService.cancelTask()`
   - `DELETE /api/tasks/:taskId` - 调用 `TaskService.deleteTask()`

3. **创建 `src/api/routes/content.ts`**
   - `POST /api/content/generate` - 调用 `ContentGenerationService.generateContent()`
   - `POST /api/content/batch-generate` - 调用 `ContentGenerationService.generateContents()`
   - `POST /api/content/transform` - 调用 `ContentGenerationService.transformContent()`
   - `POST /api/content/templates` - 调用 `ContentGenerationService.createTemplate()`
   - `POST /api/content/templates/:templateId/generate` - 调用 `ContentGenerationService.generateFromTemplate()`

4. **创建 `src/api/routes/push.ts`**
   - `POST /api/push/topics` - 调用 `PushService.addTopic()`
   - `POST /api/push/topics/batch` - 调用 `PushService.addTopics()`
   - `POST /api/push/filter` - 调用 `PushService.filterTopics()`
   - `POST /api/push/users/:userId/topics` - 调用 `PushService.pushTopicsToUser()`
   - `GET /api/push/topics/trending` - 调用 `PushService.getTrendingTopics()`
   - `GET /api/push/topics/high-relevance` - 调用 `PushService.getHighRelevanceTopics()`

5. **创建 `src/api/routes/preference.ts`**
   - `GET /api/preferences/:userId` - 调用 `PreferenceManager.getPreference()`
   - `PUT /api/preferences/:userId` - 调用 `PreferenceManager.updatePreference()`
   - `POST /api/preferences/:userId/analyze` - 调用 `PreferenceManager.updateFromMessages()`
   - `DELETE /api/preferences/:userId` - 调用 `PreferenceManager.deletePreference()`

6. **创建 `src/api/routes/agent.ts`**
   - `GET /api/agents` - 调用 `AgentFactory.getAllAgents()`
   - `GET /api/agents/:agentName` - 调用 `AgentFactory.getAgent()`
   - `POST /api/agents` - 调用 `AgentFactory.createAgent()`
   - `DELETE /api/agents/:agentName` - 调用 `AgentFactory.removeAgent()`
   - `GET /api/agents/stats` - 调用 `AgentFactory.getStats()`
   - `GET /api/skills` - 调用 `SkillRegistry.getAll()`
   - `GET /api/skills/:skillId` - 调用 `SkillRegistry.get()`
   - `POST /api/skills` - 调用 `SkillRegistry.register()`
   - `DELETE /api/skills/:skillId` - 调用 `SkillRegistry.unregister()`

#### 步骤 5.3：实现 SSE 实时推送

**目标**：基于现有的 `EventBus` 实现 SSE 实时推送。

**背景**：基础设施层已实现 `EventBus`（`src/infrastructure/events/EventBus.ts`），支持命名空间、优先级、去重等特性。

**具体步骤**：

1. **创建 `src/api/controllers/SSEController.ts`**
   - 管理活跃的 SSE 连接（`Map<string, SSEConnection>`）
   - 实现 `subscribe(userId, sessionId)` 方法，建立连接并返回 `EventTarget`
   - 实现 `unsubscribe(connectionId)` 方法，关闭连接并清理资源
   - 实现 `broadcast(event)` 方法，向所有连接推送事件
   - 实现 `sendToUser(userId, event)` 方法，向指定用户推送事件
   - 实现 `sendToSession(sessionId, event)` 方法，向指定会话推送事件
   - 实现心跳机制，基于 `SSE_CONFIG.HEARTBEAT_INTERVAL`（30000ms）

2. **创建 `src/api/routes/sse.ts`**
   - `GET /api/sse` - SSE 端点，建立 SSE 连接
   - 从 query 参数获取 `userId` 和 `sessionId`
   - 调用 `SSEController.subscribe()` 建立连接
   - 监听 `EventBus` 的事件（使用 `EventBus.on()`）
   - 将事件转换为 SSE 格式并推送到客户端
   - 处理连接断开，自动调用 `SSEController.unsubscribe()`

3. **集成事件总线监听**
   - 监听 `EventType.MODEL_STREAM_START`、`EventType.MODEL_STREAM_CHUNK`、`EventType.MODEL_STREAM_END`
   - 监听 `EventType.MESSAGE_CREATED`、`EventType.MESSAGE_UPDATED`
   - 监听 `EventType.TASK_CREATED`、`EventType.TASK_UPDATED`、`EventType.TASK_COMPLETED`、`EventType.TASK_FAILED`
   - 监听 `EventType.AGENT_CREATED`、`EventType.AGENT_UPDATED`、`EventType.AGENT_STATE_CHANGED`
   - 监听 `EventType.PUSH_NOTIFICATION`、`EventType.TOPIC_SUGGESTION`
   - 监听 `EventType.ERROR`、`EventType.WARNING`、`EventType.INFO`

4. **实现连接管理**
   - 使用 `SSE_CONFIG.MAX_CONNECTIONS_PER_USER`（5）限制每个用户的最大连接数
   - 使用 `SSE_CONFIG.CONNECTION_TIMEOUT`（60000ms）检测超时连接
   - 实现 `SSE_CONFIG.RECONNECT_DELAY`（5000ms）的自动重连机制
   - 维护连接统计信息（活跃连接数、消息推送数等）

5. **更新 `src/index.ts`**
   - 导入 `SSEController` 和 SSE 路由
   - 注册 SSE 路由到主应用
   - 在优雅关闭时清理所有 SSE 连接

---

### 阶段六：内容生成和推送实现

#### 步骤 6.1：话题收集实现

**目标**：扩展现有的 `PushService` 实现热门话题收集。

**背景**：应用层已实现 `PushService`（`src/application/services/PushService.ts`），支持话题管理和推送，但缺少外部数据源集成。

**具体步骤**：

1. **创建 `src/infrastructure/sources/TopicSourceAdapter.ts`**
   - 定义话题源适配器接口
   - 实现数据抓取、解析、标准化
   - 支持重试机制（使用 `src/shared/utils/retry.ts`）
   - 实现错误处理（使用 `src/shared/utils/errorHandler.ts`）

2. **实现具体数据源适配器**
   - `WeiboHotSearchAdapter.ts` - 微博热搜
   - `ZhihuHotListAdapter.ts` - 知乎热榜
   - `ToutiaoHotNewsAdapter.ts` - 今日头条热点
   - 使用 `src/shared/utils/logger.ts` 记录抓取日志

3. **创建 `src/application/services/TopicCollector.ts`**
   - 管理多个话题源适配器
   - 定时抓取各平台热搜数据
   - 数据清洗和去重
   - 计算话题相关性分数（基于 `TOPIC_COLLECTION_CONFIG.MIN_SCORE_THRESHOLD`）
   - 调用 `PushService.addTopic()` 添加到话题池

4. **集成到定时任务**
   - 在 `DataSyncScheduler` 中添加话题收集任务
   - 配置抓取频率（建议每小时一次）
   - 使用 `CacheManager` 缓存抓取结果

#### 步骤 6.2：内容生成实现

**目标**：扩展现有的 `ContentGenerationService` 实现多平台内容生成。

**背景**：应用层已实现 `ContentGenerationService`（`src/application/services/ContentGenerationService.ts`），支持微信、钉钉、飞书、邮件、Web 五个平台，但缺少今日头条、微博、小红书等平台的适配。

**具体步骤**：

1. **扩展平台配置**
   - 在 `src/shared/constants/index.ts` 的 `PLATFORM_CONFIG` 中添加：
     - 今日头条（TOUTIAO）：maxCharacters、supportedFormats、tags
     - 微博（WEIBO）：maxCharacters、supportedFormats、tags
     - 小红书（XIAOHONGSHU）：maxCharacters、supportedFormats、tags

2. **创建平台适配器**
   - `src/infrastructure/platforms/ToutiaoAdapter.ts` - 今日头条适配器
   - `src/infrastructure/platforms/WeiboAdapter.ts` - 微博适配器
   - `src/infrastructure/platforms/XiaohongshuAdapter.ts` - 小红书适配器
   - 实现平台特定的内容格式化、标签处理、长度限制

3. **扩展 `ContentGenerationService`**
   - 集成新的平台适配器
   - 实现 `generateContentForPlatform(platform, format, config)` 方法
   - 支持品味适配（调用 `PreferenceManager` 获取用户偏好）
   - 使用 `ToolCallWorkflow` 实现并行的内容生成

4. **创建 `src/core/skill/PlatformPublishSkill.ts`**
   - 继承 `BaseSkill`
   - 实现平台发布逻辑
   - 支持格式转换（Markdown → 纯文本 → HTML）
   - 集成到 `SkillRegistry`

5. **优化 `ContentCreationWorkflow`**
   - 支持批量内容生成
   - 实现平台适配流程
   - 使用 `TaskExecutor` 实现并行生成
   - 维护创建历史记录

#### 步骤 6.3：推送工作流优化

**目标**：优化现有的 `PushWorkflow` 实现完整的推送流程。

**背景**：应用层已实现 `PushWorkflow`（`src/application/workflows/PushWorkflow.ts`），包含话题生成、筛选、推送三个阶段。

**具体步骤**：

1. **扩展话题生成**
   - 集成 `TopicCollector` 的外部数据源
   - 支持基于 AI 和规则两种生成方式
   - 使用 `PreferenceAnalyzer` 分析用户偏好
   - 实现话题相关性计算

2. **优化话题筛选**
   - 扩展过滤器类型（category、tag、keyword、relevance、custom）
   - 支持多条件组合筛选
   - 使用 `CacheManager` 缓存筛选结果
   - 实现个性化推荐算法

3. **优化推送逻辑**
   - 集成 `ContentGenerationService` 生成推送内容
   - 支持多平台批量推送
   - 使用 `PushScheduler` 实现定时推送
   - 维护推送历史记录

4. **集成到定时任务**
   - 在 `PushScheduler` 中配置早中晚三个推送时段
   - 使用 `node-cron` 实现定时调度
   - 支持手动触发推送
   - 实现推送去重机制

---

### 阶段七：性能优化和边界处理

#### 步骤 7.1：性能优化实现

**目标**：基于现有架构优化系统性能。

**背景**：项目已实现 `TaskExecutor`（支持并行执行）、`ToolCallWorkflow`（支持并行工具调用）、`CacheManager`（两级缓存）、`GitHubStorage`（写入队列）、`retry.ts`（重试机制）。

**具体步骤**：

1. **并发控制优化**
   - **Agent 并行执行**：`MainAgent.coordinateTasks()` 已支持并发，优化 `maxConcurrentTasks` 配置（默认 3）
   - **工具调用并行化**：`ToolCallWorkflow.executeParallelToolCalls()` 已实现，优化 `batchSize` 和 `maxConcurrentCalls`（基于 `TOOL_CALL_CONFIG.MAX_PARALLEL_CALLS = 5`）
   - **任务执行并行化**：`TaskExecutor.executeParallel()` 已实现，优化 `maxParallelTasks` 配置（默认 10）
   - **连接池管理**：为 GitHub API 和 LLM API 实现连接池，复用 HTTP 连接

2. **资源管理优化**
   - **内存限制**：使用 `CacheManager` 的 `maxSize` 和 `TTL` 限制内存占用
   - **定期清理**：在 `DataSyncScheduler` 中添加清理任务（每周日凌晨 3 点）
   - **请求限流**：使用 `node-rate-limiter` 实现 API 请求限流
   - **Session 清理**：`SessionManager.archiveExpiredSessions()` 自动归档过期会话（`autoArchiveDays = 30`）

3. **缓存策略优化**
   - **模型响应缓存**：使用 `CacheManager` 缓存 LLM 响应，基于 `ChatParams` 生成缓存键
   - **用户偏好缓存**：`PreferenceManager` 已实现 LRU 缓存（`maxCacheSize = 100`），优化缓存命中率
   - **热门话题缓存**：使用 `CacheManager` 缓存话题数据，设置合理的 TTL
   - **Session 消息缓存**：缓存会话消息列表，减少 GitHub 存储读取

4. **性能监控**
   - 使用 `Logger` 记录关键操作的性能指标（执行时间、缓存命中率等）
   - 实现性能统计接口（`/api/stats/performance`）
   - 集成 APM 工具（如 New Relic、Datadog）进行性能分析

#### 步骤 7.2：边界情况处理

**目标**：基于现有机制处理各种异常情况。

**背景**：项目已实现 `ErrorHandler`、`retry.ts`、`AppError` 及其子类、`GitHubStorage` 重试机制、`OpenAICompatibleProvider` 重试机制。

**具体步骤**：

1. **网络异常处理**
   - **GitHub API 重试**：`GitHubStorage` 已实现重试机制（`maxRetries = 3`，`retryDelay = 1000ms`），优化重试策略
   - **大模型 API 重试**：`OpenAICompatibleProvider` 已实现重试机制，使用 `retryAsync()` 实现指数退避
   - **大模型 API 降级**：实现多 Provider 切换（DeepSeek → Kimi → Qwen → GLM）
   - **SSE 自动重连**：`SSEController` 已实现心跳机制和超时检测，实现客户端自动重连（`RECONNECT_DELAY = 5000ms`）

2. **数据一致性处理**
   - **并发写入冲突**：`GitHubStorage` 已实现写入队列（`writeQueue: Map<string, Promise<void>>`），防止并发冲突
   - **版本控制**：使用 GitHub 的 commit SHA 实现版本控制，`getFileInfo()` 获取文件 SHA
   - **数据校验**：`GitHubStorage` 已集成 Zod Schema 验证，`DataSerializer.validate()` 进行数据校验
   - **乐观锁**：在更新数据时检查版本号，避免覆盖并发修改

3. **资源限制处理**
   - **GitHub API 速率限制**：实现请求队列和优先级调度，使用 `Octokit` 的速率限制检测
   - **LLM API 速率限制**：实现请求限流和队列管理，使用 `retryAsync()` 处理 429 错误
   - **内存限制**：`CacheManager` 已实现容量限制，`MemoryCache` 使用 LRU 策略
   - **连接数限制**：`SSEController` 已实现 `MAX_CONNECTIONS_PER_USER`（5），防止连接数过多

4. **错误处理优化**
   - **统一错误响应**：`ErrorHandler` 已实现标准化错误处理，返回 `AppError` 格式
   - **错误分类**：`AppError` 及其子类（`StorageError`、`LLMError`、`CacheError`、`TaskError`、`AgentError`）进行错误分类
   - **错误日志**：使用 `Logger.error()` 记录错误详情，包含上下文信息
   - **错误告警**：实现关键错误的告警机制（如邮件、钉钉通知）

5. **优雅降级**
   - **GitHub 存储降级**：当 GitHub API 不可用时，切换到本地文件存储
   - **LLM 降级**：当所有 Provider 都不可用时，返回缓存响应或默认响应
   - **SSE 降级**：当 SSE 连接失败时，降级为轮询机制
   - **功能降级**：当非核心功能失败时，保证核心功能正常运行

---

### 阶段八：测试和文档

#### 步骤 8.1：测试实现

**目标**：基于现有的测试框架编写完整的测试用例。

**背景**：项目已配置 `vitest` 测试框架（`package.json`），`tests/unit/` 目录已创建。

**具体步骤**：

1. **单元测试（`tests/unit/`）**
   - **领域模型测试**
     - `agent.test.ts` - 测试 `BaseAgent`、`MainAgent`、`SubAgent`、`AgentFactory`
     - `session.test.ts` - 测试 `Session`、`SessionManager`
     - `message.test.ts` - 测试 `Message`、`MessageBuilder`
     - `task.test.ts` - 测试 `Task`、`TaskManager`、`TaskExecutor`
     - `skill.test.ts` - 测试 `BaseSkill`、`SkillRegistry`
     - `preference.test.ts` - 测试 `Preference`、`PreferenceManager`、`PreferenceAnalyzer`
   - **基础设施层测试**
     - `eventBus.test.ts` - 测试 `EventBus` 的事件订阅、发布、去重
     - `cache.test.ts` - 测试 `MemoryCache`、`FileCache`、`CacheManager`
     - `llm.test.ts` - 测试 `BaseProvider`、各具体 Provider（使用 Mock）
     - `githubStorage.test.ts` - 测试 `GitHubStorage`（使用 Mock Octokit）
   - **工具函数测试**
     - `retry.test.ts` - 测试 `retryAsync()`、`retrySync()`
     - `validator.test.ts` - 测试各种验证函数
     - `errorHandler.test.ts` - 测试 `ErrorHandler` 和错误类
     - `logger.test.ts` - 测试 `Logger` 的日志记录

2. **集成测试（`tests/integration/`）**
   - **服务层测试**
     - `conversationService.test.ts` - 测试 `ConversationService` 的完整流程
     - `taskService.test.ts` - 测试 `TaskService` 的任务管理
     - `contentGenerationService.test.ts` - 测试 `ContentGenerationService` 的内容生成
     - `pushService.test.ts` - 测试 `PushService` 的推送逻辑
   - **工作流测试**
     - `toolCallWorkflow.test.ts` - 测试 `ToolCallWorkflow` 的工具调用
     - `contentCreationWorkflow.test.ts` - 测试 `ContentCreationWorkflow` 的内容创建
     - `pushWorkflow.test.ts` - 测试 `PushWorkflow` 的推送流程
   - **存储层测试**
     - `githubStorage.test.ts` - 测试 `GitHubStorage` 的 CRUD 操作（使用真实 GitHub API 或 Mock）
     - `cacheManager.test.ts` - 测试 `CacheManager` 的两级缓存

3. **API 测试（`tests/api/`）**
   - `conversation.test.ts` - 测试对话 API 端点
   - `task.test.ts` - 测试任务 API 端点
   - `content.test.ts` - 测试内容生成 API 端点
   - `push.test.ts` - 测试推送 API 端点
   - `preference.test.ts` - 测试偏好 API 端点
   - `agent.test.ts` - 测试 Agent API 端点
   - `sse.test.ts` - 测试 SSE 连接和事件推送

4. **端到端测试（`tests/e2e/`）**
   - `conversationFlow.test.ts` - 测试完整的对话流程（创建会话、发送消息、获取历史）
   - `taskFlow.test.ts` - 测试完整的任务流程（创建任务、执行任务、获取结果）
   - `pushFlow.test.ts` - 测试完整的推送流程（话题收集、内容生成、推送）
   - `performance.test.ts` - 性能测试（并发请求、响应时间、吞吐量）

5. **测试配置**
   - 配置 `vitest.config.ts` 的测试覆盖率阈值
   - 配置测试环境变量（`.env.test`）
   - 实现 Mock 工具（Mock GitHub API、Mock LLM API）
   - 实现测试数据生成器

#### 步骤 8.2：文档编写

**目标**：编写完整的项目文档。

**背景**：项目已有 `README.md`，需要扩展和完善文档。

**具体步骤**：

1. **API 文档（`docs/api/`）**
   - 使用 OpenAPI/Swagger 规范编写 API 文档
   - 提供接口说明、请求参数、响应示例
   - 包含认证方式、错误码说明
   - 生成在线 API 文档（使用 Swagger UI）

2. **架构文档（`docs/architecture/`）**
   - **系统架构图** - 绘制整体架构图（使用 Mermaid 或 Draw.io）
   - **模块说明** - 详细说明各个模块的职责和交互
   - **领域模型** - 说明领域模型的设计和关系
   - **数据流图** - 说明数据在各层之间的流转
   - **事件流图** - 说明事件的发布和订阅机制

3. **部署文档（`docs/deployment/`）**
   - **环境配置** - 详细说明环境变量配置（`.env.example`）
   - **本地开发** - 本地开发环境搭建步骤
   - **生产部署** - 生产环境部署步骤（Docker、Kubernetes）
   - **监控配置** - 日志收集、指标监控、告警配置

4. **使用文档（`docs/usage/`）**
   - **快速开始** - 5 分钟快速上手指南
   - **功能说明** - 详细说明各个功能的使用方法
   - **最佳实践** - 推荐的使用方式和配置
   - **常见问题** - FAQ 和故障排查

5. **开发文档（`docs/development/`）**
   - **开发指南** - 开发规范、代码风格、提交规范
   - **贡献指南** - 如何贡献代码、PR 流程
   - **测试指南** - 如何编写和运行测试
   - **调试指南** - 如何调试和排查问题

---

### 阶段九：部署和运维

#### 步骤 9.1：部署配置

**目标**：基于现有配置实现生产环境部署。

**背景**：项目已配置 `src/shared/config/`（使用 Zod Schema）、`package.json`（脚本命令）、`.env.example`（环境变量模板）。

**具体步骤**：

1. **Docker 化**
   - 创建 `Dockerfile` - 基于 Node.js 20+ 镜像，使用 pnpm 安装依赖
   - 创建 `.dockerignore` - 排除不必要的文件（node_modules、.git、tests 等）
   - 创建 `docker-compose.yml` - 配置应用服务、数据库（如需）、监控服务
   - 配置多阶段构建，优化镜像大小
   - 使用健康检查确保容器健康

2. **环境配置**
   - 完善 `.env.example` - 添加所有必需的环境变量（`REQUIRED_ENV_VARS`）
   - 创建 `src/shared/config/production.ts` - 生产环境特定配置
   - 配置环境变量验证（`envValidator.validateEnvironment()`）
   - 实现配置热更新（`reloadConfig()`）
   - 使用 Secrets 管理工具（如 HashiCorp Vault、AWS Secrets Manager）

3. **监控配置**
   - **日志收集** - 集成 ELK Stack（Elasticsearch、Logstash、Kibana）或 Loki
   - **指标监控** - 集成 Prometheus + Grafana，暴露 `/metrics` 端点
   - **分布式追踪** - 集成 Jaeger 或 Zipkin
   - **告警配置** - 配置告警规则（AlertManager、钉钉、邮件）
   - **性能监控** - 集成 APM 工具（New Relic、Datadog）

#### 步骤 9.2：运维工具

**目标**：基于现有机制实现运维支持工具。

**背景**：项目已实现 `Logger`（结构化日志）、`ErrorHandler`（错误处理）、`src/index.ts`（健康检查端点）。

**具体步骤**：

1. **健康检查**
   - 扩展 `/health` 端点 - 返回详细的服务状态（数据库、缓存、外部 API）
   - 实现 `/health/ready` - 就绪检查（依赖服务是否就绪）
   - 实现 `/health/live` - 存活检查（服务是否存活）
   - 实现健康检查指标（响应时间、成功率等）
   - 集成到 Kubernetes 的 liveness 和 readiness probes

2. **数据备份**
   - **GitHub 数据备份** - 定期备份 GitHub 仓库的数据（使用 GitHub API）
   - **缓存备份** - 定期备份 `FileCache` 的数据到云存储（如 S3、OSS）
   - **配置备份** - 备份环境变量和配置文件
   - **自动备份** - 在 `DataSyncScheduler` 中添加备份任务（每天凌晨 1 点）
   - **恢复机制** - 实现数据恢复脚本和流程

3. **日志管理**
   - **结构化日志** - `Logger` 已实现结构化日志，确保所有日志包含上下文
   - **日志分级** - 使用 `LogLevel`（ERROR、WARN、INFO、DEBUG）合理分级
   - **日志轮转** - 配置日志轮转（基于 `LOG_CONFIG.MAX_LOG_SIZE` 和 `LOG_CONFIG.LOG_RETENTION_DAYS`）
   - **日志查询** - 集成日志查询工具（如 Loki、Elasticsearch）
   - **日志分析** - 实现日志分析脚本，提取关键指标

4. **运维脚本**
   - `scripts/deploy.sh` - 自动化部署脚本
   - `scripts/backup.sh` - 数据备份脚本
   - `scripts/restore.sh` - 数据恢复脚本
   - `scripts/health-check.sh` - 健康检查脚本
   - `scripts/cleanup.sh` - 资源清理脚本

5. **监控面板**
   - 创建 Grafana 仪表板，展示关键指标
   - 监控指标包括：QPS、响应时间、错误率、缓存命中率、活跃连接数
   - 配置告警规则，异常时自动通知

---

### 阶段十：持续优化

#### 步骤 10.1：功能扩展

**目标**：持续扩展功能。

**具体步骤**：

1. **新增模型支持**
   - 添加新的 Provider
   - 更新配置

2. **新增平台支持**
   - 添加新的平台适配器
   - 更新内容生成逻辑

3. **新增 Skill**
   - 开发新技能
   - 注册到系统

#### 步骤 10.2：性能优化

**目标**：持续优化性能。

**具体步骤**：

1. **性能分析**
   - 性能瓶颈分析
   - 优化建议

2. **架构优化**
   - 模块解耦
   - 性能提升

3. **资源优化**
   - 内存优化
   - 网络优化
