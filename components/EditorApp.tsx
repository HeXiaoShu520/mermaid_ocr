"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Canvas } from "@/components/editor/Canvas";
import { ZoomControls } from "@/components/editor/ZoomControls";
import { ObjectSettingsSection } from "@/components/editor/Inspector/ObjectSettingsSection";
import { ShapeIcon, SHAPE_CATEGORIES, type ShapeCategory } from "@/components/editor/ShapeIcons";
import { useFlowStore, type NodeShape, type Direction, type Theme, type CurveStyle } from "@/lib/flowStore";
import { serialize } from "@/lib/serializer";
import { parseMermaidFlowchart } from "@/lib/parser";
import { parseMermaidClassDiagram } from "@/lib/classParser";
import { parseMermaidStateDiagram } from "@/lib/stateParser";
import { parseMermaidSequenceDiagram } from "@/lib/sequenceParser";
import { parseMermaidPieChart, serializePieChart } from "@/lib/pieParser";
import { parseMermaidXyChart, serializeXyChart } from "@/lib/xyChartParser";
import type { XyChartData } from "@/lib/xyChartParser";
import { serializeClassDiagram, serializeStateDiagram, serializeSequenceDiagram } from "@/lib/diagramSerializers";
import { applyDagreLayout } from "@/lib/layout";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";
import { templateCategories } from "@/lib/templates";
import { fileToBase64 } from "@/lib/utils";
import { getFavorites, addFavorite, updateFavorite, deleteFavorite, initializeSampleFavorites, type Favorite } from "@/lib/favorites";
import mermaid from "mermaid";
import "@xyflow/react/dist/style.css";
import { PieEditor } from "@/components/editor/PieEditor";
import { XyChartEditor } from "@/components/editor/XyChartEditor";
import { SequenceEditor, type SeqParticipant, type SeqMessage } from "@/components/editor/SequenceEditor";

mermaid.initialize({ startOnLoad: false });

const NEU_BG = "var(--neu-bg)";
const PANEL_BORDER = "1px solid rgba(163,177,198,0.25)";
const PANEL_RADIUS = 10;

type DiagramType = 'flowchart' | 'classDiagram' | 'stateDiagram' | 'sequenceDiagram' | 'pie' | 'xychart' | null

function parseSeqData(code: string): { participants: SeqParticipant[]; messages: SeqMessage[] } {
  const lines = code.split('\n').map(l => l.trim()).filter(Boolean)
  const participants: SeqParticipant[] = []
  const messages: SeqMessage[] = []
  const pMap = new Map<string, string>()
  const ensure = (id: string) => { if (!pMap.has(id)) { pMap.set(id, id); participants.push({ id, label: id }) } }
  for (const line of lines) {
    if (/^sequenceDiagram/.test(line) || /^%%/.test(line)) continue
    const pm = line.match(/^participant\s+(\S+)(?:\s+as\s+(.+))?$/)
    if (pm) { const [, id, label] = pm; pMap.set(id, label || id); if (!participants.find(p => p.id === id)) participants.push({ id, label: label || id }); continue }
    const patterns: [RegExp, 'solid'|'dashed', 'filled'|'open'|'none'][] = [
      [/^(.+?)-->>\s*(.+?)\s*:\s*(.*)$/, 'dashed', 'filled'],
      [/^(.+?)->>\s*(.+?)\s*:\s*(.*)$/, 'solid', 'filled'],
      [/^(.+?)--\)\s*(.+?)\s*:\s*(.*)$/, 'dashed', 'none'],
      [/^(.+?)-\)\s*(.+?)\s*:\s*(.*)$/, 'solid', 'none'],
      [/^(.+?)-->\s*(.+?)\s*:\s*(.*)$/, 'dashed', 'open'],
      [/^(.+?)->\s*(.+?)\s*:\s*(.*)$/, 'solid', 'open'],
    ]
    for (const [pat, style, arrow] of patterns) {
      const m = line.match(pat)
      if (m) { const [, from, to, label] = m; ensure(from.trim()); ensure(to.trim()); messages.push({ from: from.trim(), to: to.trim(), label: label.trim(), style, arrow }); break }
    }
  }
  return { participants, messages }
}

function serializeSeqData(participants: SeqParticipant[], messages: SeqMessage[]): string {
  const lines = ['sequenceDiagram']
  for (const p of participants) lines.push(p.label !== p.id ? `    participant ${p.id} as ${p.label}` : `    participant ${p.id}`)
  for (const m of messages) {
    const conn = m.style === 'solid' ? (m.arrow === 'filled' ? '->>' : m.arrow === 'open' ? '->' : '-)') : (m.arrow === 'filled' ? '-->>' : m.arrow === 'open' ? '-->' : '--)')
    lines.push(`    ${m.from} ${conn} ${m.to}: ${m.label}`)
  }
  return lines.join('\n')
}

