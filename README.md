# Image to Mermaid 转换工具

将图片转换为 Mermaid 流程图的 Web 应用。

## 启动步骤

1. 配置环境变量
```bash
# 编辑 .env.local 文件,填入你的 API Key（至少配置一个）
ANTHROPIC_API_KEY=sk-ant-your-key-here
OPENAI_API_KEY=sk-your-key-here
```

2. 启动开发服务器
```bash
npm run dev
```

3. 打开浏览器访问 http://localhost:3000

## 使用方法

1. 选择 AI Provider (Anthropic Claude 或 OpenAI GPT-4o)
2. 在左侧面板上传图片（拖拽或点击）
3. 等待 AI 转换（约 5-10 秒）
4. 中间面板显示 Mermaid 代码，可编辑
5. 右侧面板实时预览图表
6. 点击"复制代码"按钮复制 Mermaid 代码

## 技术栈

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Zustand (状态管理)
- Anthropic Claude 3.5 Sonnet / OpenAI GPT-4o
- Mermaid (图表渲染)
