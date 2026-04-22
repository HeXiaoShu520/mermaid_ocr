import { useCallback, useState } from 'react'
import { useStore } from '@/store/useStore'
import GraphCanvas from './GraphCanvas/GraphCanvas'
import { PieEditor } from './PieEditor'
import { XyChartEditor } from './XyChartEditor'
import { PacketEditor } from './PacketEditor'
import { KanbanEditor } from './KanbanEditor'
import { MindmapEditor } from './MindmapEditor'
import { TimelineEditor } from './TimelineEditor'
import { TreeViewEditor } from './TreeViewEditor'
import { BlockEditor } from './BlockEditor'
import SequenceCanvas from './SequenceCanvas/SequenceCanvas'
import { getDiagramType } from '@/lib/mermaidCodeEditor'
import { useGraphEditorStore } from '@/lib/graphEditorStore'
import { importFromCode } from '@/lib/graphImporter'
import { serializeToMermaid } from '@/lib/graphSerializer'
import { parseMermaidPieChart, serializePieChart, type PieData } from '@/lib/pieParser'
import { parseMermaidXyChart, serializeXyChart, type XyChartData } from '@/lib/xyChartParser'
import { parsePacketDiagram, serializePacketDiagram, type PacketData } from '@/lib/packetParser'
import { parseKanbanDiagram, serializeKanbanDiagram, type KanbanData } from '@/lib/kanbanParser'
import { parseMindmap, serializeMindmap, type MindmapData } from '@/lib/mindmapParser'
import { parseTimelineDiagram, serializeTimelineDiagram, type TimelineData } from '@/lib/timelineParser'
import { parseTreeViewDiagram, serializeTreeViewDiagram, type TreeViewData } from '@/lib/treeViewParser'
import { parseBlockDiagram, serializeBlockDiagram, type BlockData } from '@/lib/blockParser'
import { useSeqEditorStore } from '@/lib/seqEditorStore'
import { parseSeqCode, serializeSeqCode } from '@/lib/seqParser'
import { parseMermaidStateDiagram } from '@/lib/stateParser'
import { serializeStateDiagram } from '@/lib/diagramSerializers'
import AiChatBox from './AiChatBox'
import { dagreLayout } from '@/lib/graphLayout'

