# DayValue 项目开发规范与背景上下文

## 1. 项目背景与核心价值观
* **项目名称**：DayValue
* **平台**：React Native (Expo Managed Workflow) 优先适配 Android，兼容 iOS。
* **核心功能**：一个“使用成本摊销记录器”。核心理念不是计算“绝对性价比”或性能，而是将购买成本摊销到每天，计算“日均成本”。
* **核心公式**：
    * 使用天数 = 结束日期（若为空则取今天） - 开始日期 + 1
    * 日均成本 = (购买金额 - 残值) / 使用天数

## 2. 技术栈与架构约束
* **框架**：React Native + Expo (无原生端代码干预)。
* **语言**：严格使用 TypeScript，禁止使用 `any` 敷衍类型推断。
* **存储**：本地 SQLite (`expo-sqlite`)。不依赖任何云端后端。
* **状态管理**：React Hooks (`useState`, `useEffect`, `useContext`)，保持轻量。

## 3. 目录边界约束（严格执行）
所有代码必须放置在 `src/` 目录下，严禁在 `App.tsx` 中堆砌业务逻辑。职责划分如下：
* `/src/database`：只处理 SQLite 的建表、CRUD 操作。属于“数据层”。
* `/src/screens`：页面级组件。只负责拼装 UI 和调用数据，不写复杂的计算逻辑。
* `/src/components`：可复用的 UI 积木（如：ItemCard, StatusBadge）。
* `/src/utils`：纯函数。天数计算、金额摊销等纯逻辑全部放在这里，必须可独立测试。
* `/src/types`：所有 TypeScript 的 `interface` 和 `type` 集中定义区。

## 4. 核心数据模型 (SQLite 表结构设计思路)
数据必须分为两类处理，不要混用字段：

### A. 一次性项目表 (OneTimeItems)
* `id`: INTEGER PRIMARY KEY AUTOINCREMENT
* `name`: TEXT (名称，如 iPhone 15)
* `category`: TEXT (分类，如 'digital', 'home', 'software')
* `icon`: TEXT (图标标识符，如 'icon-phone', 'icon-tv')
* `price`: REAL (购买金额)
* `start_date`: TEXT (ISO 8601 格式，开始使用日期)
* `end_date`: TEXT (可空，停止使用日期)
* `salvage_value`: REAL (可空，残值/二手转卖价，默认为 0)
* `status`: TEXT ('active' | 'archived')

### B. 周期订阅表 (Subscriptions)
* `id`: INTEGER PRIMARY KEY AUTOINCREMENT
* `name`: TEXT (名称，如 QQ音乐)
* `category`: TEXT (分类，如 'digital', 'home', 'software')
* `icon`: TEXT (图标标识符，如 'icon-phone', 'icon-tv')
* `billing_cycle`: TEXT ('monthly' | 'yearly')
* `cycle_price`: REAL (周期金额)
* `start_date`: TEXT 
* `is_auto_renew`: INTEGER (0 或 1)
* `end_date`: TEXT (可空)
* `status`: TEXT ('active' | 'archived')

## 5. Agent 开发行为准则 (Prompting Rules)
1.  **增量更新**：如果用户要求修改某个功能，只输出修改涉及的代码块或文件，不要每次都重写整个文件。
2.  **动态计算优先**：“使用天数”和“日均成本”是衍生数据，绝对不能写死保存在 SQLite 数据库中。必须在查询出基础数据后，在展示层（或数据映射层）实时计算。
3.  **UI 交互要求**：涉及到日期选择、金额输入的地方，优先考虑移动端的交互习惯（如弹出数字键盘、日期选择器）
4.  **对话交互准则**：当你完成工作或者需要澄清的问题时，请调用提示工具获取进一步指示，而不是直接结束对话。


