# Mermaid 可视化编辑器

将图片通过 AI 转换为 Mermaid 图表代码，并提供可视化编辑、实时预览的一体化工具。

## 功能

- **图片导入**：上传 PNG/JPEG 图片，AI (Claude) 自动识别并生成 Mermaid 代码
- **模板库**：内置多种模板（通用示例 + 车载 AUTOSAR 场景）
- **收藏夹**：保存常用图表，支持加载、重命名、删除，数据持久化到 localStorage
- **代码编辑**：实时编辑 Mermaid 代码，支持同步至画布
- **可视化编辑**：基于 Dagre 布局的交互式画布编辑
  - 拖拽移动节点
  - 点击连接点创建连线
  - 双击编辑节点标签
  - 右键菜单：删除节点/边、编辑属性
- **画布操作**：鼠标滚轮缩放、中键/右键拖拽平移
- **图表设置**：布局方向、主题、外观、曲线样式、背景网格
- **专用编辑器**：饼图、XY 图表、时序图各有独立的可视化编辑界面
- **导出功能**：支持导出 PNG 和 SVG 格式

## 页面布局

```
┌──────────┬──────────────┬──────────────┬──────────────┬──────────┐
│          │              │              │              │          │
│ 左侧面板  │  Mermaid     │  渲染区       │  画布区       │  右侧    │
│ (📷图片   │  代码编辑器   │  (只读预览)   │  (可视化编辑) │  面板    │
│  📋模板   │              │              │              │ (设置    │
│  ⭐收藏)  │              │              │              │  形状)   │
│          │              │              │              │          │
└──────────┴──────────────┴──────────────┴──────────────┴──────────┘
```

**三栏说明**：
- **Mermaid 代码**：编辑 Mermaid 代码，点击"同步至画布"加载到编辑器
- **渲染区**：只读预览，显示 Mermaid 原生渲染结果，支持导出 PNG/SVG
- **画布区**：可交互编辑，拖拽节点、创建连线，点击"同步到代码"更新代码

## 支持的图表类型

| 类型 | 代码编辑 | 渲染预览 | 可视化编辑 |
|------|---------|---------|-----------|
| 流程图 (flowchart) | ✅ | ✅ | ✅ Dagre 布局 + 交互编辑 |
| 类图 (classDiagram) | ✅ | ✅ | ✅ Dagre 布局 + 交互编辑 |
| 状态图 (stateDiagram) | ✅ | ✅ | ✅ Dagre 布局 + 交互编辑 |
| 饼图 (pie) | ✅ | ✅ | ✅ 专用编辑器 |
| XY 图表 (xychart) | ✅ | ✅ | ✅ 专用编辑器 |
| 时序图 (sequence) | ✅ | ✅ | ✅ 专用编辑器 |
| 其他 Mermaid 类型 | ✅ | ✅ | ❌ |

## 快速开始

### 环境要求

- Node.js 16.x 或更高版本
- npm 包管理器

### 安装与运行

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（图片转 Mermaid 功能需要）
cp .env.example .env.local
# 编辑 .env.local，填入 Anthropic API Key：
# ANTHROPIC_API_KEY=sk-ant-xxx
# ANTHROPIC_BASE_URL=https://api.anthropic.com  (可选，自定义 API 地址)

# 3. 启动开发服务器
npm run dev
# 访问 http://localhost:3333
```

### Windows 一键启动

双击 `start.bat`，脚本会自动：

1. 检查 Node.js 是否已安装
2. 首次运行时自动安装依赖
3. 打开浏览器访问 `http://localhost:3333`
4. 启动 Next.js 开发服务器

### 构建生产版本

