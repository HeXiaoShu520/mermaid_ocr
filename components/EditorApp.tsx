import { useCallback, useEffect, useRef, useState } from "react";
import { ObjectSettingsSection } from "@/components/editor/Inspector/ObjectSettingsSection";
import { ShapeIcon, SHAPE_CATEGORIES, type ShapeCategory } from "@/components/editor/ShapeIcons";
import { useSvgEditorStore, type NodeShape, type Direction, type Theme, type CurveStyle } from "@/lib/svgEditorStore";
import { useGraphEditorStore } from "@/lib/graphEditorStore";
import { parseMermaidPieChart, serializePieChart } from "@/lib/pieParser";
import { parseMermaidXyChart, serializeXyChart } from "@/lib/xyChartParser";
import type { XyChartData } from "@/lib/xyChartParser";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";
import { templateCategories } from "@/lib/templates";
import { fileToBase64 } from "@/lib/utils";
import { getFavorites, addFavorite, updateFavorite, deleteFavorite, initializeSampleFavorites, type Favorite } from "@/lib/favorites";
import mermaid from "mermaid";
import { PieEditor } from "@/components/editor/PieEditor";
import { XyChartEditor } from "@/components/editor/XyChartEditor";
import { SequenceEditor, type SeqParticipant, type SeqMessage } from "@/components/editor/SequenceEditor";
import MermaidPreview from "@/components/editor/MermaidPreview";
import VisualEditor from "@/components/editor/VisualEditor";

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
function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div onClick={() => setOpen(!open)}
        style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.08em", marginBottom: open ? 8 : 0, cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ fontSize: 9, transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>▶</span>
        {title}
      </div>
      {open && children}
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
  const pendingAddShape = useGraphEditorStore((s) => s.pendingAddShape);
  const setPendingAddShape = useGraphEditorStore((s) => s.setPendingAddShape);
  const addSubgraph = useGraphEditorStore((s) => s.addSubgraph);
  const [tab, setTab] = useState<ShapeCategory>("basic");
  const category = SHAPE_CATEGORIES.find((c) => c.id === tab)!;

  const handleDragStart = (e: React.DragEvent, shape: string) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/shape', shape);
  };

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
          <button key={shape + label}
            draggable
            onDragStart={(e) => handleDragStart(e, shape)}
            onClick={() => setPendingAddShape(shape)}
            title={label}
            style={{
              background: pendingAddShape === shape ? "#EEF2FF" : "#fff",
              border: PANEL_BORDER, borderRadius: 6, padding: 8, cursor: "grab",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
            <ShapeIcon shape={shape} stroke={pendingAddShape === shape ? "#4F46E5" : "#6B7280"} fill="none" />
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
        <button onClick={() => setPendingAddShape(null)} style={{
          background: "none", border: "none", fontSize: 10, color: "#9CA3AF",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
        }}>→ 取消选择</button>
        <button onClick={() => {
          const id = `sg_${Date.now()}`
          addSubgraph({ id, label: '子图', nodes: [] })
        }} style={{
          background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 6,
          fontSize: 10, color: "#16A34A", cursor: "pointer", padding: "3px 8px",
        }}>+ 添加子图</button>
      </div>
    </div>
  );
}

/* ─── Diagram Settings Section ─── */
const DIRECTIONS: { value: Direction; label: string; icon: string }[] = [
  { value: "TB", label: "从上到下", icon: "↓" }, { value: "LR", label: "从左到右", icon: "→" },
  { value: "BT", label: "从下到上", icon: "↑" }, { value: "RL", label: "从右到左", icon: "←" },
];
const THEMES: { value: Theme; label: string }[] = [
  { value: "default", label: "默认" }, { value: "dark", label: "深色" },
  { value: "forest", label: "森林" }, { value: "neutral", label: "中性" }, { value: "base", label: "基础" },
];
const CURVES: { value: CurveStyle; label: string }[] = [
  { value: "basis", label: "基础" },
  { value: "linear", label: "线性" },
  { value: "step", label: "阶梯" },
  { value: "stepBefore", label: "阶梯前" },
  { value: "stepAfter", label: "阶梯后" },
  { value: "monotoneX", label: "单调X" },
  { value: "monotoneY", label: "单调Y" },
];

