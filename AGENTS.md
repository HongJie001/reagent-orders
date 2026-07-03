# 科研试剂经销商订单管理系统 - 需求拆解文档

## 产品概述

- **产品类型**: 多人实时协作订单管理系统（中后台工具）
- **场景类型**: <scene_type>prototype-app</scene_type>
- **目标用户**: 科研试剂经销商团队（销售员、运营、仓管），无角色权限区分，全员共用同一系统
- **核心价值**: 提供 Excel 级体验的纯表格化订单管理，覆盖“销售填报→分批采购→到货核对→发货配送”全流程，支持多人实时协作无冲突、状态联动流转、智能产品记忆，实现科研试剂订单的高效闭环管理
- **界面语言**: 中文
- **主题偏好**: 浅色（简洁商务风格）
- **导航模式**: 路径导航
- **导航布局**: Sidebar（左侧可收缩导航栏 + 右侧主体表格工作区）

---

## 页面结构总览

> **说明**：此表为页面生成的唯一数据源，包含所有页面（一级+二级）

| 页面名称 | 文件名 | 路由 | 页面类型 | 入口来源 |
|---------|-------|------|---------|---------|
| 首页总览 | `DashboardPage.tsx` | `/` | 一级 | 导航 |
| 采购需求 | `ProcurementPage.tsx` | `/procurement` | 一级 | 导航 |
| 未到货产品 | `UnreceivedPage.tsx` | `/unreceived` | 一级 | 导航 |
| 快递发货需求 | `ShippingPage.tsx` | `/shipping` | 一级 | 导航 |

> **页面类型说明**：
> - **一级页面**：出现在导航中，用户可直接访问
> - 本系统无二级页面（详情/编辑均通过表格内双击编辑或行操作按钮完成，无需跳转独立页面）

---

## 页面布局建议

- **布局模式**: 左右分栏（全局 Sidebar + 右侧内容区）—— 用户明确要求“页面左右分隔：左侧导航功能栏、右侧主体表格工作区”
- **视觉重心**: 表格数据 —— 核心操作均在表格内完成（双击编辑、行操作按钮、批量粘贴），表格区域最大化展示
- **结果承载区**: 各模块表格即为结果承载区；总览模块为卡片式统计面板；初始态为空表格（含表头 + 空状态提示行）

---

## 导航配置

- **导航布局**: Sidebar（左侧可收缩/展开，支持悬浮按钮隐藏/显示）
- **导航项**（仅一级页面）:

| 导航文字 | 路由 | 图标(可选) |
|---------|------|-----------|
| 首页总览 | `/` | LayoutDashboard |
| 采购需求 | `/procurement` | ClipboardList |
| 未到货产品 | `/unreceived` | PackageSearch |
| 快递发货需求 | `/shipping` | Truck |

> **说明**：用户明确要求“其他功能预留开发位”，导航中可预留一个 disabled 的占位项（如“更多功能”），但不作为独立页面规划。

---

## 数据来源声明

| 数据/操作 | 来源类型 | 实现要求 | mock 兜底 |
|---|---|---|---|
| 采购需求订单数据（CRUD） | local-persist | localStorage key=`__app_reagent_orders`，存储订单数组；新增/修改/删除均持久化到 localStorage | 初始 5-8 条 mock 示例订单（含不同状态：待处理/已采购/已调拨/已到货/已发货），每条记录加 `source: 'mock'` 字段 |
| 产品记忆库（品牌+货号→产品名称+规格） | local-persist | localStorage key=`__app_reagent_product_memory`，存储产品映射记录；每次新增订单时自动更新记忆库 | 初始 5-8 条 mock 产品记录（覆盖常见科研试剂品牌如 Sigma、Thermo、Abcam 等） |
| 快递发货数据（CRUD） | local-persist | localStorage key=`__app_reagent_shipments`，存储发货记录数组；新增/修改/删除均持久化 | 初始 3-5 条 mock 发货示例 |
| 销售单截图（多图上传） | real-file | 浏览器 File API（`<input type="file" multiple accept="image/*">`），图片以 Data URL 存储在发货记录的 `screenshots` 字段中 | 无（真实文件上传，mock 示例中可为空数组或占位图 URL） |
| 随货文件（多格式多文件上传） | real-file | 浏览器 File API（`<input type="file" multiple>`），文件以 Data URL 存储在发货记录的 `attachments` 字段中 | 无（真实文件上传，mock 示例中可为空数组） |
| 物流轨迹信息展示 | demo-mock | 根据快递单号模拟物流轨迹（时间轴 + 状态节点），mock 数据在 `src/data/logistics.ts` 中定义 | ✅ 本身就是 mock（快递单号→模拟物流轨迹映射表） |
| 单选字段自定义选项（采购方式/订单形式/提醒发货员） | local-persist | localStorage key=`__app_reagent_custom_options`，存储用户自定义的选项列表；默认选项硬编码在常量中 | 默认选项：采购方式=[天河]、订单形式=[常规/线下/后补单]、提醒发货员=[天河宾/番禺荣] |