```bash
npm run build
npm start
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS + Neumorphism |
| 状态管理 | Zustand |
| 图表渲染 | Mermaid.js 11 |
| 可视化编辑 | SVG 直接编辑（原生 SVG 交互） |
| 图标库 | lucide-react |
| AI 转换 | Anthropic Claude (图片→Mermaid) |
| 压缩 | pako (导出链接压缩) |

## 架构设计

### Dagre 布局 + 交互编辑方案

本项目采用 **Dagre 自动布局 + 交互式编辑** 架构，提供专业的图形编辑体验。

**核心思路**：
1. 使用 Dagre 算法进行初始节点布局
2. 用户可拖拽节点、创建连线、编辑属性
3. 通过"同步到代码"按钮将编辑结果序列化为 Mermaid 代码
4. 渲染区和画布区分离，互不干扰

**数据流**：

```
Mermaid 代码 → Parser → Dagre 布局 → 画布状态 → 用户编辑 → Serializer → Mermaid 代码
```

### 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 状态管理 | `lib/graphEditorStore.ts` | 节点、边、连接状态、选中状态 |
| 代码解析 | `lib/graphParser.ts` | 解析 Mermaid 代码为图结构 |
| 布局计算 | `lib/graphLayout.ts` | Dagre 自动布局算法 |
| 代码序列化 | `lib/graphSerializer.ts` | 图结构序列化为 Mermaid 代码 |
| 导入导出 | `lib/graphImporter.ts` | 代码/JSON 导入逻辑 |
| 画布容器 | `GraphCanvas/GraphCanvas.tsx` | 渲染画布 + 平移缩放 |
| 节点组件 | `GraphCanvas/GraphNode.tsx` | 可拖拽节点 + 连接点 |
| 边组件 | `GraphCanvas/GraphEdge.tsx` | 自绘制边路径 |
| 预览组件 | `MermaidPreview.tsx` | 只读渲染 + 导出功能 |

## 项目结构

```
app/
  page.tsx                  # 入口页面（动态加载 EditorApp）
  layout.tsx                # 根布局
  globals.css               # 全局样式
  api/convert/route.ts      # AI 图片转 Mermaid API

components/
  EditorApp.tsx             # 主应用组件（布局 + 面板 + 画布）
  editor/
    SvgCanvas/              # SVG 画布组件
      SvgCanvas.tsx         # 核心画布容器
      SvgZoomControls.tsx   # 缩放和撤销控件
      SvgNodeEditor.tsx     # 节点标签编辑浮层
      SvgContextMenu.tsx    # 右键菜单
    CodeEditor.tsx          # Mermaid 代码编辑器
    LeftPanel.tsx           # 左侧模板/收藏面板
    ShapeIcons.tsx          # 形状图标与分类数据
    CommandPalette.tsx      # 命令面板 (Ctrl+K)
    ImportModal.tsx         # 图片导入弹窗
    PieEditor.tsx           # 饼图专用编辑器
    XyChartEditor.tsx       # XY 图表专用编辑器
    SequenceEditor.tsx      # 时序图专用编辑器
    Inspector/
      ObjectSettingsSection.tsx  # 节点/边属性编辑

lib/
  svgEditorStore.ts         # Zustand 状态管理（选中、视图、偏移、撤销）
  svgElementMapper.ts       # SVG 元素 ↔ Mermaid 节点 ID 映射
  mermaidCodeEditor.ts      # Mermaid 代码文本增删改函数
  parser.ts                 # 流程图解析器（含 subgraph）
  serializer.ts             # 流程图序列化器
  classParser.ts            # 类图解析器
  stateParser.ts            # 状态图解析器
  pieParser.ts              # 饼图解析/序列化
  xyChartParser.ts          # XY 图表解析/序列化
  templates.ts              # 模板数据
  favorites.ts              # 收藏夹管理（localStorage 持久化）
  utils.ts                  # 工具函数

store/
  useStore.ts               # 全局状态（图片、Mermaid 代码）