function getDiagramType(code: string): DiagramType {
  const stripped = code.trim().replace(/^%%\{[\s\S]*?\}%%\s*/i, '')
  if (/^(flowchart|graph)\s/i.test(stripped)) return 'flowchart'
  if (/^classDiagram/i.test(stripped)) return 'classDiagram'
  if (/^stateDiagram(-v2)?/i.test(stripped)) return 'stateDiagram'
  if (/^sequenceDiagram/i.test(stripped)) return 'sequenceDiagram'
  if (/^pie(\s|$)/i.test(stripped)) return 'pie'
  if (/^xychart-beta/i.test(stripped)) return 'xychart'
  return null
}

function isFlowchart(code: string): boolean {
  return getDiagramType(code) === 'flowchart'
}

/* ─── Helpers ─── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function ToolButton({ onClick, disabled, children, active, title, style: extra }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode; active?: boolean; title?: string; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      background: active ? "#EEF2FF" : "#fff", border: PANEL_BORDER,
      borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 500,
      color: active ? "#4F46E5" : "#374151", cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, transition: "all 0.15s",
      display: "inline-flex", alignItems: "center", gap: 4,
      whiteSpace: "nowrap",
      ...extra,
    }}>{children}</button>
  );
}

/* small flat button for left panel settings etc. */
function FlatButton({ onClick, disabled, children, active, title, style: extra }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode; active?: boolean; title?: string; style?: React.CSSProperties;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      background: active ? "#EEF2FF" : "#fff", border: PANEL_BORDER,
      borderRadius: 8, padding: "6px 10px", fontSize: 12,
      color: active ? "#4F46E5" : "#6B7280", cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1, transition: "all 0.15s", ...extra,
    }}>{children}</button>
  );
}

/* ─── Resizable Divider ─── */
function ResizeDivider({ onDrag }: { onDrag: (dx: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    lastX.current = e.clientX;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const dx = ev.clientX - lastX.current;
      lastX.current = ev.clientX;
      onDrag(dx);
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [onDrag]);

  return (
    <div onMouseDown={onMouseDown} style={{
      width: 6, cursor: "col-resize", flexShrink: 0,
      background: "transparent", position: "relative",
    }}>
      <div style={{
        position: "absolute", left: 2, top: "50%", transform: "translateY(-50%)",
        width: 2, height: 40, borderRadius: 2, background: "rgba(163,177,198,0.4)",
        transition: "background 0.15s",
      }} />
    </div>
  );
}

/* ─── Shapes Section (Tabbed) ─── */
function ShapesSection() {
  const drawingShape = useFlowStore((s) => s.drawingShape);
  const setDrawingShape = useFlowStore((s) => s.setDrawingShape);
  const [tab, setTab] = useState<ShapeCategory>("basic");
  const handleDragStart = (e: React.DragEvent, shape: NodeShape) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("application/shape", shape);
    setDrawingShape(shape);
  };
  const category = SHAPE_CATEGORIES.find((c) => c.id === tab)!;
  return (
    <div>
      <div style={{ display: "flex", gap: 0, borderBottom: PANEL_BORDER, marginBottom: 8 }}>
        {SHAPE_CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setTab(c.id)} style={{
            flex: 1, background: "none", border: "none", borderBottom: tab === c.id ? "2px solid #4F46E5" : "2px solid transparent",
            padding: "4px 0", fontSize: 11, fontWeight: 600, cursor: "pointer",
            color: tab === c.id ? "#4F46E5" : "#9CA3AF", transition: "all 0.15s",
          }}>{c.label}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
        {category.shapes.map(({ shape, label }) => (
          <button key={shape + label} draggable onDragStart={(e) => handleDragStart(e, shape)}
            onClick={() => setDrawingShape(shape)} title={label}
            style={{
              width: 34, height: 34, background: drawingShape === shape ? "#EEF2FF" : "#fff",
              border: PANEL_BORDER, borderRadius: 6, display: "flex", alignItems: "center",
              justifyContent: "center", cursor: "grab",
              color: drawingShape === shape ? "#4F46E5" : "#6B7280", transition: "all 0.15s",
            }}>
            <div style={{ transform: "scale(0.65)" }}>
              <ShapeIcon shape={shape} stroke="currentColor" fill="none" />
            </div>
          </button>
        ))}
      </div>
      <button onClick={() => setDrawingShape(null as any)} style={{
        marginTop: 6, background: "none", border: "none", fontSize: 10, color: "#9CA3AF",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
      }}>→ 取消选择</button>
    </div>
  );
}