> **多人协作说明**：本阶段为纯前端 demo，多人协作通过 localStorage 模拟（同一浏览器多标签页通过 `storage` 事件同步）。真实多人协作需后端 WebSocket/CRDT 支持，不在当前 demo 范围内。localStorage 方案可保证同一浏览器多标签页数据不丢失、不覆盖。

---

## 功能列表

### 全局功能

- **页面目标**: 提供统一的导航框架和全局操作入口
- **功能点**:
  - **侧边栏收缩/展开**: 左侧导航栏支持自由收缩/展开，收缩时显示悬浮按钮可重新展开；收缩后右侧表格区域自动扩展占满全宽
  - **全屏编辑模式**: 右侧表格区域提供全屏编辑按钮，点击后表格进入全屏模式（浏览器 Fullscreen API），退出全屏恢复原始布局
  - **多人协作同步**: 通过 `window.addEventListener('storage', ...)` 监听 localStorage 变更，多标签页同时操作时自动同步数据，新增/修改不覆盖、不丢失

---

### 首页总览 (`/`)

- **页面目标**: 以卡片式可视化展示核心订单统计数据，让团队快速掌握整体业务状态
- **功能点**:
  - **统计卡片展示**: 展示 5 个核心统计指标卡片——待处理订单数、已采购订单数、已调拨订单数、未到货订单数、已发货订单数；数据实时从采购需求表和发货表聚合计算
  - **状态分布概览**: 以简洁的环形图或进度条展示各状态订单占比，辅助快速判断工作负载
  - **最近操作动态**: 展示最近 5 条订单状态变更记录（时间 + 订单摘要 + 状态变更），便于追溯

---

### 采购需求 (`/procurement`)