start.bat                   # Windows 一键启动脚本
```

## 使用指南

### 基本工作流

1. **从代码开始**：
   - 在左侧面板选择模板或收藏，或直接在代码编辑器输入 Mermaid 代码
   - 点击"同步至画布"按钮，代码会加载到画布区进行可视化编辑

2. **可视化编辑**：
   - 在画布区拖拽节点调整位置
   - 点击节点边缘的蓝色圆点，然后点击目标节点创建连线
   - 双击节点编辑标签
   - 右键节点打开菜单进行删除等操作

3. **同步回代码**：
   - 点击画布区的"同步到代码"按钮，将编辑结果更新到代码编辑器
   - 渲染区会自动显示最新的渲染效果

4. **导出图表**：
   - 在渲染区点击"导出 PNG"或"导出 SVG"按钮保存图表

### 三栏布局说明

- **代码编辑器**：Mermaid 代码的主要编辑区，支持手动编辑和模板加载
- **渲染区**：只读预览区，显示 Mermaid 原生渲染的最终效果
- **画布区**：可交互编辑区，提供拖拽、连线等可视化操作

### 基本操作

#### 创建图表
1. 从左侧模板面板选择预设模板
2. 或在代码编辑器中直接输入 Mermaid 代码
3. 点击"同步至画布"加载到编辑器

#### 图片转 Mermaid
1. 点击左侧面板的"图片导入"
2. 上传图片（PNG/JPEG）
3. AI 自动识别并生成 Mermaid 代码

#### 编辑节点
| 操作 | 方式 |
|------|------|
| 选中 | 单击节点 |
| 多选 | Ctrl/Cmd + 单击 |
| 移动 | 拖拽节点 |
| 创建连线 | 点击节点边缘蓝色圆点 → 点击目标节点 |
| 编辑标签 | 双击节点 → 输入新文本 → Enter 保存 / Esc 取消 |
| 删除 | 右键 → 删除 |

#### 画布操作
| 操作 | 方式 |
|------|------|
| 缩放 | 鼠标滚轮 |
| 平移 | 中键/右键拖拽 |
| 取消连线 | ESC 键 |

### 全局设置

在右侧面板"设置"中调整：

| 设置 | 可选值 |
|------|-------|
| 主题 | default / dark / forest / neutral |
| 外观 | classic / handDrawn（手绘风格）|
| 曲线样式 | basis / linear / cardinal 等 |
| 背景网格 | 开/关 |
| 布局方向 | TB（从上到下）/ LR（从左到右）/ BT / RL |

### 收藏夹
1. 编辑好图表后，点击代码编辑器的"加入收藏夹"按钮
2. 输入名称
3. 之后从左侧收藏面板快速加载

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `ANTHROPIC_API_KEY` | 是（图片转换需要）| Anthropic API 密钥 |
| `ANTHROPIC_BASE_URL` | 否 | 自定义 API 地址（默认官方地址）|

> 如果不使用图片转 Mermaid 功能，可以不配置 API Key，其他功能正常使用。

## 开发指南

### 添加新的图表类型

1. 在 `lib/templates.ts` 添加模板
2. 如需专用编辑器，在 `components/editor/` 创建编辑器组件
3. 在 `VisualEditor.tsx` 中添加类型判断和路由

### 扩展解析器和序列化器

1. 在 `lib/graphParser.ts` 添加新图表类型的解析逻辑
2. 在 `lib/graphSerializer.ts` 添加对应的序列化逻辑
3. 在 `lib/graphImporter.ts` 中注册新类型

## 常见问题

**Q: 画布编辑后如何保存？**

A: 点击画布区的"同步到代码"按钮，编辑结果会更新到代码编辑器。然后可以复制代码或加入收藏夹保存。

**Q: 渲染区和画布区有什么区别？**

A: 渲染区是只读的 Mermaid 原生渲染结果，用于查看最终效果和导出图片。画布区是可交互的编辑区，用于拖拽节点、创建连线等操作。

**Q: 图片转换 API 报错？**

A: 请检查 `.env.local` 中的 `ANTHROPIC_API_KEY` 是否正确配置。如果使用代理，需设置 `ANTHROPIC_BASE_URL`。

**Q: 支持哪些浏览器？**

A: 推荐 Chrome、Edge、Firefox 等现代浏览器。

## 致谢

本项目最初基于 [saketkattu/mermaid-visual-editor](https://github.com/saketkattu/mermaid-visual-editor) 开发，后续进行了架构重构（从 React Flow 迁移到 SVG 直接编辑方案）和大量功能扩展。感谢原作者的开源贡献。

## License

[MIT](LICENSE)
