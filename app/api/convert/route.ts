import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { image, mediaType = "image/png" } = await req.json();

    const prompt = `请分析图片内容，选择最合适的 Mermaid 图表类型（如 flowchart、sequenceDiagram、classDiagram、erDiagram、gantt、mindmap 等），然后将图片转换为对应的 Mermaid 代码。

要求：
1. 根据图片内容自动选择最合适的图表类型
2. 完整还原所有节点和关系
3. 不遗漏信息
4. 只输出 Mermaid 代码，不要其他解释`;

    const anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    });

    const res = await anthropicClient.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
                data: image,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    let mermaid = res.content[0].type === "text" ? res.content[0].text : "";
    mermaid = mermaid.replace(/^```(?:mermaid)?\n?/i, "").replace(/\n?```$/,"").trim();
    return NextResponse.json({ mermaid });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
