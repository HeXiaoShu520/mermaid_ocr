# 维护文档

## 开发环境

### 系统要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git

### 环境配置

```bash
# 1. 克隆仓库
git clone https://github.com/HeXiaoShu520/mermaid-visual-editor.git
cd mermaid-visual-editor

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local

# 编辑 .env.local
ANTHROPIC_API_KEY=sk-ant-xxx
NEXT_PUBLIC_API_BASE_URL=http://localhost:3333
```

### 启动开发服务器

```bash
npm run dev
# 访问 http://localhost:3333
```

### 构建生产版本

```bash
npm run build
npm start
```

## 项目依赖

### 核心依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| next | ^14.x | React 框架 |
| react | ^18.x | UI 库 |
| typescript | ^5.x | 类型系统 |
| @xyflow/react | ^12.x | 可视化编辑器 |
| @dagrejs/dagre | ^1.x | 自动布局算法 |
| mermaid | ^10.x | 图表渲染 |
| zustand | ^4.x | 状态管理 |
| @anthropic-ai/sdk | ^0.x | AI API 客户端 |

### 开发依赖

| 包名 | 用途 |
|------|------|
| tailwindcss | CSS 框架 |
| eslint | 代码检查 |
| prettier | 代码格式化 |

## 代码规范

### TypeScript 规范

```typescript
// ✅ 推荐：明确类型定义
interface NodeData {
  label: string;
  shape: ShapeType;
  style?: NodeStyle;
}

// ❌ 避免：使用 any
const data: any = { ... };

// ✅ 推荐：使用类型守卫
function isFlowchartNode(node: Node): node is FlowchartNode {
  return node.type === 'flowchart';
}
```

### React 组件规范

```typescript
// ✅ 推荐：函数组件 + TypeScript
interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function MyComponent({ value, onChange }: Props) {
  return <div>{value}</div>;
}

// ✅ 推荐：使用 memo 优化性能
export const MyComponent = memo(function MyComponent({ value }: Props) {
  return <div>{value}</div>;
});
```

### 命名规范

```typescript
// 组件：PascalCase
export function EditorCanvas() { }

// 函数/变量：camelCase
const parseNode = () => { };
const nodeCount = 10;

// 常量：UPPER_SNAKE_CASE
const MAX_NODE_COUNT = 100;

// 类型/接口：PascalCase
interface NodeData { }
type ShapeType = 'rectangle' | 'circle';

// 文件名：
// - 组件：PascalCase.tsx
// - 工具函数：camelCase.ts
// - 类型定义：types.ts
```

## 常见维护任务

### 1. 添加新形状

**步骤**：

1. 在 `components/editor/ShapeIcons.tsx` 添加形状定义：

```typescript
export const SHAPES = {
  basic: [
    // ...
    { id: 'new-shape', label: '新形状', icon: '🔷' }
  ]
};
```

2. 在 `lib/parser.ts` 添加解析规则：

```typescript
function detectShape(syntax: string): ShapeType {
  if (syntax.match(/\[\[.*\]\]/)) return 'new-shape';
  // ...
}
```

3. 在 `lib/serializer.ts` 添加序列化规则：

```typescript
function getNodeSyntax(shape: ShapeType, label: string): string {
  if (shape === 'new-shape') return `[[${label}]]`;
  // ...
}
```

4. 在 `components/editor/NodeTypes/` 创建自定义节点组件：

```typescript
// FlowNode.tsx 中添加渲染逻辑
function renderShape(shape: ShapeType) {
  if (shape === 'new-shape') {
    return <rect ... />;
  }
}
```

### 2. 添加新模板

在 `lib/templates.ts` 添加模板定义：

```typescript
export const TEMPLATES = [
  // ...
  {
    id: 'new-template',
    name: '新模板',
    category: 'general',
    code: `flowchart TB
      A[开始] --> B[结束]`
  }
];
```

### 3. 修改主题样式

在 `tailwind.config.ts` 修改主题配置：

```typescript
theme: {
  extend: {
    colors: {
      primary: '#your-color',
      // ...
    }
  }
}
```

### 4. 更新 AI 提示词

在 `app/api/convert/route.ts` 修改系统提示：

```typescript
const systemPrompt = `你是一个专业的图表分析助手...`;
```

### 5. 添加新的快捷键

在 `components/editor/Canvas.tsx` 添加键盘事件处理：

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'X' && e.ctrlKey) {
      // 新快捷键逻辑
    }
  };
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

## 调试技巧

### 1. 查看状态

```typescript
// 在组件中打印状态
import { useStore } from '@/store/useStore';
import { useFlowStore } from '@/lib/flowStore';

function MyComponent() {
  const store = useStore();
  const flowStore = useFlowStore();

  console.log('Global state:', store);
  console.log('Flow state:', flowStore);
}
```

### 2. 调试解析器

```typescript
// lib/parser.ts
export function parseMermaidToFlow(code: string) {
  console.log('Input code:', code);
  const result = parse(code);
  console.log('Parsed result:', result);
  return result;
}
```

### 3. 调试序列化器

```typescript
// lib/serializer.ts
export function serializeFlowToMermaid(nodes, edges) {
  const code = serialize(nodes, edges);
  console.log('Generated code:', code);
  return code;
}
```

### 4. React Flow 调试