- **页面目标**: 提供 Excel 级体验的核心订单管理表格，支持销售员填报、运营分批操作采购/调拨，全字段可编辑、可拖拽、可批量粘贴
- **功能点**:
  - **Excel 级表格交互**:
    - **字段顺序固定**: 采购日期 → 采购方式 → 状态 → 订单形式 → 客户 → 品牌 → 货号 → 产品名称 → 规格 → 目录价 → 数量 → 单价 → 总价 → 备注（不可修改顺序）
    - **新增行默认值**: 新增行自动填充采购方式=【天河】、状态=【待处理】、订单形式=【常规】
    - **新增行向下追加**: 新增行始终追加到表格末尾，不向上堆叠
    - **双击编辑**: 所有单元格支持双击进入编辑模式，实时修改数据
    - **列宽拖拽调整**: 所有列宽支持鼠标拖拽自由调整，光标变为 `col-resize`，拖拽生效
    - **横向滚动**: 表格高度自适应内容，保留横向滚动条，无下限高度
    - **文字居中加粗**: 所有字段文字居中显示、加粗，规整美观
    - **长文本自动换行**: 所有字段（备注、产品名称、地址等）统一自动换行、自动适配宽度，杜绝溢出
    - **固定表头 + 固定操作列**: 纵向滚动时表头固定，横向滚动时操作列固定，无穿透、无重叠、无错乱
  - **Excel 批量粘贴**:
    - 支持从 Excel 整行/整列复制粘贴，自动按分隔符（Tab/换行）分列填入对应单元格，不扎堆、不合并
  - **行操作按钮**（每行尾部固定操作列）:
    - **已采购**: 点击后将状态变更为“已采购”，按钮不消失，可反复点击切换状态
    - **已调拨**: 点击后将状态变更为“已调拨”，按钮不消失，可反复点击切换状态
    - **删除**: 点击后删除该行订单（需确认弹窗）
    - ❌ 无复制按钮（已彻底移除）
  - **状态色彩区分**:
    - 状态列根据值显示不同颜色高亮：待处理（灰色/默认）、已采购（蓝色）、已调拨（橙色）、已到货（绿色）、已发货（紫色）
  - **单选字段自定义选项**:
    - 采购方式、订单形式字段支持用户自定义新增选项、修改现有选项；选项数据持久化到 localStorage
  - **智能产品记忆**:
    - 输入【品牌+货号】后，自动从产品记忆库匹配并回填对应产品名称、规格
    - 输入货号时弹出联想选择弹窗，展示历史同款产品列表，用户可选择复用
    - 每次新增订单时，自动将品牌+货号→产品名称+规格的映射存入产品记忆库，长期复用

---

### 未到货产品 (`/unreceived`)

- **页面目标**: 自动筛选采购需求中“已采购/已调拨”但未到货的订单，供仓管核对到货并操作入库
- **功能点**:
  - **自动筛选展示**: 从采购需求表中自动筛选状态=“已采购”或“已调拨”的数据；状态=“已到货”的数据自动隐藏不展示
  - **字段展示**: 采购日期、状态、品牌、货号、产品名称、规格、数量、备注（只读展示，不可编辑）
  - **已到货操作**: 每行尾部提供【已到货】按钮，点击后该条数据从本模块消失（状态变更为“已到货”），同步更新主采购需求表状态
  - **实时双向联动**: 与采购需求表实时同步——主表状态变更（如运营操作“已采购”）后本模块自动新增显示；本模块操作“已到货”后主表状态同步更新

---

### 快递发货需求 (`/shipping`)

- **页面目标**: 管理发货流程，支持上传销售单据、填写快递信息、追踪物流，完成发货归档
- **功能点**:
  - **发货记录表格**: 支持直接新增行、双击修改所有字段；新增行向下追加
  - **字段列表**:
    - 销售单截图（多图上传）：支持同时选择多张图片，预览已上传图片，可删除单张
    - 随货文件（多格式多文件上传）：支持批量上传多格式文件，预览文件名，可删除单个文件
    - 收货地址：文本字段，自动换行适配长内容
    - 提醒发货员：单选字段，默认选项【天河宾/番禺荣】，支持自定义新增/修改选项
    - 快递单号：文本输入，手动填写
    - 物流信息展示：根据快递单号自动展示模拟物流轨迹（时间轴 + 状态节点）
  - **已发货操作**: 每行尾部提供【已发货】按钮，点击后标记发货完成，状态同步更新总览统计
  - **长文本优化**: 所有文本字段（收货地址、备注等）自动换行、防溢出

---

## 数据共享配置

| 存储键名 | 数据说明 | 使用页面 |
|---------|---------|---------|
| `__app_reagent_orders` | 采购需求订单列表，类型为 `IOrder[]` | 首页总览、采购需求、未到货产品 |
| `__app_reagent_product_memory` | 产品记忆库（品牌+货号→产品名称+规格映射），类型为 `IProductMemory[]` | 采购需求 |
| `__app_reagent_shipments` | 快递发货记录列表，类型为 `IShipment[]` | 首页总览、快递发货需求 |
| `__app_reagent_custom_options` | 自定义选项配置（采购方式/订单形式/提醒发货员），类型为 `ICustomOptions` | 采购需求、快递发货需求 |