/* ─── Global Settings (left panel — applies to all diagrams) ─── */
function GlobalSettingsSection() {
  const { theme, look, showGrid, setTheme, setLook, setShowGrid } = useSvgEditorStore();
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
  const { direction, curveStyle, setDirection, setCurveStyle } = useGraphEditorStore();
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

  return (
    <div style={{
      width: 280, background: NEU_BG, borderRight: PANEL_BORDER,
      display: "flex", flexDirection: "column", padding: 14, gap: 14, overflowY: "auto", flexShrink: 0,
    }}>
      <Section title="📷 图片导入">
        <input id="img-upload" type="file" accept="image/png,image/jpeg" style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <FlatButton onClick={() => document.getElementById("img-upload")?.click()} disabled={loading}
          style={{ width: "100%" }}>
          {loading ? "转换中..." : "📷 上传图片"}
        </FlatButton>
        {error && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 6 }}>{error}</div>}
      </Section>

      <Section title="⚙️ 图表设置">
        <GlobalSettingsSection />
      </Section>

      <Section title="📋 模板">
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

      <Section title="⭐ 收藏夹">
        {favorites.length === 0 ? (
          <div style={{ fontSize: 10, color: "#9CA3AF", textAlign: "center", padding: "8px 0" }}>
            点击代码编辑器中的"⭐ 收藏"按钮保存
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {favorites.map((fav) => (
              <div key={fav.id} style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "#fff", border: PANEL_BORDER, borderRadius: 4, padding: "4px 6px",
              }}>
                <button onClick={() => handleLoadFavorite(fav)}
                  onDoubleClick={() => handleRenameFavorite(fav)}
                  style={{
                    flex: 1, fontSize: 10, color: "#374151", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left", padding: 0, overflow: "hidden",
                    whiteSpace: "nowrap", textOverflow: "ellipsis",
                  }}
                  title="单击加载，双击重命名">
                  {fav.name}
                </button>
                <button onClick={() => handleDeleteFavorite(fav)}
                  style={{ fontSize: 9, padding: "1px 3px", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}
                  title="删除">🗑️</button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* ─── Unified Canvas Column (replaces MermaidPreview + VisualEditorColumn) ─── */
/* ─── Code Editor Column (with copy + mermaid.live buttons) ─── */
function CodeEditor({ widthPx }: { widthPx: number }) {
  const { mermaid: code, setMermaid } = useStore();
  const [copied, setCopied] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

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
      {/* 标题栏 + 按钮 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Mermaid 代码</div>
        <button
          onClick={handleCopy}
          disabled={!code}
          className="px-4 py-2 bg-blue-50 border border-blue-300 text-blue-700 rounded text-sm hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {copied ? "✓ 已复制" : "复制"}
        </button>
        <button
          onClick={handleAddToFavorites}
          disabled={!code}
          title="添加到收藏夹"
          className="px-4 py-2 bg-yellow-50 border border-yellow-300 text-yellow-700 rounded text-sm hover:bg-yellow-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ⭐ 收藏
        </button>
      </div>
      {/* 代码编辑区 */}
      <textarea
        value={code}
        onChange={(e) => setMermaid(e.target.value)}
        onCopy={(e) => e.stopPropagation()}
        onCut={(e) => e.stopPropagation()}
        onPaste={(e) => e.stopPropagation()}
        placeholder="输入 Mermaid 代码..."
        style={{ flex: 1, background: "#fff", border: "none", padding: 12, fontSize: 13, fontFamily: "monospace", color: "#374151", resize: "none", outline: "none" }}
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

/* ─── Class Diagram Settings ─── */
function ClassDiagramSettingsSection() {
  const { pendingAddShape, setPendingAddShape } = useSvgEditorStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>节点形状</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4 }}>
          <FlatButton
            onClick={() => setPendingAddShape('subroutine')}
            active={pendingAddShape === 'subroutine'}
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
  const { pendingAddShape, setPendingAddShape } = useSvgEditorStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>节点形状</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4 }}>
          <FlatButton
            onClick={() => setPendingAddShape('rounded')}
            active={pendingAddShape === 'rounded'}
            style={{ fontSize: 10, padding: "6px 8px", justifyContent: "flex-start" }}>
            ▢ 状态（圆角）
          </FlatButton>
          <FlatButton
            onClick={() => setPendingAddShape('circle')}
            active={pendingAddShape === 'circle'}
            style={{ fontSize: 10, padding: "6px 8px", justifyContent: "flex-start" }}>
            ● 开始/结束
          </FlatButton>
          <FlatButton
            onClick={() => setPendingAddShape('subroutine')}
            active={pendingAddShape === 'subroutine'}
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
  const { pendingAddShape, setPendingAddShape } = useSvgEditorStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 4 }}>参与者形状</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4 }}>
          <FlatButton
            onClick={() => setPendingAddShape('rectangle')}
            active={pendingAddShape === 'rectangle'}
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
      width: 260, background: NEU_BG, borderLeft: PANEL_BORDER,
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
  const { mermaid: code } = useStore();
  const diagramType = getDiagramType(code) || 'flowchart';
  const supported = diagramType === 'flowchart' || diagramType === 'classDiagram' || diagramType === 'stateDiagram' || diagramType === 'sequenceDiagram' || diagramType === 'pie' || diagramType === 'xychart'

  // Resizable column widths
  const containerRef = useRef<HTMLDivElement>(null);
  const [codeW, setCodeW] = useState(0);
  const [previewW, setPreviewW] = useState(0);

  // Initialize widths
  useEffect(() => {
    if (!containerRef.current) return;
    const total = containerRef.current.clientWidth - 12;
    if (codeW === 0) {
      setCodeW(Math.round(total * 0.25));
      setPreviewW(Math.round(total * 0.3));
    }
  }, []);

  return (
    <div style={{ height: "100vh", width: "100vw", overflow: "hidden", display: "flex", background: NEU_BG }}>
      <LeftPanel />
      <div ref={containerRef} style={{ flex: 1, display: "flex", padding: 12, minWidth: 0, overflow: "hidden", gap: 0 }}>
        <CodeEditor widthPx={codeW} />
        <ResizeDivider onDrag={(dx) => setCodeW(w => Math.max(220, w + dx))} />
        <MermaidPreview code={code} widthPx={previewW} />
        <ResizeDivider onDrag={(dx) => setPreviewW(w => Math.max(220, w + dx))} />
        <VisualEditor />
      </div>
      <RightSidebar supported={supported} diagramType={diagramType} />
    </div>
  );
}

export default function EditorApp() {
  return <EditorContent />;
}