```typescript
// 查看节点/边变化
import { useOnNodesChange, useOnEdgesChange } from '@xyflow/react';

useOnNodesChange((changes) => {
  console.log('Nodes changed:', changes);
});

useOnEdgesChange((changes) => {
  console.log('Edges changed:', changes);
});
```

## 测试

### 单元测试

```bash
# 运行测试
npm test

# 覆盖率报告
npm run test:coverage
```

### 测试用例示例

```typescript
// __tests__/parser.test.ts
import { parseMermaidToFlow } from '@/lib/parser';

describe('Parser', () => {
  it('should parse basic flowchart', () => {
    const code = 'flowchart TB\n  A[Start] --> B[End]';
    const result = parseMermaidToFlow(code);

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
  });

  it('should parse subgraph', () => {
    const code = `flowchart TB
      subgraph S1
        A --> B
      end`;
    const result = parseMermaidToFlow(code);

    expect(result.nodes.some(n => n.type === 'subgraph')).toBe(true);
  });
});
```

## 性能监控

### 1. React DevTools Profiler

```bash
# 安装 React DevTools 浏览器扩展
# 在 Profiler 标签中记录性能
```

### 2. 性能指标

关注以下指标：
- 首次内容绘制 (FCP)
- 最大内容绘制 (LCP)
- 首次输入延迟 (FID)
- 累积布局偏移 (CLS)

### 3. 优化建议

```typescript
// ✅ 使用 memo 避免不必要的重渲染
const MemoizedComponent = memo(MyComponent);

// ✅ 使用 useCallback 缓存函数
const handleClick = useCallback(() => {
  // ...
}, [deps]);

// ✅ 使用 useMemo 缓存计算结果
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(a, b);
}, [a, b]);

// ✅ 懒加载组件
const HeavyComponent = lazy(() => import('./HeavyComponent'));
```

## 常见问题

### 1. Mermaid 渲染失败

**原因**：语法错误或不支持的特性

**解决**：
```typescript
// 添加错误处理
try {
  await mermaid.render('preview', code);
} catch (error) {
  console.error('Mermaid render error:', error);
  // 显示错误提示
}
```

### 2. React Flow 节点位置错乱

**原因**：自动布局算法问题

**解决**：
```typescript
// 重新计算布局
import { autoLayout } from '@/lib/layout';

const layoutedNodes = autoLayout(nodes, edges, direction);
setNodes(layoutedNodes);
```

### 3. AI 转换超时

**原因**：图片过大或网络问题

**解决**：
```typescript
// 增加超时时间
const response = await fetch('/api/convert', {
  method: 'POST',
  body: JSON.stringify({ image }),
  signal: AbortSignal.timeout(60000) // 60秒
});
```

### 4. 状态不同步

**原因**：多个状态源导致不一致

**解决**：
```typescript
// 确保单一数据源
// 代码编辑 → useStore.mermaidCode → 触发解析 → flowStore
// 可视化编辑 → flowStore → 序列化 → useStore.mermaidCode
```

## 部署

### Vercel 部署

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel

# 4. 配置环境变量
# 在 Vercel Dashboard 中设置 ANTHROPIC_API_KEY
```

### Docker 部署

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3333

CMD ["npm", "start"]
```

```bash
# 构建镜像
docker build -t mermaid-visual-editor .

# 运行容器
docker run -p 3333:3333 \
  -e ANTHROPIC_API_KEY=sk-ant-xxx \
  mermaid-visual-editor
```

### 环境变量

生产环境必需的环境变量：

```bash
ANTHROPIC_API_KEY=sk-ant-xxx           # Anthropic API 密钥
NEXT_PUBLIC_API_BASE_URL=https://...  # API 基础 URL（可选）
NODE_ENV=production                    # 生产环境标识
```

## 版本发布

### 发布流程

```bash
# 1. 更新版本号
npm version patch  # 或 minor / major

# 2. 更新 CHANGELOG.md
# 记录本次更新内容

# 3. 提交代码
git add .
git commit -m "chore: release v1.x.x"

# 4. 打标签
git tag v1.x.x

# 5. 推送
git push origin main --tags
```

### 版本号规范

遵循语义化版本 (Semantic Versioning)：

- **MAJOR**：不兼容的 API 变更
- **MINOR**：向后兼容的功能新增
- **PATCH**：向后兼容的问题修复

示例：
- `1.0.0` → `1.0.1`：修复 bug
- `1.0.1` → `1.1.0`：新增形状支持
- `1.1.0` → `2.0.0`：重构解析器 API

## 贡献指南

### 提交规范

使用 Conventional Commits 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型 (type)**：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具相关

**示例**：
```
feat(editor): add hexagon shape support

- Add hexagon shape to shape library
- Update parser to recognize {{}} syntax
- Add hexagon rendering in FlowNode

Closes #123
```

### Pull Request 流程

1. Fork 仓库
2. 创建特性分支：`git checkout -b feat/new-feature`
3. 提交代码：`git commit -m "feat: add new feature"`
4. 推送分支：`git push origin feat/new-feature`
5. 创建 Pull Request

### 代码审查清单

- [ ] 代码符合项目规范
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 通过了所有测试
- [ ] 没有引入新的警告
- [ ] 性能没有明显下降

## 联系方式

- GitHub Issues: https://github.com/HeXiaoShu520/mermaid-visual-editor/issues
- 项目主页: https://github.com/HeXiaoShu520/mermaid-visual-editor

## 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)