/* ─── Diagram Settings Section ─── */
const DIRECTIONS: { value: Direction; label: string; icon: string }[] = [
  { value: "TD", label: "从上到下", icon: "↓" }, { value: "LR", label: "从左到右", icon: "→" },
  { value: "BT", label: "从下到上", icon: "↑" }, { value: "RL", label: "从右到左", icon: "←" },
];
const THEMES: { value: Theme; label: string }[] = [
  { value: "default", label: "默认" }, { value: "dark", label: "深色" },
  { value: "forest", label: "森林" }, { value: "neutral", label: "中性" }, { value: "base", label: "基础" },
];
const CURVES: { value: CurveStyle; label: string }[] = [
  { value: "basis", label: "基础" }, { value: "linear", label: "线性" },
  { value: "cardinal", label: "基数" }, { value: "step", label: "阶梯" },
  { value: "natural", label: "自然" },
];

/* ─── Global Settings (left panel — applies to all diagrams) ─── */
function GlobalSettingsSection() {
  const { theme, look, showGrid, setTheme, setLook, setShowGrid } = useFlowStore();
  const selectStyle: React.CSSProperties = {
    width: "100%", background: "#fff", border: PANEL_BORDER, borderRadius: 8,
    padding: "5px 8px", fontSize: 11, color: "#6B7280", cursor: "pointer",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>主题</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {THEMES.map((t) => (
            <FlatButton key={t.value} onClick={() => setTheme(t.value)} active={theme === t.value}
              style={{ fontSize: 10, padding: "4px 8px" }}>{t.label}</FlatButton>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>手绘风格</div>
        <FlatButton onClick={() => setLook(look === "handDrawn" ? "classic" : "handDrawn")}
          active={look === "handDrawn"} style={{ width: "100%" }}>
          {look === "handDrawn" ? "✏️ 已启用" : "📐 已关闭"}
        </FlatButton>
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>背景网格</div>
        <FlatButton onClick={() => setShowGrid(!showGrid)}
          active={showGrid} style={{ width: "100%" }}>
          {showGrid ? "▦ 已显示" : "▢ 已隐藏"}
        </FlatButton>
      </div>
    </div>
  );
}

/* ─── Flowchart Settings (right sidebar — only for flowcharts) ─── */
function FlowchartSettingsSection() {
  const { direction, curveStyle, setDirection, setCurveStyle } = useFlowStore();
  const selectStyle: React.CSSProperties = {
    width: "100%", background: "#fff", border: PANEL_BORDER, borderRadius: 8,
    padding: "5px 8px", fontSize: 11, color: "#6B7280", cursor: "pointer",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>布局方向</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4 }}>
          {DIRECTIONS.map((d) => (
            <FlatButton key={d.value} onClick={() => setDirection(d.value)} active={direction === d.value}
              style={{ fontSize: 16, padding: "4px" }}>{d.icon}</FlatButton>
          ))}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>曲线样式</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {CURVES.map((c) => (
            <FlatButton key={c.value} onClick={() => setCurveStyle(c.value)} active={curveStyle === c.value}
              style={{ fontSize: 10, padding: "4px 8px" }}>{c.label}</FlatButton>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Left Panel ─── */
function LeftPanel() {
  const { setMermaid } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'image' | 'templates' | 'favorites' | 'settings'>('image');
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  // Initialize favorites on mount
  useEffect(() => {
    initializeSampleFavorites();
    setFavorites(getFavorites());
  }, []);

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { setError("文件不能超过 5MB"); return; }
    setLoading(true); setError(null);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/convert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType: file.type }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMermaid(data.mermaid);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleLoadFavorite = (fav: Favorite) => {
    setMermaid(fav.code);
  };

  const handleRenameFavorite = (fav: Favorite) => {
    const newName = prompt("重命名收藏", fav.name);
    if (newName && newName.trim()) {
      updateFavorite(fav.id, { name: newName.trim() });
      setFavorites(getFavorites());
    }
  };

  const handleDeleteFavorite = (fav: Favorite) => {
    if (confirm(`确定要删除收藏"${fav.name}"吗？`)) {
      deleteFavorite(fav.id);
      setFavorites(getFavorites());
    }
  };

  const tabStyle = (tab: typeof activeTab) => ({
    flex: 1,
    padding: "8px 12px",
    fontSize: 11,
    fontWeight: 600,
    color: activeTab === tab ? "#059669" : "#6B7280",
    background: activeTab === tab ? "rgba(5,150,105,0.1)" : "transparent",
    border: "none",
    borderBottom: activeTab === tab ? "2px solid #059669" : "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.2s",
  });

  return (
    <div style={{
      width: 280, background: NEU_BG, borderRight: PANEL_BORDER,
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      {/* Tab Navigation */}
      <div style={{ display: "flex", borderBottom: PANEL_BORDER }}>
        <button onClick={() => setActiveTab('image')} style={tabStyle('image')}>📷 图片</button>
        <button onClick={() => setActiveTab('templates')} style={tabStyle('templates')}>📋 模板</button>
        <button onClick={() => setActiveTab('favorites')} style={tabStyle('favorites')}>⭐ 收藏</button>
        <button onClick={() => setActiveTab('settings')} style={tabStyle('settings')}>⚙️ 设置</button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {activeTab === 'image' && (
          <Section title="图片导入">
            <input id="img-upload" type="file" accept="image/png,image/jpeg" style={{ display: "none" }}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <FlatButton onClick={() => document.getElementById("img-upload")?.click()} disabled={loading}
              style={{ width: "100%" }}>
              {loading ? "转换中..." : "📷 上传图片"}
            </FlatButton>
            {error && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 6 }}>{error}</div>}
          </Section>
        )}

        {activeTab === 'templates' && (
          <Section title="模板">
            {templateCategories.map((cat) => (
              <div key={cat.name} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", marginBottom: 4 }}>{cat.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {cat.templates.map((t) => (
                    <FlatButton key={t.name} onClick={() => setMermaid(t.code)}
                      style={{ fontSize: 10, padding: "3px 7px" }}>
                      {t.name}
                    </FlatButton>
                  ))}
                </div>
              </div>
            ))}
          </Section>
        )}

        {activeTab === 'favorites' && (
          <Section title="我的收藏">
            {favorites.length === 0 ? (
              <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", padding: "20px 0" }}>
                暂无收藏<br />
                <span style={{ fontSize: 10 }}>在代码编辑器中点击"添加到收藏夹"保存图表</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {favorites.map((fav) => (
                  <div key={fav.id} style={{
                    background: "#fff",
                    border: PANEL_BORDER,
                    borderRadius: 6,
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{fav.name}</div>
                    <div style={{ fontSize: 9, color: "#9CA3AF" }}>
                      {new Date(fav.updatedAt).toLocaleString('zh-CN', {
                        month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => handleLoadFavorite(fav)}
                        style={{
                          flex: 1, fontSize: 10, padding: "4px 8px", background: "#ECFDF5", color: "#059669",
                          border: "1px solid rgba(5,150,105,0.3)", borderRadius: 4, cursor: "pointer",
                        }}>
                        ▶️ 加载
                      </button>
                      <button onClick={() => handleRenameFavorite(fav)}
                        style={{
                          fontSize: 10, padding: "4px 8px", background: "#FEF3C7", color: "#D97706",
                          border: "1px solid rgba(217,119,6,0.3)", borderRadius: 4, cursor: "pointer",
                        }}>
                        ✏️
                      </button>
                      <button onClick={() => handleDeleteFavorite(fav)}
                        style={{
                          fontSize: 10, padding: "4px 8px", background: "#FEE2E2", color: "#DC2626",
                          border: "1px solid rgba(220,38,38,0.3)", borderRadius: 4, cursor: "pointer",
                        }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        )}

        {activeTab === 'settings' && (
          <Section title="图表设置">
            <GlobalSettingsSection />
          </Section>
        )}
      </div>
    </div>
  );
}

/* ─── Mermaid Preview Column (with download + zoom/pan) ─── */
function MermaidPreview({ widthPx }: { widthPx: number }) {
  const { mermaid: code } = useStore();
  const { theme, look, curveStyle, showGrid } = useFlowStore();
  const [svg, setSvg] = useState("");
  const [err, setErr] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  // Re-render when code, theme, look, curveStyle change
  useEffect(() => {
    if (!code) { setSvg(""); return; }
    let cancelled = false;
    (async () => {
      try {
        // Re-initialize mermaid with current theme/look/curve
        mermaid.initialize({
          startOnLoad: false,
          theme: theme as any,
          flowchart: { curve: curveStyle },
          ...(look !== "classic" ? { look } as any : {}),
        } as any);
        const id = `preview-${Date.now()}`;
        await mermaid.parse(code);
        const { svg: rendered } = await mermaid.render(id, code);
        if (!cancelled) { setSvg(rendered); setErr(""); }
      } catch {
        if (!cancelled) setErr("Mermaid 语法错误");
      }
    })();
    return () => { cancelled = true; };
  }, [code, theme, look, curveStyle]);

  // Native DOM events for drag (avoids React closure stale issues)
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let dragging = false;
    let lx = 0, ly = 0;

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      lx = e.clientX; ly = e.clientY;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      setTranslate(t => ({ x: t.x + dx, y: t.y + dy }));
    };
    const onUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale(s => Math.min(3, Math.max(0.2, s - e.deltaY * 0.001)));
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, []);

  const resetView = () => { setScale(1); setTranslate({ x: 0, y: 0 }); };

  const downloadFile = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl; a.download = filename; a.click();
  };

  const handleDownloadSVG = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    downloadFile(URL.createObjectURL(blob), "diagram.svg");
  };

  const handleDownloadPNG = () => {
    if (!svg) return;
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const canvas = document.createElement("canvas");
    const bbox = svgEl.getBoundingClientRect();
    const dpr = 2;
    canvas.width = bbox.width * dpr; canvas.height = bbox.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const img = new Image();
    const svgData = new XMLSerializer().serializeToString(svgEl);
    img.onload = () => { ctx.drawImage(img, 0, 0, bbox.width, bbox.height); downloadFile(canvas.toDataURL("image/png"), "diagram.png"); };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div style={{ width: widthPx || '27%', flexShrink: 0, display: "flex", flexDirection: "column", minWidth: 200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>渲染预览</div>
        <ToolButton onClick={handleDownloadPNG} disabled={!svg}>下载 PNG</ToolButton>
        <ToolButton onClick={handleDownloadSVG} disabled={!svg}>下载 SVG</ToolButton>
        <ToolButton onClick={resetView}>复位视图</ToolButton>
      </div>
      <div ref={viewportRef} style={{
        flex: 1, background: "#fff", border: PANEL_BORDER, borderRadius: PANEL_RADIUS,
        overflow: "hidden", cursor: "grab", userSelect: "none", touchAction: "none",
        ...(showGrid ? {
          backgroundImage: "radial-gradient(circle, #d1d9e6 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        } : {}),
      }}>
        <div ref={containerRef} style={{
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "center center", padding: 12, minHeight: "100%",
        }}>
          {err && <p style={{ color: "#ef4444", fontSize: 12 }}>{err}</p>}
          {svg && <div dangerouslySetInnerHTML={{ __html: svg }} />}
          {!svg && !err && <p style={{ color: "#9CA3AF", fontSize: 12 }}>预览将显示在这里</p>}
        </div>
      </div>
    </div>
  );
}

/* ─── Code Editor Column (with copy + mermaid.live buttons) ─── */
function CodeEditor({ supported, widthPx, onSyncToCanvas }: { supported: boolean; widthPx: number; onSyncToCanvas: () => void }) {
  const { mermaid: code, setMermaid } = useStore();
  const importDiagram = useFlowStore((s) => s.importDiagram);
  const [copied, setCopied] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  const handleCodeToVisual = () => {
    if (!code.trim()) return;
    const type = getDiagramType(code);
    if (type === 'flowchart') {
      const result = parseMermaidFlowchart(code);
      if (result.error) { alert("解析失败: " + result.error); return; }
      importDiagram(result.nodes, result.edges, {
        direction: result.direction, theme: result.theme,
        look: result.look, curveStyle: result.curveStyle,
      });
    } else if (type === 'classDiagram') {
      const result = parseMermaidClassDiagram(code);
      if (result.error) { alert("解析失败: " + result.error); return; }
      importDiagram(result.nodes, result.edges, {
        direction: 'TD', theme: 'default', look: 'classic', curveStyle: 'basis',
      });
    } else if (type === 'stateDiagram') {
      const result = parseMermaidStateDiagram(code);
      if (result.error) { alert("解析失败: " + result.error); return; }
      importDiagram(result.nodes, result.edges, {
        direction: 'TD', theme: 'default', look: 'classic', curveStyle: 'basis',
      });
    } else {
      onSyncToCanvas();
    }
  };

  const handleCopy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleMermaidLive = () => {
    if (!code) return;
    const state = JSON.stringify({ code, mermaid: { theme: "default" } });
    const encoded = btoa(unescape(encodeURIComponent(state)));
    window.open(`https://mermaid.live/edit#base64:${encoded}`, "_blank");
  };

  const handleAddToFavorites = () => {
    if (!code.trim()) {
      alert("请先输入 Mermaid 代码");
      return;
    }
    const name = prompt("请输入收藏名称", "我的图表");
    if (name && name.trim()) {
      addFavorite(name.trim(), code);
      setFavorites(getFavorites());
      alert("已添加到收藏夹！");
    }
  };

  return (
    <div style={{ width: widthPx || '27%', flexShrink: 0, display: "flex", flexDirection: "column", minWidth: 200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Mermaid 代码</div>
        <ToolButton onClick={handleCopy} disabled={!code}>
          {copied ? "✓ 已复制" : "复制"}
        </ToolButton>
        <ToolButton onClick={handleMermaidLive} disabled={!code}>
          mermaid.ai编辑
        </ToolButton>
        <ToolButton onClick={handleAddToFavorites} disabled={!code} title="添加到收藏夹"
          style={{ background: "#FEF3C7", color: "#D97706", border: "1px solid rgba(217,119,6,0.3)" }}>
          ⭐ 收藏
        </ToolButton>
        {supported && (
          <ToolButton onClick={handleCodeToVisual} title="将代码解析到可视化编辑器"
            style={{ background: "#ECFDF5", color: "#059669", border: "1px solid rgba(5,150,105,0.3)" }}>
            同步至画图
          </ToolButton>
        )}
      </div>
      <textarea
        value={code}
        onChange={(e) => setMermaid(e.target.value)}
        onCopy={(e) => e.stopPropagation()}
        onCut={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
        placeholder="输入 Mermaid 代码..."
        style={{ flex: 1, background: "#fff", border: PANEL_BORDER, borderRadius: PANEL_RADIUS, padding: 12, fontSize: 13, fontFamily: "monospace", color: "#374151", resize: "none", outline: "none" }}
      />
    </div>
  );
}

/* ─── Auto Layout Icon ─── */
function IconAutoLayout() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="1" width="6" height="4" rx="1" /><rect x="2" y="16" width="6" height="4" rx="1" />
      <rect x="16" y="16" width="6" height="4" rx="1" /><line x1="12" y1="5" x2="12" y2="11" />
      <line x1="5" y1="11" x2="19" y2="11" /><line x1="5" y1="11" x2="5" y2="16" />
      <line x1="19" y1="11" x2="19" y2="16" />
    </svg>
  );
}

/* ─── Visual Editor Column ─── */
function VisualEditorColumn({ supported, diagramType, pieData, xyData, seqData, onSyncToCanvas }: {
  supported: boolean; diagramType: string;
  pieData: { title: string; data: Array<{ label: string; value: number }> } | null;
  xyData: XyChartData | null;
  seqData: { participants: SeqParticipant[]; messages: SeqMessage[] } | null;
  onSyncToCanvas: () => void;
}) {
  const { setNodes } = useFlowStore(useShallow((s) => ({ setNodes: s.setNodes })));
  const nodesLength = useFlowStore((s) => s.nodes.length);
  const addSubgraph = useFlowStore((s) => s.addSubgraph);
  const { mermaid: code, setMermaid } = useStore();

  // Local draft state for pie/xychart/seq — not synced to code until user clicks button
  const [pieDraft, setPieDraft] = useState<{ title: string; data: Array<{ label: string; value: number }> } | null>(null)
  const [xyDraft, setXyDraft] = useState<XyChartData | null>(null)
  const [seqDraft, setSeqDraft] = useState<{ participants: SeqParticipant[]; messages: SeqMessage[] } | null>(null)

  // When incoming data changes (sync to canvas triggered), reset drafts
  useEffect(() => { setPieDraft(pieData) }, [pieData])
  useEffect(() => { setXyDraft(xyData) }, [xyData])
  useEffect(() => { setSeqDraft(seqData) }, [seqData])

  const handleAutoLayout = () => {
    const { nodes, edges, direction } = useFlowStore.getState();
    if (nodes.length === 0) return;
    setNodes(applyDagreLayout(nodes, edges, direction));
  };

  const handleVisualToCode = () => {
    const { nodes, edges, direction, theme, look, curveStyle } = useFlowStore.getState();
    if (nodes.length === 0) return;
    const type = getDiagramType(code);
    if (type === 'classDiagram') {
      setMermaid(serializeClassDiagram(nodes, edges));
    } else if (type === 'stateDiagram') {
      setMermaid(serializeStateDiagram(nodes, edges));
    } else {
      setMermaid(serialize(nodes, edges, { direction, theme, look, curveStyle }));
    }
  };

  const handleDraftToCode = () => {
    if (diagramType === 'pie' && pieDraft) {
      setMermaid(serializePieChart(pieDraft.title, pieDraft.data))
    } else if (diagramType === 'xychart' && xyDraft) {
      setMermaid(serializeXyChart(xyDraft))
    } else if (diagramType === 'sequenceDiagram' && seqDraft) {
      setMermaid(serializeSeqData(seqDraft.participants, seqDraft.messages))
    }
  }

  const isFlowLike = diagramType === 'flowchart' || diagramType === 'classDiagram' || diagramType === 'stateDiagram'
  const isSpecial = diagramType === 'pie' || diagramType === 'xychart' || diagramType === 'sequenceDiagram'

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>可视化编辑</div>
        {isSpecial && (
          <ToolButton onClick={handleDraftToCode} title="将可视化编辑内容同步到代码"
            style={{ background: "#ECFDF5", color: "#059669", border: "1px solid rgba(5,150,105,0.3)" }}>
            同步回代码
          </ToolButton>
        )}
        {supported && isFlowLike && (
          <>
            <ToolButton onClick={handleVisualToCode} disabled={nodesLength === 0} title="将画布内容同步到代码"
              style={{ background: "#ECFDF5", color: "#059669", border: "1px solid rgba(5,150,105,0.3)" }}>
              同步回代码
            </ToolButton>
            <ToolButton onClick={handleAutoLayout} disabled={nodesLength === 0}>
              <IconAutoLayout /> 自动布局
            </ToolButton>
            {diagramType === 'flowchart' && (
              <ToolButton onClick={() => addSubgraph()}>子图</ToolButton>
            )}
          </>
        )}
      </div>
      <div style={{ flex: 1, background: "#fff", border: PANEL_BORDER, borderRadius: PANEL_RADIUS, overflow: "hidden", position: "relative" }}>
        {diagramType === 'pie' && pieDraft ? (
          <PieEditor title={pieDraft.title} data={pieDraft.data} onUpdate={(title, data) => setPieDraft({ title, data })} />
        ) : diagramType === 'xychart' && xyDraft ? (
          <XyChartEditor data={xyDraft} onUpdate={setXyDraft} />
        ) : diagramType === 'sequenceDiagram' && seqDraft ? (
          <SequenceEditor participants={seqDraft.participants} messages={seqDraft.messages} onUpdate={(p, m) => setSeqDraft({ participants: p, messages: m })} />
        ) : isFlowLike && supported ? (
          <><Canvas /><ZoomControls /></>
        ) : (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9CA3AF", fontSize: 13 }}>
            当前图表类型不支持可视化编辑
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Class Diagram Settings ─── */
function ClassDiagramSettingsSection() {
  const { drawingShape, setDrawingShape } = useFlowStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>节点形状</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4 }}>
          <FlatButton
            onClick={() => setDrawingShape('subroutine')}
            active={drawingShape === 'subroutine'}
            style={{ fontSize: 10, padding: "6px 8px", justifyContent: "flex-start" }}>
            📦 类（双线框）
          </FlatButton>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.4, marginTop: 4 }}>
          关系类型：
        </div>
        <div style={{ fontSize: 9, color: "#9CA3AF", lineHeight: 1.5, fontFamily: "monospace", marginTop: 4 }}>
          --|&gt; 继承<br />
          ..|&gt; 实现<br />
          --* 组合<br />
          --o 聚合<br />
          --&gt; 依赖<br />
          -- 关联
        </div>
      </div>
    </div>
  );
}

/* ─── State Diagram Settings ─── */
function StateDiagramSettingsSection() {
  const { drawingShape, setDrawingShape } = useFlowStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>节点形状</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4 }}>
          <FlatButton
            onClick={() => setDrawingShape('rounded')}
            active={drawingShape === 'rounded'}
            style={{ fontSize: 10, padding: "6px 8px", justifyContent: "flex-start" }}>
            ▢ 状态（圆角）
          </FlatButton>
          <FlatButton
            onClick={() => setDrawingShape('circle')}
            active={drawingShape === 'circle'}
            style={{ fontSize: 10, padding: "6px 8px", justifyContent: "flex-start" }}>
            ● 开始/结束
          </FlatButton>
          <FlatButton
            onClick={() => setDrawingShape('subroutine')}
            active={drawingShape === 'subroutine'}
            style={{ fontSize: 10, padding: "6px 8px", justifyContent: "flex-start" }}>
            ▣ 复合状态
          </FlatButton>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.4, marginTop: 4 }}>
          提示：
        </div>
        <div style={{ fontSize: 9, color: "#9CA3AF", lineHeight: 1.5, marginTop: 4 }}>
          • 使用圆角矩形表示普通状态<br />
          • 使用圆形表示开始/结束<br />
          • 使用双线框表示复合状态
        </div>
      </div>
    </div>
  );
}

function SequenceDiagramSettingsSection() {
  const { drawingShape, setDrawingShape } = useFlowStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>参与者形状</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4 }}>
          <FlatButton
            onClick={() => setDrawingShape('rectangle')}
            active={drawingShape === 'rectangle'}
            style={{ fontSize: 10, padding: "6px 8px", justifyContent: "flex-start" }}>
            ▭ 参与者（矩形）
          </FlatButton>
        </div>
      </div>
      <div>
        <div style={{ fontSize: 10, color: "#6B7280", lineHeight: 1.4, marginTop: 4 }}>消息类型：</div>
        <div style={{ fontSize: 9, color: "#9CA3AF", lineHeight: 1.5, fontFamily: "monospace", marginTop: 4 }}>
          -&gt;&gt; 同步消息（实线箭头）<br />
          --&gt;&gt; 异步消息（虚线箭头）<br />
          -) 开放箭头（实线）<br />
          --) 开放箭头（虚线）
        </div>
      </div>
    </div>
  );
}

/* ─── Right Sidebar: Object Settings ─── */
function RightSidebar({ supported, diagramType }: { supported: boolean; diagramType: string }) {
  if (!supported) return null;

  return (
    <div style={{
      width: 200, background: NEU_BG, borderLeft: PANEL_BORDER,
      padding: 12, overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column", gap: 14,
    }}>
      {diagramType === 'flowchart' && (
        <>
          <Section title="流程图设置">
            <FlowchartSettingsSection />
          </Section>
          <Section title="形状工具箱">
            <ShapesSection />
          </Section>
        </>
      )}
      {diagramType === 'classDiagram' && (
        <Section title="类图工具">
          <ClassDiagramSettingsSection />
        </Section>
      )}
      {diagramType === 'stateDiagram' && (
        <Section title="状态图工具">
          <StateDiagramSettingsSection />
        </Section>
      )}
      {diagramType === 'sequenceDiagram' && (
        <Section title="时序图工具">
          <SequenceDiagramSettingsSection />
        </Section>
      )}
      <ObjectSettingsSection />
    </div>
  );
}

/* ─── Main Layout ─── */
function EditorContent() {
  const { nodes, edges, direction, theme, look, curveStyle } = useFlowStore();
  const { mermaid: code, setMermaid } = useStore();
  const diagramType = getDiagramType(code) || 'flowchart';
  const supported = isFlowchart(code) || diagramType === 'stateDiagram' || diagramType === 'sequenceDiagram' || diagramType === 'pie' || diagramType === 'xychart' || (!code && nodes.length > 0)

  // Pie chart state
  const [pieData, setPieData] = useState<{ title: string; data: Array<{ label: string; value: number }> } | null>(null)
  const [xyData, setXyData] = useState<XyChartData | null>(null)
  const [seqData, setSeqData] = useState<{ participants: SeqParticipant[]; messages: SeqMessage[] } | null>(null)

  // Only reset editors when diagram type changes (not on every keystroke)
  const prevDiagramType = useRef<string | null>(null)
  useEffect(() => {
    if (diagramType !== prevDiagramType.current) {
      prevDiagramType.current = diagramType
      if (diagramType !== 'pie') setPieData(null)
      if (diagramType !== 'xychart') setXyData(null)
      if (diagramType !== 'sequenceDiagram') setSeqData(null)
    }
  }, [diagramType])

  // Manual sync: parse current code into visual editor
  const handleSyncToCanvas = useCallback(() => {
    if (diagramType === 'pie') {
      const result = parseMermaidPieChart(code)
      if (!result.error) setPieData({ title: result.title, data: result.data })
    } else if (diagramType === 'xychart') {
      const result = parseMermaidXyChart(code)
      if (!result.error && result.data) setXyData(result.data)
    } else if (diagramType === 'sequenceDiagram') {
      setSeqData(parseSeqData(code))
    }
  }, [code, diagramType])

  // Resizable column widths (ratio 3:3:5)
  const containerRef = useRef<HTMLDivElement>(null);
  const [codeW, setCodeW] = useState(0);
  const [previewW, setPreviewW] = useState(0);
  // Initialize widths based on container size (3:3:5 ratio)
  useEffect(() => {
    if (!containerRef.current) return;
    const total = containerRef.current.clientWidth - 24; // minus padding + dividers
    if (codeW === 0 && previewW === 0) {
      setCodeW(Math.round(total * 2.7 / 11.7));
      setPreviewW(Math.round(total * 3.5 / 11.7));
    }
  }, []);

  // When diagram settings change and we have nodes, auto-sync to code
  useEffect(() => {
    if (nodes.length === 0) return;
    const type = getDiagramType(code);
    if (type === 'classDiagram') {
      setMermaid(serializeClassDiagram(nodes, edges));
    } else if (type === 'stateDiagram') {
      setMermaid(serializeStateDiagram(nodes, edges));
    } else if (type === 'sequenceDiagram') {
      setMermaid(serializeSequenceDiagram(nodes, edges));
    } else {
      const syntax = serialize(nodes, edges, { direction, theme, look, curveStyle });
      setMermaid(syntax);
    }
  }, [direction, theme, look, curveStyle]);

  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden", display: "flex", background: NEU_BG }}>
      <LeftPanel />
      <div ref={containerRef} style={{ flex: 1, display: "flex", padding: 12, minWidth: 0, overflow: "hidden" }}>
        <CodeEditor supported={supported} widthPx={codeW} onSyncToCanvas={handleSyncToCanvas} />
        <ResizeDivider onDrag={(dx) => setCodeW(w => Math.max(200, w + dx))} />
        <MermaidPreview widthPx={previewW} />
        <ResizeDivider onDrag={(dx) => setPreviewW(w => Math.max(200, w + dx))} />
        <VisualEditorColumn supported={supported} diagramType={diagramType} pieData={pieData} xyData={xyData} seqData={seqData} onSyncToCanvas={handleSyncToCanvas} />
      </div>
      <RightSidebar supported={supported} diagramType={diagramType} />
    </div>
  );
}

export default function EditorApp() {
  return (
    <ReactFlowProvider>
      <EditorContent />
    </ReactFlowProvider>
  );
}
