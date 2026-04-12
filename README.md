# 图片转 Mermaid — 可视化编辑器

将图片通过 AI 转换为 Mermaid 图表代码，并提供可视化编辑、实时预览的一体化工具。

## 功能

- **图片导入**：上传 PNG/JPEG 图片，AI 自动识别并生成 Mermaid 代码
- **模板库**：内置 20+ 模板（通用示例 + 车载 AUTOSAR 场景）
- **代码编辑**：实时编辑 Mermaid 代码
- **渲染预览**：实时渲染 Mermaid 图表，支持缩放/平移，可导出 PNG/SVG
- **可视化编辑**：流程图支持拖拽式可视化编辑（基于 React Flow）
- **形状工具箱**：50+ 形状（基础 / 流程 / 技术三类），拖拽或点击绘制
- **子图支持**：自动识别 subgraph，可视化编辑中支持子图创建与节点归属
- **图表设置**：布局方向、主题、曲线样式、手绘风格、背景网格
- **对象设置**：节点颜色（填充/边框/文字）、边线样式、箭头类型
- **自动布局**：Dagre 算法自动排列节点
- **快捷键**：`N` 添加节点、`Ctrl+Z/Y` 撤销重做、`Ctrl+D` 复制、`Ctrl+C/V` 复制粘贴

## 页面布局

```
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│          │ Mermaid  │  渲染    │ 可视化   │  右侧    │
│ 左侧面板  │  代码    │  预览    │  编辑    │  面板    │
│ (图片导入 │          │          │          │ (流程图  │
│  模板     │          │          │          │  设置    │
│  图表设置)│          │          │          │  形状    │
│          │          │          │          │  对象设置)│
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入 Anthropic API Key
# ANTHROPIC_API_KEY=sk-ant-xxx

# 3. 启动开发服务器
npm run dev
# 访问 http://localhost:3333
```

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS + Neumorphism |
| 状态管理 | Zustand |
| 可视化编辑 | @xyflow/react (React Flow) |
| 自动布局 | @dagrejs/dagre |
| 图表渲染 | Mermaid.js |
| AI 转换 | Anthropic Claude 3.5 Sonnet |

## 项目结构

```
app/
  page.tsx              # 入口页面
  api/convert/route.ts  # AI 图片转换 API
components/
  EditorApp.tsx         # 主应用组件（布局 + 左面板 + 三列区域）
  editor/
    Canvas.tsx          # React Flow 画布（含拖拽绘制、子图归属）
    ZoomControls.tsx    # 缩放控件
    CommandPalette.tsx  # 命令面板 (Ctrl+K)
    ShapeIcons.tsx      # 形状图标与分类数据
    NodeTypes/          # 自定义节点类型（50+ 形状）
    EdgeTypes/          # 自定义边类型
    Inspector/
      ObjectSettingsSection.tsx  # 节点/边属性编辑
lib/
  flowStore.ts          # 可视化编辑器状态 (Zustand)
  serializer.ts         # React Flow → Mermaid 语法
  parser.ts             # Mermaid 流程图解析器（含 subgraph）
  layout.ts             # Dagre 自动布局
  templates.ts          # 模板数据
store/
  useStore.ts           # 全局状态 (图片、Mermaid 代码)
```

## 支持的图表类型

| 类型 | 代码编辑 | 渲染预览 | 可视化编辑 |
|------|---------|---------|-----------|
| 流程图 (flowchart) | ✅ | ✅ | ✅ |
| 类图 (class) | ✅ | ✅ | ✅ |
| 状态图 (state) | ✅ | ✅ | ✅ |
| 时序图 (sequence) | ✅ | ✅ | ❌ |
| 甘特图 (gantt) | ✅ | ✅ | ❌ |
| 饼图 (pie) | ✅ | ✅ | ❌ |
| 其他 Mermaid 类型 | ✅ | ✅ | ❌ |

## 致谢

本项目的可视化编辑器部分基于 [saketkattu/mermaid-visual-editor](https://github.com/saketkattu/mermaid-visual-editor) 开发，在此基础上进行了扩展和改进：

- 新增 50+ 形状支持（原项目仅支持基础形状）
- 新增子图（subgraph）识别与可视化编辑
- 新增拖拽绘制、边标签编辑、颜色自定义等功能
- 集成 AI 图片转 Mermaid 功能
- 优化布局与交互体验

感谢原作者的开源贡献。

## License

[MIT](LICENSE)
