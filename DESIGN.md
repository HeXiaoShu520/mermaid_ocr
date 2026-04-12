# 设计文档

## 架构概览

本项目采用 Next.js 14 App Router 架构，结合 React Flow 实现可视化编辑功能，通过 Anthropic Claude API 提供 AI 图片识别能力。

### 核心模块

```
┌─────────────────────────────────────────────────────────┐
│                      EditorApp                          │
│  ┌──────────┬──────────┬──────────┬──────────────────┐ │
│  │ 左侧面板  │ 代码编辑  │ 渲染预览  │ 可视化编辑 + 右侧 │ │
│  │          │          │          │                  │ │
│  │ - 图片   │ Monaco   │ Mermaid  │ React Flow       │ │
│  │ - 模板   │ Editor   │ Renderer │ + Inspector      │ │
│  │ - 设置   │          │          │                  │ │
│  └──────────┴──────────┴──────────┴──────────────────┘ │
└─────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
    useStore      flowStore       Mermaid.js    @xyflow/react
```

## 数据流

### 1. AI 图片转换流程

```
用户上传图片
    │
    ▼
前端压缩 (max 1024px)
    │
    ▼
POST /api/convert
    │
    ▼
Anthropic Claude Vision API
    │
    ▼
返回 Mermaid 代码
    │
    ▼
更新 useStore.mermaidCode
    │
    ▼
触发三个视图更新
```

### 2. 代码编辑流程

```
用户编辑代码
    │
    ▼
useStore.setMermaidCode()
    │
    ├─▶ 渲染预览 (Mermaid.js)
    │
    └─▶ 可视化编辑 (parser.ts → flowStore)
```

### 3. 可视化编辑流程

```
用户拖拽/编辑节点
    │
    ▼
flowStore 更新 (nodes/edges)
    │
    ▼
serializer.ts 生成 Mermaid 代码
    │
    ▼
useStore.setMermaidCode()
    │
    ▼
代码编辑器 + 渲染预览同步更新
```

## 状态管理

### useStore (全局状态)

```typescript
{
  uploadedImage: string | null,      // 上传的图片 base64
  mermaidCode: string,                // Mermaid 代码
  isConverting: boolean,              // AI 转换中
  setUploadedImage: (img) => void,
  setMermaidCode: (code) => void,
  setIsConverting: (val) => void
}
```

### flowStore (可视化编辑器状态)

```typescript
{
  nodes: Node[],                      // React Flow 节点
  edges: Edge[],                      // React Flow 边
  selectedNodeId: string | null,      // 选中的节点
  selectedEdgeId: string | null,      // 选中的边

  // 图表设置
  direction: 'TB' | 'LR' | 'RL' | 'BT',
  theme: string,
  curve: string,
  sketch: boolean,
  grid: boolean,

  // 操作方法
  addNode: (node) => void,
  updateNode: (id, data) => void,
  deleteNode: (id) => void,
  addEdge: (edge) => void,
  updateEdge: (id, data) => void,
  deleteEdge: (id) => void,
  autoLayout: () => void,

  // 历史记录
  undo: () => void,
  redo: () => void
}
```

## 核心算法

### 1. Mermaid 解析器 (parser.ts)

**功能**：将 Mermaid 流程图代码解析为 React Flow 数据结构

**支持特性**：
- 50+ 节点形状识别
- 子图 (subgraph) 解析
- 边的样式、箭头、标签
- 节点样式 (颜色、边框)

**解析流程**：
```
1. 提取 flowchart 方向 (TB/LR/RL/BT)
2. 逐行解析节点定义
   - 识别形状语法 ([], (), {}, etc.)
   - 提取节点 ID 和标签
   - 解析样式 (style/class/classDef)
3. 解析边定义
   - 识别箭头类型 (-->, -.->, ==>, etc.)
   - 提取边标签
   - 解析样式
4. 解析子图
   - 识别 subgraph...end 块
   - 建立父子关系
5. 生成 React Flow nodes/edges
```

### 2. Mermaid 序列化器 (serializer.ts)

**功能**：将 React Flow 数据结构转换为 Mermaid 代码

**生成流程**：
```
1. 生成 flowchart 声明
2. 生成子图定义
   - 按层级嵌套输出
   - 包含子图内的节点
3. 生成独立节点定义
4. 生成边定义
   - 根据样式选择箭头语法
   - 添加边标签
5. 生成样式定义
   - classDef 定义
   - style 应用
```

### 3. 自动布局 (layout.ts)

**算法**：Dagre (有向无环图布局)

**配置**：
```typescript
{
  rankdir: direction,        // TB/LR/RL/BT
  nodesep: 80,              // 节点间距
  ranksep: 120,             // 层级间距
  edgesep: 50,              // 边间距
  marginx: 50,
  marginy: 50
}
```

**处理子图**：
- 子图节点作为一个整体参与布局
- 子图内部节点相对定位
- 保持层级关系

## 形状系统

### 形状分类

