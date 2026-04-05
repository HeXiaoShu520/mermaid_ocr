"use client";

import { useStore } from "@/store/useStore";
import { useEffect, useState } from "react";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false });

export default function PreviewPanel() {
  const { mermaid: code, loading, error } = useStore();
  const [svg, setSvg] = useState("");
  const [renderError, setRenderError] = useState("");

  useEffect(() => {
    if (!code) return;

    const render = async () => {
      try {
        const id = `preview-${Date.now()}`;
        await mermaid.parse(code);
        const { svg } = await mermaid.render(id, code);
        setSvg(svg);
        setRenderError("");
      } catch (e: any) {
        setRenderError("Mermaid 语法错误");
      }
    };

    render();
  }, [code]);

  return (
    <div className="p-4 flex flex-col">
      <h2 className="text-lg font-bold mb-4">预览</h2>
      <div className="flex-1 border rounded p-4 overflow-auto">
        {loading && <p>转换中...</p>}
        {error && <p className="text-red-500">{error}</p>}
        {renderError && <p className="text-red-500">{renderError}</p>}
        {svg && <div dangerouslySetInnerHTML={{ __html: svg }} />}
      </div>
    </div>
  );
}