```ts
interface IOrder {
  id: string;
  procurementDate: string;        // 采购日期 (YYYY-MM-DD)
  procurementMethod: string;      // 采购方式（默认"天河"，可自定义）
  status: '待处理' | '已采购' | '已调拨' | '已到货' | '已发货';
  orderForm: '常规' | '线下' | '后补单';  // 订单形式
  customer: string;               // 客户
  brand: string;                  // 品牌
  catalogNumber: string;          // 货号
  productName: string;            // 产品名称
  specification: string;          // 规格
  listPrice: number;              // 目录价
  quantity: number;               // 数量
  unitPrice: number;              // 单价
  totalPrice: number;             // 总价
  remarks: string;                // 备注
  createdAt: string;              // 创建时间 (ISO string)
  updatedAt: string;              // 最后更新时间 (ISO string)
  source?: 'mock' | 'user';       // 数据来源标记
}

interface IProductMemory {
  brand: string;                  // 品牌
  catalogNumber: string;          // 货号
  productName: string;            // 产品名称
  specification: string;          // 规格
  lastUsedAt: string;             // 最后使用时间 (ISO string)
  useCount: number;               // 使用次数
}

interface IShipment {
  id: string;
  screenshots: string[];          // 销售单截图（Data URL 数组）
  attachments: string[];          // 随货文件（Data URL 数组，含文件名信息）
  deliveryAddress: string;        // 收货地址
  remindCourier: string;          // 提醒发货员（默认"天河宾/番禺荣"，可自定义）
  trackingNumber: string;         // 快递单号
  logisticsInfo: ILogisticsNode[]; // 物流轨迹（mock 数据）
  status: '待发货' | '已发货';
  createdAt: string;
  updatedAt: string;
  source?: 'mock' | 'user';
}

interface ILogisticsNode {
  time: string;                   // 时间 (YYYY-MM-DD HH:mm)
  status: string;                 // 状态描述
  location?: string;              // 地点
}

interface ICustomOptions {
  procurementMethods: string[];   // 采购方式选项列表
  orderForms: string[];           // 订单形式选项列表
  remindCouriers: string[];       // 提醒发货员选项列表
}

-------

<scene_type>prototype-app</scene_type>

# UI 设计指南

## 1. 设计推导依据

- **参考意图**: Free Direction —— 无参考材料，从科研试剂经销的业务语义与 Excel 级工具场景自主建立视觉方向。
- **核心情绪 / 应用类型**: 科研试剂经销的精密秩序感——实验室器皿的洁净、试剂瓶标签的规整、冷链物流的可靠。
- **独特记忆点**: 试剂瓶标签式状态色标——每个订单状态用实验室标签色编码，表格行像一排排试剂瓶，扫描即知进度。

## 2. Art Direction

- **方向名**: Lab Precision
- **Design Style**: Swiss Minimalist 瑞士极简 + 实验室仪器美学 —— 高密度数据表格需要极致的清晰度与层级控制；实验室器皿的洁净玻璃、试剂标签、不锈钢台面提供材质锚点。
- **DNA 参数**: 圆角 sharp（表格区 rounded-none，卡片区 rounded-sm）/ 阴影 subtle（仅卡片统计区使用 shadow-sm）/ 间距 compact（表格单元格紧凑，导航与内容区间距标准）/ 字体方向 等宽数字 + 清晰无衬线 / 装饰手法 状态色标条 + 细线分隔。
- **应用类型**: Tool —— 左右分栏，表格最大化，全屏编辑，纯效率导向。

## 3. Color System

**色彩关系**: 冷灰白实验台基底 + 深蓝灰文字 + 试剂标签色系状态标识（琥珀待处理、冰蓝已采购、深绿已到货、石墨已发货）。
**配色设计理由**: bg 取实验室白大褂与洁净台面的冷白，降低长时间表格作业的眼疲劳；primary 用试剂瓶常见的深蓝，传递专业与精确；状态色从实验室标签色取材，每种状态独立可辨，不依赖单一色相。
**主色推导**: 科研试剂行业常用深蓝标识品牌与安全等级，深蓝在白色表格底上对比度优异，适合主按钮、选中行、当前导航。
**使用比例**: 60% 中性（冷白底 + 浅灰卡片 + 深灰文字）/ 30% 辅助（浅蓝灰 hover 底 + 细线分隔）/ 10% primary（主按钮、激活态、品牌锚点）。

| 角色 | CSS 变量 | Tailwind Class | HSL 值 | 设计说明 |
|---|---|---|---|---|
| bg | `--background` | `bg-background` | hsl(210 20% 98%) | 冷白实验台基底，微偏蓝模拟洁净室光照 |
| card | `--card` | `bg-card` | hsl(0 0% 100%) | 纯白卡片，与 bg 形成微弱层次 |
| text | `--foreground` | `text-foreground` | hsl(215 25% 18%) | 深蓝灰正文，表格密集阅读不刺眼 |
| textMuted | `--muted-foreground` | `text-muted-foreground` | hsl(215 10% 48%) | 占位符、列头辅助信息、页脚 |
| primary | `--primary` | `bg-primary` / `text-primary` | hsl(212 65% 38%) | 试剂瓶深蓝，主按钮、选中行、当前导航 |
| primaryForeground | `--primary-foreground` | `text-primary-foreground` | hsl(0 0% 100%) | primary 上的白色文字与图标 |
| accent | `--accent` | `bg-accent` | hsl(210 25% 94%) | 浅蓝灰 hover/focus 底、选中浅底、Skeleton |
| accentForeground | `--accent-foreground` | `text-accent-foreground` | hsl(212 30% 32%) | accent 上的深蓝文字，权重低于 primary |
| border | `--border` | `border-border` | hsl(214 15% 86%) | 表格线、输入框边界、卡片分隔 |

**语义色提示**:
- **待处理** (琥珀标签): bg `hsl(38 92% 94%)` / border `hsl(38 70% 62%)` / text `hsl(35 80% 28%)` — 暖色提醒行动，饱和度与 primary 对齐
- **已采购** (冰蓝标签): bg `hsl(200 70% 93%)` / border `hsl(200 60% 58%)` / text `hsl(202 65% 30%)` — 冷色表示已流转，与 primary 同色系浅化
- **已调拨** (淡紫标签): bg `hsl(260 50% 94%)` / border `hsl(260 40% 64%)` / text `hsl(262 45% 34%)` — 区分采购与调拨两条路径
- **已到货** (深绿标签): bg `hsl(155 55% 92%)` / border `hsl(155 50% 48%)` / text `hsl(158 60% 26%)` — 绿色表示入库完成，饱和度与 primary 对齐
- **已发货** (石墨标签): bg `hsl(215 12% 90%)` / border `hsl(215 10% 52%)` / text `hsl(216 14% 28%)` — 中性灰表示归档终态
- **成功**: bg `hsl(150 50% 93%)` / border `hsl(150 45% 50%)` / text `hsl(152 55% 28%)`
- **警告**: bg `hsl(42 85% 93%)` / border `hsl(40 75% 55%)` / text `hsl(38 78% 30%)`
- **错误**: bg `hsl(0 65% 94%)` / border `hsl(0 60% 54%)` / text `hsl(0 62% 32%)`

## 4. 字体与节奏

- **font-display**: Inter —— 数字等宽、字形清晰，适合表格密集数据；中文回退 Noto Sans SC。
- **font-body**: Inter + Noto Sans SC —— 表格内数字对齐、长文本可读、中英文混排和谐。
- **字号**: H1 text-2xl（模块标题）；表格内容 text-sm（高密度）；卡片统计数字 text-3xl；状态标签 text-xs。
- **圆角**: 表格区 sharp（rounded-none），卡片与按钮 subtle（rounded-sm），状态标签 pill（rounded-full）。

## 5. 全局布局契约

- **Reference Layout Use**: 按需求结构推导——左侧可收缩导航 + 右侧表格工作区，无参考图约束。
- **Page / Section Order**: 首页总览 → 采购需求 → 未到货产品 → 快递发货需求，与需求文档模块顺序 1:1 对齐。
- **Standard Content Zone**: 右侧工作区 `max-w-full`（表格最大化，不做内容区宽度限制），左侧导航固定宽 220px 收缩至 56px。
- **Shell / Frame Alignment**: 左侧导航与右侧工作区独立滚动，表格区横向溢出独立滚动条，纵向跟随页面。
- **Padding & Rhythm**: 表格单元格 `px-3 py-2`；卡片区 `p-4 gap-4`；模块标题区 `px-6 py-4`。
- **Full-bleed Zones**: 表格区全宽，横向滚动条贴底；全屏编辑模式覆盖整个视口，工具栏悬浮。
- **Local Narrowing**: 总览统计卡片使用 `max-w-[1400px] mx-auto` 居中；快递发货表单在表格内自然宽度。
- **Overflow Strategy**: 采购需求表 `overflow-x-auto`，固定表头 `sticky top-0`，固定操作列 `sticky right-0`，纵向滚动与页面隔离。
- **Flexibility Boundary**: 允许移动端卡片堆叠和单元格最小宽度调整；不允许改变状态色标、圆角系统、主色或表格固定列逻辑。

## 6. 视觉与动效

- **装饰**: 状态色标条（每行左侧 3px 竖线指示状态）+ 细线网格。
- **阴影/边界**: 无阴影（表格区）/ 轻阴影（统计卡片 shadow-sm）/ 细线分隔（border 用于表格网格和卡片边界）。
- **动效**: 克制 —— hover 行背景 150ms 过渡到 accent；状态切换时色标条颜色渐变 200ms；全屏编辑展开/收起 200ms ease-out；拖拽列宽时实时跟随无动画。

## 7. 组件原则

- 按钮、表单、菜单、卡片必须有 Default / Hover / Active / Focus / Disabled 状态。
- Primary 按钮（深蓝填充）用于主行动：新增行、保存、确认；Secondary 用 border + 透明底；Ghost 操作用 accent hover。
- 状态操作按钮（已采购/已调拨/已到货/已发货）使用对应语义色的 outline 样式，点击后变为填充样式，可反复切换。
- 表格行 hover 使用 accent 浅底；选中行使用 primary 10% 透明度底 + primary 左边框 3px。
- 空状态：居中插画 + "暂无数据" 使用 textMuted，不退回默认灰色占位。
- 加载：Skeleton 使用 accent 底色 + 脉冲动画，表格骨架保持列宽占位。

## 8. Image Direction

- **Image Role**: 无强制图片需求，优先通过排版、色彩和局部图形建立视觉记忆点。快递发货模块的销售单截图上传为业务图片，非设计素材。
- **Image Art Direction**: 无
- **Image Prompt Keywords**: 无
- **Image Avoidance**: 无

## 9. Anti-patterns

- **Excel clone trap**: 把表格做成绿色网格线 + 灰底白单元格的 Excel 视觉复刻；本产品是 Web 工具，用细线分隔 + 冷白底 + 状态色标建立自己的识别。
- **Status rainbow**: 状态色饱和度过高、色相跳跃，表格变成调色盘；语义色饱和度与 primary 对齐，色相在蓝-绿-琥珀窄区间内变化。
- **Sticky chaos**: 固定表头和固定操作列使用多个 sticky 层级导致重叠；表头 z-20、操作列 z-10、普通单元格 z-0，滚动容器隔离。
- **Full-screen neglect**: 全屏编辑模式下仍显示左侧导航和顶部 chrome；全屏应覆盖整个视口，仅保留表格工具栏和退出按钮。
- **Default SaaS drift**: 回到通用蓝按钮、紫色渐变卡片、圆角过大的软 UI；保持 sharp 表格 + subtle 卡片的 Lab Precision 语言。
- **Mono-hue tyranny**: 深蓝铺满主按钮、导航选中、链接、图标、状态标签；primary 只用于主行动和品牌锚点，状态色独立，导航选中使用 accent 深色文字 + 左侧 primary 细条。