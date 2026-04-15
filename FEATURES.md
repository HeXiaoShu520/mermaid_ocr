# 功能清单

## 布局

- ✅ 三栏布局：代码编辑器 | Mermaid预览（只读）| 可视化编辑器
- ✅ 可调整栏宽（ResizeDivider）
- ✅ 左侧面板：图片上传、模板、收藏夹

## 可视化编辑（GraphCanvas）

### 画布交互
- ✅ 平移（左键/中键拖拽画布空白处）
- ✅ 缩放（滚轮）
- ✅ 网格显示开关

### 节点操作
- ✅ 单选 / 多选（Ctrl+点击）
- ✅ 拖拽移动节点
- ✅ 双击编辑标签（内联）
- ✅ Delete/Backspace 删除选中节点
- ✅ 右键菜单（删除、更改形状）
- ✅ 拖放添加节点（从右侧面板拖入）
- ✅ 点击添加节点（选中形状后点击画布）
- ✅ 框选绘制节点（选中形状后拖拽画布）

### 连线操作
- ✅ 悬停节点显示 Handle（上下左右）
- ✅ 拖拽 Handle 创建连线，虚线预览
- ✅ 点击目标节点完成连线
- ✅ ESC 取消连线
- ✅ 双击边编辑标签
- ✅ Delete/Backspace 删除选中边

### 子图
- ✅ 解析 subgraph...end 块
- ✅ 动态计算子图 bounding box，渲染半透明边框
- ✅ 节点在子图外先定义后进入子图时正确归属

## 同步

- ✅ 代码→画布：解析代码 + dagre 布局 → 更新 GraphCanvas
- ✅ 画布→代码：序列化节点/边 → 更新代码编辑器 + 预览
- ✅ 预览区实时跟随代码变化

## 支持的图表类型

| 类型 | 编辑器 |
|------|--------|
| flowchart / graph | GraphCanvas |
| classDiagram | GraphCanvas |
| stateDiagram | GraphCanvas |
| pie | PieEditor |
| xychart-beta | XyChartEditor |
| sequenceDiagram | SequenceEditor |

## 右侧面板（Inspector）

- ✅ 节点形状选择（14+ 种）
- ✅ 节点颜色设置（填充、边框、文字）
- ✅ 边样式设置（实线/虚线/粗线、箭头类型）
- ✅ 全局设置：方向、主题、外观、曲线样式

## 其他功能

- ✅ AI 图片转 Mermaid（Claude Vision API）
- ✅ 收藏夹（保存/加载常用图表）
- ✅ 模板库
- ✅ 导入/导出（JSON 含布局数据）
- ✅ 撤销/重做（最多 80 步）

## 已知限制

- 节点拖拽位置不保存到 Mermaid 代码（Mermaid 不支持手动坐标）
- 子图不支持拖拽整体移动
- 预览区与编辑区布局可能略有差异
