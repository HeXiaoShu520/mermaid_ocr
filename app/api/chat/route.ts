import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'edge'

const SYSTEM_PROMPT = `你是一个精通 Mermaid 图表语法的 AI 助手，嵌入在一个 Mermaid 可视化编辑器中。

你的能力：
1. 根据用户描述生成全新的 Mermaid 图表代码
2. 对用户提供的现有图表进行优化、修改、追加节点/边
3. 解释图表结构和 Mermaid 语法
4. 回答关于 Mermaid 的任何问题

回复类型规则（非常重要）：
你的每条回复必须以下面三种标记之一开头（独占一行），系统会根据标记决定是否自动应用代码到画布：

1. [NORMAL] — 正常输出，包含有效的 Mermaid 代码修改。系统会自动提取代码并应用到画布。
2. [QUESTION] — 追问/澄清，你需要更多信息才能继续。此时不会触发代码更新。
3. [ERROR] — 异常/错误提示（如语法错误、无法理解的请求）。此时不会触发代码更新。

代码输出规则：
- 仅在 [NORMAL] 类型回复中输出 \`\`\`mermaid 代码块
- 代码块中只放纯 Mermaid 代码，不要加注释或解释
- 必须保留当前图表的类型声明（如 flowchart TD）和布局方向，不要擅自更改
- 只修改用户要求修改的部分，保留其他所有节点、边、子图和样式不变
- 如果用户引用了特定节点，请在修改时保留该节点并围绕它进行操作

其他规则：
- 回答要简洁，中文回复
- 支持的图表类型：flowchart, sequenceDiagram, classDiagram, stateDiagram, pie, xychart-beta, erDiagram, gantt 等`

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { messages, currentCode, contextNodes, apiKey, baseURL, model } = body

    // 构建上下文消息
    let contextParts: string[] = []
    if (currentCode) {
      contextParts.push(`当前图表代码：\n\`\`\`mermaid\n${currentCode}\n\`\`\``)
    }
    if (contextNodes && contextNodes.length > 0) {
      const nodeDesc = contextNodes.map((n: { id: string; label: string }) => `- 节点 "${n.id}"（标签: ${n.label}）`).join('\n')
      contextParts.push(`用户引用的节点：\n${nodeDesc}`)
    }

    // 将上下文注入到第一条用户消息前
    const apiMessages = messages.map((m: { role: string; content: string }, i: number) => {
      if (i === messages.length - 1 && m.role === 'user' && contextParts.length > 0) {
        return { role: m.role, content: `${contextParts.join('\n\n')}\n\n${m.content}` }
      }
      return { role: m.role, content: m.content }
    })

    // 使用用户自定义配置或环境变量
    const finalApiKey = apiKey || process.env.ANTHROPIC_API_KEY
    const finalBaseURL = baseURL || process.env.ANTHROPIC_BASE_URL || undefined
    const finalModel = model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'

    if (!finalApiKey) {
      return new Response(JSON.stringify({ error: '未配置 API Key。请在左侧面板的 AI 设置中填写，或在 .env.local 中设置 ANTHROPIC_API_KEY。' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const client = new Anthropic({
      apiKey: finalApiKey,
      baseURL: finalBaseURL,
    })

    const stream = await client.messages.stream({
      model: finalModel,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    })

    // 返回 SSE 流
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta') {
              const delta = event.delta as { type: string; text?: string }
              if (delta.type === 'text_delta' && delta.text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: delta.text })}\n\n`))
              }
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err: any) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`))
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