```typescript
{
  basic: [                   // 基础形状 (12 个)
    'rectangle', 'rounded', 'stadium', 'circle',
    'rhombus', 'hexagon', 'parallelogram', 'trapezoid',
    'double-circle', 'subroutine', 'cylinder', 'asymmetric'
  ],

  flowchart: [               // 流程图形状 (20 个)
    'process', 'decision', 'data', 'predefined',
    'document', 'multi-document', 'preparation', 'manual',
    'delay', 'stored-data', 'database', 'direct-access',
    'internal-storage', 'sequential-data', 'magnetic-disk',
    'display', 'manual-input', 'card', 'paper-tape', 'off-page'
  ],

  technical: [               // 技术形状 (20 个)
    'cloud', 'server', 'laptop', 'mobile',
    'tablet', 'desktop', 'network', 'router',
    'switch', 'firewall', 'load-balancer', 'gateway',
    'api', 'microservice', 'container', 'vm',
    'storage', 'queue', 'cache', 'cdn'
  ]
}
```

### 形状语法映射

| 形状 | Mermaid 语法 | React Flow 渲染 |
|------|-------------|----------------|
| rectangle | `[label]` | 矩形 |
| rounded | `(label)` | 圆角矩形 |
| stadium | `([label])` | 体育场形 |
| circle | `((label))` | 圆形 |
| rhombus | `{label}` | 菱形 |
| hexagon | `{{label}}` | 六边形 |
| parallelogram | `[/label/]` | 平行四边形 |
| trapezoid | `[\\label/]` | 梯形 |
| ... | ... | ... |

## 子图系统

### 数据结构

```typescript
{
  id: 'subgraph_1',
  type: 'subgraph',
  data: {
    label: '子图标题',
    direction: 'TB'          // 可选：子图内部方向
  },
  position: { x: 0, y: 0 },
  style: {
    width: 400,
    height: 300
  }
}
```

### 父子关系

```typescript
{
  id: 'node_1',
  parentId: 'subgraph_1',    // 指向父子图
  extent: 'parent',          // 限制在父节点内
  ...
}
```

### 渲染层级

```
Canvas (React Flow)
  └─ SubgraphNode (自定义节点)
       ├─ 子图边框 + 标题
       └─ 子节点 (通过 parentId 关联)
```

## 样式系统

### 节点样式

```typescript
{
  fill: string,              // 填充色
  stroke: string,            // 边框色
  strokeWidth: number,       // 边框宽度
  color: string,             // 文字颜色
  fontSize: number,          // 字体大小
  fontWeight: string         // 字体粗细
}
```

### 边样式

```typescript
{
  stroke: string,            // 线条颜色
  strokeWidth: number,       // 线条宽度
  strokeDasharray: string,   // 虚线样式
  animated: boolean,         // 动画效果
  markerEnd: {               // 箭头类型
    type: 'arrow' | 'arrowclosed' | 'circle'
  }
}
```

### 主题系统

内置主题：
- `default` - 默认主题
- `forest` - 森林主题
- `dark` - 暗色主题
- `neutral` - 中性主题

通过 Mermaid.js 的 `%%{init: {'theme':'xxx'}}%%` 指令应用。

## 性能优化

### 1. 图片压缩

```typescript
// 上传前压缩到 1024px
const MAX_SIZE = 1024;
if (width > MAX_SIZE || height > MAX_SIZE) {
  const scale = MAX_SIZE / Math.max(width, height);
  canvas.width = width * scale;
  canvas.height = height * scale;
}
```

### 2. 防抖处理

```typescript
// 代码编辑器输入防抖 (300ms)
const debouncedUpdate = useMemo(
  () => debounce((code: string) => {
    setMermaidCode(code);
  }, 300),
  []
);
```

### 3. 虚拟化渲染

React Flow 内置虚拟化，只渲染可视区域内的节点。

### 4. 懒加载

```typescript
// Monaco Editor 懒加载
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div>Loading editor...</div>
});
```

## 扩展性设计

### 1. 新增形状

```typescript
// 1. 在 ShapeIcons.tsx 添加形状定义
export const SHAPES = {
  basic: [..., 'new-shape'],
  ...
};

// 2. 在 NodeTypes/ 创建组件
export const NewShapeNode = ({ data }) => (
  <div className="new-shape-style">
    {data.label}
  </div>
);

// 3. 在 Canvas.tsx 注册
const nodeTypes = {
  ...
  'new-shape': NewShapeNode
};

// 4. 在 parser.ts 添加解析规则
// 5. 在 serializer.ts 添加生成规则
```

### 2. 新增图表类型

目前仅支持流程图的可视化编辑，其他图表类型需要：

1. 实现对应的 parser
2. 设计对应的 React Flow 节点类型
3. 实现对应的 serializer
4. 适配布局算法

### 3. 新增 AI 模型

```typescript
// app/api/convert/route.ts
// 替换 Anthropic 为其他 Vision API
const response = await otherAI.vision({
  image: base64Image,
  prompt: MERMAID_PROMPT
});
```

## 技术债务

1. **类型安全**：部分 any 类型需要补充
2. **错误处理**：AI 转换失败的用户提示不够友好
3. **测试覆盖**：缺少单元测试和 E2E 测试
4. **国际化**：界面文案硬编码，需要 i18n 支持
5. **移动端适配**：当前仅适配桌面端
6. **撤销重做**：历史记录栈深度有限 (20 步)

## 未来规划

1. **协作编辑**：多人实时协作
2. **云端存储**：保存和分享图表
3. **更多图表类型**：时序图、类图的可视化编辑
4. **AI 优化**：根据上下文智能补全节点
5. **插件系统**：支持第三方扩展