export default function VisualEditor() {
  const nodes = useGraphEditorStore(s => s.nodes)

  const mermaidCode = useStore(s => s.mermaid)
  const diagramType = getDiagramType(mermaidCode)

  // 专用编辑器的 state
  const [pieDraft, setPieDraft] = useState<{ title: string; data: PieData[] } | null>(null)
  const [xyDraft, setXyDraft] = useState<XyChartData | null>(null)
  const [packetDraft, setPacketDraft] = useState<PacketData | null>(null)
  const [kanbanDraft, setKanbanDraft] = useState<KanbanData | null>(null)
  const [mindmapDraft, setMindmapDraft] = useState<MindmapData | null>(null)
  const [timelineDraft, setTimelineDraft] = useState<TimelineData | null>(null)
  const [treeViewDraft, setTreeViewDraft] = useState<TreeViewData | null>(null)
  const [blockDraft, setBlockDraft] = useState<BlockData | null>(null)

  // 读取代码
  const handleReadCode = useCallback(() => {
    const code = useStore.getState().mermaid
    if (!code.trim()) return
    const dt = getDiagramType(code)

    // 清空所有临时状态
    setPieDraft(null)
    setXyDraft(null)
    setPacketDraft(null)
    setKanbanDraft(null)
    setMindmapDraft(null)
    setTimelineDraft(null)
    setTreeViewDraft(null)
    setBlockDraft(null)
    useGraphEditorStore.getState().initGraph([], [], null, [])
    useSeqEditorStore.getState().initSeqGraph([], [], [])

    if (dt === 'pie') {
      setPieDraft(parseMermaidPieChart(code))
    } else if (dt === 'xychart') {
      const result = parseMermaidXyChart(code)
      if (result.data) setXyDraft(result.data)
    } else if (dt === 'packet') {
      setPacketDraft(parsePacketDiagram(code))
    } else if (dt === 'kanban') {
      setKanbanDraft(parseKanbanDiagram(code))
    } else if (dt === 'mindmap') {
      setMindmapDraft(parseMindmap(code))
    } else if (dt === 'timeline') {
      setTimelineDraft(parseTimelineDiagram(code))
    } else if (dt === 'treeView') {
      setTreeViewDraft(parseTreeViewDiagram(code))
    } else if (dt === 'block') {
      setBlockDraft(parseBlockDiagram(code))
    } else if (dt === 'sequenceDiagram') {
      const result = parseSeqCode(code)
      useSeqEditorStore.getState().initSeqGraph(result.participants, result.messages, result.fragments)
    } else if (dt === 'stateDiagram') {
      const result = parseMermaidStateDiagram(code)
      if (result.error) {
        console.error('[handleReadCode] 状态图解析失败:', result.error)
      } else {
        // 转换为 LayoutNode 格式（使用 as any 绕过 shape 类型差异）
        const layoutNodes = result.nodes.map(n => ({
          id: n.id,
          label: n.data.label,
          shape: n.data.shape as any,
          x: n.position.x,
          y: n.position.y,
          width: 120,
          height: 40,
        }))
        const layoutEdges = result.edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label as string | undefined,
        }))
        const { initGraph } = useGraphEditorStore.getState()
        initGraph(layoutNodes, layoutEdges, null, [])
      }
    } else if (dt === 'flowchart') {
      try {
        const result = importFromCode(code)
        const { initGraph, setDirection, setCurveStyle } = useGraphEditorStore.getState()
        initGraph(result.nodes, result.edges, result.layout, result.subgraphs)
        if (result.direction) setDirection(result.direction)
        if (result.curveStyle) setCurveStyle(result.curveStyle)
      } catch (err) {
        console.error('[handleReadCode] 加载失败:', err)
      }
    }
  }, [])

  // 回写代码
  const handleWriteCode = useCallback(() => {
    const currentDt = getDiagramType(useStore.getState().mermaid)
    let code = ''

    if (currentDt === 'pie' && pieDraft) {
      code = serializePieChart(pieDraft.title, pieDraft.data)
    } else if (currentDt === 'xychart' && xyDraft) {
      code = serializeXyChart(xyDraft)
    } else if (currentDt === 'packet' && packetDraft) {
      code = serializePacketDiagram(packetDraft)
    } else if (currentDt === 'kanban' && kanbanDraft) {
      code = serializeKanbanDiagram(kanbanDraft)
    } else if (currentDt === 'mindmap' && mindmapDraft) {
      code = serializeMindmap(mindmapDraft)
    } else if (currentDt === 'timeline' && timelineDraft) {
      code = serializeTimelineDiagram(timelineDraft)
    } else if (currentDt === 'treeView' && treeViewDraft) {
      code = serializeTreeViewDiagram(treeViewDraft)
    } else if (currentDt === 'block' && blockDraft) {
      code = serializeBlockDiagram(blockDraft)
    } else if (currentDt === 'sequenceDiagram') {
      const { participants, messages, fragments } = useSeqEditorStore.getState()
      code = serializeSeqCode(participants, messages, fragments)
    } else if (currentDt === 'stateDiagram') {
      const { nodes, edges } = useGraphEditorStore.getState()
      // 转换为 ReactFlow 格式
      const flowNodes = nodes.map(n => ({
        id: n.id,
        type: 'flowNode' as const,
        position: { x: n.x, y: n.y },
        data: { label: n.label, shape: n.shape || 'rounded' },
      }))
      const flowEdges = edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'flowEdge' as const,
        label: e.label,
        data: { edgeStyle: 'solid' as const, arrowType: 'arrow' as const },
      }))
      code = serializeStateDiagram(flowNodes as any, flowEdges as any)
    } else {
      const { nodes, edges, subgraphs, direction, curveStyle } = useGraphEditorStore.getState()
      code = serializeToMermaid(nodes, edges, direction, subgraphs, curveStyle)
    }

    if (code) {
      useStore.getState().setMermaid(code)
    }
  }, [pieDraft, xyDraft, packetDraft, kanbanDraft])

  // 格式化布局：用当前 direction 重新跑 dagre
  const handleRelayout = useCallback(() => {
    const { nodes, edges, subgraphs, direction, setNodes, setSubgraphs } = useGraphEditorStore.getState()
    if (nodes.length === 0) return

    const graphNodes = nodes.map(n => ({ id: n.id, label: n.label, shape: n.shape, subgraph: n.subgraph }))
    const graphEdges = edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: e.label }))
    const layoutResult = dagreLayout(graphNodes, graphEdges, direction)
    setNodes(layoutResult.nodes)

    const updatedSubgraphs = subgraphs.map(sg => {
      const sgNodes = layoutResult.nodes.filter(n => sg.nodes.includes(n.id))
      if (sgNodes.length === 0) return sg
      const minX = Math.min(...sgNodes.map(n => n.x))
      const minY = Math.min(...sgNodes.map(n => n.y))
      const maxX = Math.max(...sgNodes.map(n => n.x + n.width))
      const maxY = Math.max(...sgNodes.map(n => n.y + n.height))
      const padding = 20
      return { ...sg, x: minX - padding, y: minY - padding, width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 }
    })
    setSubgraphs(updatedSubgraphs)
    if (updatedSubgraphs.length > 1) {
      setTimeout(() => useGraphEditorStore.getState().resolveSubgraphOverlaps(), 0)
    }
  }, [])

  // 饼图编辑器
  if (diagramType === 'pie' && pieDraft) {
    return (
      <div className="flex-1 relative">
        <SyncButtons onRead={handleReadCode} onWrite={handleWriteCode} />
        <PieEditor title={pieDraft.title} data={pieDraft.data} onUpdate={(title, data) => setPieDraft({ title, data })} />
      </div>
    )
  }

  // XY 图编辑器
  if (diagramType === 'xychart' && xyDraft) {
    return (
      <div className="flex-1 relative">
        <SyncButtons onRead={handleReadCode} onWrite={handleWriteCode} />
        <XyChartEditor data={xyDraft} onUpdate={setXyDraft} />
      </div>
    )
  }

  // 数据包图编辑器
  if (diagramType === 'packet') {
    return (
      <div className="flex-1 flex flex-col relative">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gray-50">
          <div className="text-xs font-semibold text-gray-700">数据包图</div>
          <button
            onClick={handleReadCode}
            className="px-4 py-2 bg-cyan-50 border border-cyan-300 text-cyan-700 rounded text-sm hover:bg-cyan-100 transition-colors"
            title="从代码重新加载画布"
          >
            ⬇️ 读取代码
          </button>
          <button
            onClick={handleWriteCode}
            className="px-4 py-2 bg-orange-50 border border-orange-300 text-orange-700 rounded text-sm hover:bg-orange-100 transition-colors"
            title="将画布内容写回代码"
          >
            ⬆️ 回写代码
          </button>
        </div>
        <div className="flex-1 relative">
          {packetDraft ? (
            <PacketEditor data={packetDraft} onUpdate={setPacketDraft} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none gap-3">
              <div style={{ fontSize: 72, lineHeight: 1 }}>📦</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>点击"读取代码"加载数据包图</div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 看板图编辑器
  if (diagramType === 'kanban') {
    return (
      <div className="flex-1 flex flex-col relative">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gray-50">
          <div className="text-xs font-semibold text-gray-700">看板图</div>
          <button
            onClick={handleReadCode}
            className="px-4 py-2 bg-cyan-50 border border-cyan-300 text-cyan-700 rounded text-sm hover:bg-cyan-100 transition-colors"
            title="从代码重新加载画布"
          >
            ⬇️ 读取代码
          </button>
          <button
            onClick={handleWriteCode}
            className="px-4 py-2 bg-orange-50 border border-orange-300 text-orange-700 rounded text-sm hover:bg-orange-100 transition-colors"
            title="将画布内容写回代码"
          >
            ⬆️ 回写代码
          </button>
        </div>
        <div className="flex-1 relative">
          {kanbanDraft ? (
            <KanbanEditor data={kanbanDraft} onUpdate={setKanbanDraft} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none gap-3">
              <div style={{ fontSize: 72, lineHeight: 1 }}>📋</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>点击"读取代码"加载看板图</div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 思维导图编辑器
  if (diagramType === 'mindmap') {
    return (
      <div className="flex-1 flex flex-col relative">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gray-50">
          <div className="text-xs font-semibold text-gray-700">思维导图</div>
          <button
            onClick={handleReadCode}
            className="px-4 py-2 bg-cyan-50 border border-cyan-300 text-cyan-700 rounded text-sm hover:bg-cyan-100 transition-colors"
            title="从代码重新加载画布"
          >
            ⬇️ 读取代码
          </button>
          <button
            onClick={handleWriteCode}
            className="px-4 py-2 bg-orange-50 border border-orange-300 text-orange-700 rounded text-sm hover:bg-orange-100 transition-colors"
            title="将画布内容写回代码"
          >
            ⬆️ 回写代码
          </button>
        </div>
        <div className="flex-1 relative">
          {mindmapDraft ? (
            <MindmapEditor data={mindmapDraft} onUpdate={setMindmapDraft} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none gap-3">
              <div style={{ fontSize: 72, lineHeight: 1 }}>🧠</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>点击"读取代码"加载思维导图</div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 时间线编辑器
  if (diagramType === 'timeline') {
    return (
      <div className="flex-1 flex flex-col relative">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gray-50">
          <div className="text-xs font-semibold text-gray-700">时间线</div>
          <button
            onClick={handleReadCode}
            className="px-4 py-2 bg-cyan-50 border border-cyan-300 text-cyan-700 rounded text-sm hover:bg-cyan-100 transition-colors"
            title="从代码重新加载画布"
          >
            ⬇️ 读取代码
          </button>
          <button
            onClick={handleWriteCode}
            className="px-4 py-2 bg-orange-50 border border-orange-300 text-orange-700 rounded text-sm hover:bg-orange-100 transition-colors"
            title="将画布内容写回代码"
          >
            ⬆️ 回写代码
          </button>
        </div>
        <div className="flex-1 relative">
          {timelineDraft ? (
            <TimelineEditor data={timelineDraft} onUpdate={setTimelineDraft} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none gap-3">
              <div style={{ fontSize: 72, lineHeight: 1 }}>📅</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>点击"读取代码"加载时间线</div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 树形图编辑器
  if (diagramType === 'treeView') {
    return (
      <div className="flex-1 flex flex-col relative">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gray-50">
          <div className="text-xs font-semibold text-gray-700">树形图</div>
          <button onClick={handleReadCode} className="px-4 py-2 bg-cyan-50 border border-cyan-300 text-cyan-700 rounded text-sm hover:bg-cyan-100 transition-colors">⬇️ 读取代码</button>
          <button onClick={handleWriteCode} className="px-4 py-2 bg-orange-50 border border-orange-300 text-orange-700 rounded text-sm hover:bg-orange-100 transition-colors">⬆️ 回写代码</button>
        </div>
        <div className="flex-1 relative">
          {treeViewDraft ? (
            <TreeViewEditor data={treeViewDraft} onUpdate={setTreeViewDraft} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none gap-3">
              <div style={{ fontSize: 72, lineHeight: 1 }}>🌳</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>点击"读取代码"加载树形图</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 块图编辑器
  if (diagramType === 'block') {
    return (
      <div className="flex-1 flex flex-col relative">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gray-50">
          <div className="text-xs font-semibold text-gray-700">块图</div>
          <button onClick={handleReadCode} className="px-4 py-2 bg-cyan-50 border border-cyan-300 text-cyan-700 rounded text-sm hover:bg-cyan-100 transition-colors">⬇️ 读取代码</button>
          <button onClick={handleWriteCode} className="px-4 py-2 bg-orange-50 border border-orange-300 text-orange-700 rounded text-sm hover:bg-orange-100 transition-colors">⬆️ 回写代码</button>
        </div>
        <div className="flex-1 relative">
          {blockDraft ? (
            <BlockEditor data={blockDraft} onUpdate={setBlockDraft} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none gap-3">
              <div style={{ fontSize: 72, lineHeight: 1 }}>🧱</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>点击"读取代码"加载块图</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 时序图编辑器（新版）— 只要代码类型是 sequenceDiagram 就显示
  if (diagramType === 'sequenceDiagram') {
    return (
      <div className="flex-1 flex flex-col relative">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gray-50">
          <div className="text-xs font-semibold text-gray-700">时序图画布</div>
          <button
            onClick={handleReadCode}
            className="px-4 py-2 bg-cyan-50 border border-cyan-300 text-cyan-700 rounded text-sm hover:bg-cyan-100 transition-colors"
            title="从代码重新加载画布"
          >
            ⬇️ 读取代码
          </button>
          <button
            onClick={handleWriteCode}
            className="px-4 py-2 bg-orange-50 border border-orange-300 text-orange-700 rounded text-sm hover:bg-orange-100 transition-colors"
            title="将画布内容写回代码"
          >
            ⬆️ 回写代码
          </button>
        </div>
        <div className="flex-1 relative">
          <SequenceCanvas />
          <AiChatBox />
        </div>
      </div>
    )
  }

  // 状态图编辑器
  if (diagramType === 'stateDiagram') {
    return (
      <div className="flex-1 flex flex-col relative">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gray-50">
          <div className="text-xs font-semibold text-gray-700">状态图画布</div>
          <button
            onClick={handleReadCode}
            className="px-4 py-2 bg-cyan-50 border border-cyan-300 text-cyan-700 rounded text-sm hover:bg-cyan-100 transition-colors"
            title="从代码重新加载画布"
          >
            ⬇️ 读取代码
          </button>
          <button
            onClick={handleWriteCode}
            className="px-4 py-2 bg-orange-50 border border-orange-300 text-orange-700 rounded text-sm hover:bg-orange-100 transition-colors"
            title="将画布内容写回代码"
          >
            ⬆️ 回写代码
          </button>
          <button
            onClick={handleRelayout}
            className="px-4 py-2 bg-purple-50 border border-purple-300 text-purple-700 rounded text-sm hover:bg-purple-100 transition-colors"
            title="重新计算节点布局"
          >
            🔄 格式化布局
          </button>
        </div>
        <div className="flex-1 relative">
          <GraphCanvas />
          {!nodes.length && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none gap-3">
              <div style={{ fontSize: 72, lineHeight: 1 }}>🔄</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>点击"读取代码"加载状态图</div>
              </div>
            </div>
          )}
          <AiChatBox />
        </div>
      </div>
    )
  }

  // 流程图编辑器
  const hasNodes = nodes.length > 0

  return (
    <div className="flex-1 flex flex-col relative">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gray-50">
        <div className="text-xs font-semibold text-gray-700">画布区</div>
        <button
          onClick={handleReadCode}
          className="px-4 py-2 bg-cyan-50 border border-cyan-300 text-cyan-700 rounded text-sm hover:bg-cyan-100 transition-colors"
          title="从代码重新加载画布"
        >
          ⬇️ 读取代码
        </button>
        <button
          onClick={handleWriteCode}
          className="px-4 py-2 bg-orange-50 border border-orange-300 text-orange-700 rounded text-sm hover:bg-orange-100 transition-colors"
          title="将画布内容写回代码"
        >
          ⬆️ 回写代码
        </button>
        <button
          onClick={handleRelayout}
          className="px-4 py-2 bg-purple-50 border border-purple-300 text-purple-700 rounded text-sm hover:bg-purple-100 transition-colors"
          title="重新计算节点和子图布局"
        >
          🔄 格式化布局
        </button>
      </div>
      <div className="flex-1 relative">
        <GraphCanvas />
        {!hasNodes && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none gap-3">
            <div style={{ fontSize: 72, lineHeight: 1 }}>🎨</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#6b7280" }}>画布区</div>
            </div>
          </div>
        )}
        <AiChatBox />
      </div>
    </div>
  )
}

function SyncButtons({ onRead, onWrite }: { onRead: () => void; onWrite: () => void }) {
  return (
    <div className="absolute top-3 left-3 z-[100] flex gap-2">
      <button
        onClick={onRead}
        className="px-4 py-2 bg-white border border-gray-300 rounded shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        title="从代码重新加载画布"
      >
        <span>⬇️</span>
        <span>读取代码</span>
      </button>
      <button
        onClick={onWrite}
        className="px-4 py-2 bg-white border border-gray-300 rounded shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        title="将画布内容写回代码"
      >
        <span>⬆️</span>
        <span>回写代码</span>
      </button>
    </div>
  )
}
