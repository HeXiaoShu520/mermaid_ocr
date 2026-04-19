'use client'

import { useCallback, useState } from 'react'
import { useStore } from '@/store/useStore'
import GraphCanvas from './GraphCanvas/GraphCanvas'
import { PieEditor } from './PieEditor'
import { XyChartEditor } from './XyChartEditor'
import SequenceCanvas from './SequenceCanvas/SequenceCanvas'
import { getDiagramType } from '@/lib/mermaidCodeEditor'
import { useGraphEditorStore } from '@/lib/graphEditorStore'
import { importFromCode } from '@/lib/graphImporter'
import { serializeToMermaid } from '@/lib/graphSerializer'
import { parseMermaidPieChart, serializePieChart, type PieData } from '@/lib/pieParser'
import { parseMermaidXyChart, serializeXyChart, type XyChartData } from '@/lib/xyChartParser'
import { useSeqEditorStore } from '@/lib/seqEditorStore'
import { parseSeqCode, serializeSeqCode } from '@/lib/seqParser'
import AiChatBox from './AiChatBox'

export default function VisualEditor() {
  const nodes = useGraphEditorStore(s => s.nodes)

  const diagramType = getDiagramType(useStore.getState().mermaid)

  // 专用编辑器的 state（饼图、XY 图仍用本地 state）
  const [pieDraft, setPieDraft] = useState<{ title: string; data: PieData[] } | null>(null)
  const [xyDraft, setXyDraft] = useState<XyChartData | null>(null)

  // 读取代码
  const handleReadCode = useCallback(() => {
    const code = useStore.getState().mermaid
    if (!code.trim()) return
    const dt = getDiagramType(code)

    // 清空所有临时状态
    setPieDraft(null)
    setXyDraft(null)
    useGraphEditorStore.getState().initGraph([], [], null, [])
    useSeqEditorStore.getState().initSeqGraph([], [], [])

    if (dt === 'pie') {
      setPieDraft(parseMermaidPieChart(code))
    } else if (dt === 'xychart') {
      const result = parseMermaidXyChart(code)
      if (result.data) setXyDraft(result.data)
    } else if (dt === 'sequenceDiagram') {
      const result = parseSeqCode(code)
      useSeqEditorStore.getState().initSeqGraph(result.participants, result.messages, result.fragments)
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
    } else if (currentDt === 'sequenceDiagram') {
      const { participants, messages, fragments } = useSeqEditorStore.getState()
      code = serializeSeqCode(participants, messages, fragments)
    } else {
      const { nodes, edges, subgraphs, direction, curveStyle } = useGraphEditorStore.getState()
      code = serializeToMermaid(nodes, edges, direction, subgraphs, curveStyle)
    }

    if (code) {
      useStore.getState().setMermaid(code)
    }
  }, [pieDraft, xyDraft])

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
