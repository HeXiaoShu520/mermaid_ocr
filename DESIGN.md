# 设计文档

## 架构概览

Next.js 14 App Router + 自定义 Canvas 可视化编辑器 + Anthropic Claude Vision API

```
┌─────────────────────────────────────────────────────────────┐
│                        EditorApp                            │
│  ┌──────────┬──────────┬──────────────┬──────────────────┐  │
│  │ 左侧面板  │ 代码编辑  │ Mermaid预览   │  可视化编辑器     │  │
│  │ LeftPanel│ Monaco   │MermaidPreview│  VisualEditor    │  │
│  │          │ Editor   │  (只读)       │  + RightSidebar  │  │
│  └──────────┴──────────┴──────────────┴──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │              │                      │
         ▼              ▼                      ▼
    useStore      useStore            graphEditorStore
  (全局代码)     (全局代码)           (节点/边/子图状态)
```

## 状态管理

### useStore（全局，store/useStore.ts）
```typescript
{
  mermaidCode: string,         // 当前 Mermaid 代码
  uploadedImage: string | null,
  isConverting: boolean,
}
```

### graphEditorStore（可视化编辑器，lib/graphEditorStore.ts）
```typescript
{
  nodes: NodeState[],          // 节点列表（含坐标、形状、颜色）
  edges: EdgeState[],          // 边列表
  subgraphs: SubgraphState[],  // 子图列表
  viewTransform: { x, y, scale },
  selectedNodeIds: Set<string>,
  selectedEdgeId: string | null,
  connecting: { sourceId, mousePos } | null,
  layout: LayoutMetadata | null,
  showGrid: boolean,
  pendingAddShape: string | null,
}
```

## 数据流

### 代码 → 画布（手动同步）
```
useStore.mermaidCode
    │
    ▼
graphParser.ts → parseMermaidFlowchart()
    │  解析节点、边、子图、方向
    ▼
graphLayout.ts → dagreLayout()
    │  计算节点坐标
    ▼
graphEditorStore.initGraph(nodes, edges, layout, subgraphs)
    │
    ▼
GraphCanvas 重新渲染
```

### 画布 → 代码（手动同步）
```
graphEditorStore.nodes / edges
    │
    ▼
graphSerializer.ts → serializeToMermaid()
    │
    ▼
useStore.setMermaidCode()
    │
    ▼
Monaco Editor + MermaidPreview 同步更新
```

## 核心模块

### lib/graphParser.ts
- 解析 Mermaid flowchart 代码为 `GraphData`
- 支持 20+ 节点形状语法
- 解析 subgraph...end 块，设置节点的 `subgraph` 字段
- `upsertNode`：节点在子图外先创建后，进入子图时补充 `subgraph` 字段

### lib/graphLayout.ts
- `dagreLayout`：使用 dagre 计算节点坐标
- `applyLayout`：从持久化数据恢复坐标
- `extractLayout`：提取当前坐标用于持久化

### lib/graphSerializer.ts
- 将 `NodeState[]` + `EdgeState[]` 序列化为 Mermaid 代码
- 支持子图输出（subgraph...end）
- 支持节点颜色样式输出（style 指令）

### lib/graphImporter.ts
- `importFromCode`：从 Mermaid 代码导入（使用 dagre 布局）
- `importFromExportData`：从完整数据导入（优先使用保存的布局）

### components/editor/GraphCanvas/
- `GraphCanvas.tsx`：主画布，处理平移/缩放/框选/拖放
- `GraphNode.tsx`：节点渲染 + 拖拽 + Handle 连线点
- `GraphEdge.tsx`：边渲染（SVG path）
- `Subgraph.tsx`：子图边框（动态计算 bounding box）
- `NodeEditor.tsx`：双击节点内联编辑标签
- `EdgeEditor.tsx`：双击边编辑标签
- `GraphContextMenu.tsx`：右键菜单

### components/editor/MermaidPreview.tsx
- 只读渲染 Mermaid SVG
- 渲染前 strip `%% comment` 注释（避免 parse error）
- 支持平移/缩放

### components/editor/VisualEditor.tsx
- 根据图表类型分发：flowchart → GraphCanvas，pie/xychart/sequence → 专用编辑器
- 包含"代码→画布"和"画布→代码"同步按钮

## 子图系统

### 数据结构
```typescript
// graphParser.ts
interface Subgraph {
  id: string
  label: string
  nodes: string[]   // 节点 ID 列表
}

// graphEditorStore.ts
interface NodeState {
  subgraph?: string  // 所属子图 ID
  ...
}
```

### 渲染方式
`Subgraph.tsx` 根据属于该子图的节点坐标动态计算 bounding box，渲染为半透明边框层（`zIndex: 0`，在节点之下）。

## AI 助手模块

### 架构
```
左侧面板 AI 配置区（Base URL / Model / API Key）
    │ 持久化到 localStorage（Zustand persist）
    ▼
lib/aiStore.ts（useAiStore）
    │ messages, isOpen, isLoading, currentContextNodes
    ▼
components/editor/AiChatBox.tsx（常驻画布底部）
    │ 展开/收起，引用节点插入输入框，多轮对话
    ▼
app/api/chat/route.ts（SSE 流式接口）
    │ 系统提示 + 当前画布序列化代码 + 历史消息
    ▼
Anthropic / OpenAI 兼容接口
    │ 返回含 ```mermaid 代码块的响应
    ▼
自动应用到画布（graphEditorStore 临时预览）
    │ 用户确认后"回写代码"同步到编辑器
```

### 关键设计决策
- **画布代码优先**：发给 AI 的是 `graphSerializer` 序列化的画布状态，而非编辑器代码，保持解耦
- **节点引用**：右键菜单"引用到 AI"将 `「节点名」` 插入输入框光标位置，子图引用同时附带内部节点列表
- **流式渲染**：SSE 逐字输出，实时解析 mermaid 代码块并应用到画布
- **多轮对话**：完整历史消息随每次请求发送，支持上下文连续修改

### 相关文件
| 文件 | 职责 |
|------|------|
| `lib/aiStore.ts` | AI 配置 + 对话状态管理 |
| `app/api/chat/route.ts` | 流式 AI 接口（SSE） |
| `components/editor/AiChatBox.tsx` | 对话 UI，常驻画布底部 |
| `components/EditorApp.tsx` | 左侧面板 AI 配置区 |
| `components/editor/GraphCanvas/GraphContextMenu.tsx` | 右键菜单"引用到 AI" |

## 支持的图表类型

| 类型 | 编辑器 |
|------|--------|
| flowchart / graph | GraphCanvas |
| classDiagram | GraphCanvas |
| stateDiagram | GraphCanvas |
| pie | PieEditor |
| xychart-beta | XyChartEditor |
| sequenceDiagram | SequenceEditor |
