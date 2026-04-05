"use client";

import { deflate } from "pako";
import { useStore } from "@/store/useStore";

export default function EditorPanel() {
  const { mermaid, setMermaid } = useStore();

  return (
    <div className="border-r p-4 flex flex-col">
      <h2 className="text-lg font-bold mb-4">Mermaid 代码</h2>
      <textarea
        className="flex-1 border rounded p-2 font-mono text-sm"
        value={mermaid}
        onChange={(e) => setMermaid(e.target.value)}
        placeholder="Mermaid 代码将显示在这里..."
      />
      <div className="mt-2 flex gap-2">
        <button
          className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => navigator.clipboard.writeText(mermaid)}
        >
          复制代码
        </button>
        <button
          className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          onClick={() => {
            const data = JSON.stringify({ code: mermaid, mermaid: { theme: "default" } });
            const compressed = deflate(new TextEncoder().encode(data));
            const encoded = btoa(String.fromCharCode(...compressed)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
            window.open(`https://mermaid.ai/play#pako:${encoded}`, "_blank");
          }}
        >
          使用mermaid.ai可视化编辑
        </button>
      </div>
    </div>
  );
}
