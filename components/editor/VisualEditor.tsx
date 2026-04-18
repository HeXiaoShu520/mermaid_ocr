'use client'

import { useCallback, useState } from 'react'
import { useStore } from '@/store/useStore'
import GraphCanvas from './GraphCanvas/GraphCanvas'
import { PieEditor } from './PieEditor'
import { XyChartEditor } from './XyChartEditor'
import { SequenceEditor, type SeqParticipant, type SeqMessage } from './SequenceEditor'
import { getDiagramType } from '@/lib/mermaidCodeEditor'
import { useGraphEditorStore } from '@/lib/graphEditorStore'
import { importFromCode } from '@/lib/graphImporter'
import { serializeToMermaid } from '@/lib/graphSerializer'
import { parseMermaidPieChart, serializePieChart, type PieData } from '@/lib/pieParser'
import { parseMermaidXyChart, serializeXyChart, type XyChartData } from '@/lib/xyChartParser'
import AiChatBox from './AiChatBox'
import { useAiStore } from '@/lib/aiStore'

// 解析时序图数据
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

// 序列化时序图数据
function serializeSeqData(participants: SeqParticipant[], messages: SeqMessage[]): string {
  const lines = ['sequenceDiagram']
  for (const p of participants) lines.push(p.label !== p.id ? `    participant ${p.id} as ${p.label}` : `    participant ${p.id}`)
  for (const m of messages) {
    const conn = m.style === 'solid' ? (m.arrow === 'filled' ? '->>' : m.arrow === 'open' ? '->' : '-)') : (m.arrow === 'filled' ? '-->>' : m.arrow === 'open' ? '-->' : '--)')
    lines.push(`    ${m.from} ${conn} ${m.to}: ${m.label}`)
  }
  return lines.join('\n')
}

export default function VisualEditor() {
  const { nodes, edges, subgraphs, direction, curveStyle } = useGraphEditorStore()

  const diagramType = getDiagramType(useStore.getState().mermaid)

  // 专用编辑器的 state
  const [pieDraft, setPieDraft] = useState<{ title: string; data: PieData[] } | null>(null)
  const [xyDraft, setXyDraft] = useState<XyChartData | null>(null)
  const [seqDraft, setSeqDraft] = useState<{ participants: SeqParticipant[]; messages: SeqMessage[] } | null>(null)

  // 读取代码：清空所有临时信息，从代码重新解析重建
  const handleReadCode = useCallback(() => {
    const code = useStore.getState().mermaid
    if (!code.trim()) return
    const dt = getDiagramType(code)

    // 清空所有临时状态
    setPieDraft(null)
    setXyDraft(null)
    setSeqDraft(null)
    useGraphEditorStore.getState().initGraph([], [], null, [])

    if (dt === 'pie') {
      setPieDraft(parseMermaidPieChart(code))
    } else if (dt === 'xychart') {
      const result = parseMermaidXyChart(code)
      if (result.data) setXyDraft(result.data)
    } else if (dt === 'sequenceDiagram') {
      setSeqDraft(parseSeqData(code))
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

  // 回写代码：从画布生成代码写回
  const handleWriteCode = useCallback(() => {
    const { nodes, edges, subgraphs, direction, curveStyle } = useGraphEditorStore.getState()
    const currentDt = getDiagramType(useStore.getState().mermaid)
    let code = ''

    if (currentDt === 'pie' && pieDraft) {
      code = serializePieChart(pieDraft.title, pieDraft.data)
    } else if (currentDt === 'xychart' && xyDraft) {
      code = serializeXyChart(xyDraft)
    } else if (currentDt === 'sequenceDiagram' && seqDraft) {
      code = serializeSeqData(seqDraft.participants, seqDraft.messages)
    } else {
      code = serializeToMermaid(nodes, edges, direction, subgraphs, curveStyle)
    }

    if (code) {
      useStore.getState().setMermaid(code)
    }
  }, [pieDraft, xyDraft, seqDraft])

  // 专用编辑器
  if (diagramType === 'pie' && pieDraft) {
    return (
      <div className="flex-1 relative">
        <SyncButtons onRead={handleReadCode} onWrite={handleWriteCode} />
        <PieEditor title={pieDraft.title} data={pieDraft.data} onUpdate={(title, data) => setPieDraft({ title, data })} />
      </div>
    )
  }

  if (diagramType === 'xychart' && xyDraft) {
    return (
      <div className="flex-1 relative">
        <SyncButtons onRead={handleReadCode} onWrite={handleWriteCode} />
        <XyChartEditor data={xyDraft} onUpdate={setXyDraft} />
      </div>
    )
  }

  if (diagramType === 'sequenceDiagram' && seqDraft) {
    return (
      <div className="flex-1 relative">
        <SyncButtons onRead={handleReadCode} onWrite={handleWriteCode} />
        <SequenceEditor participants={seqDraft.participants} messages={seqDraft.messages} onUpdate={(p, m) => setSeqDraft({ participants: p, messages: m })} />
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 pointer-events-none gap-2">
            <div style={{ fontSize: 48 }}>🎨</div>
            <div className="text-sm">画布区</div>
            <div className="text-xs text-gray-300">点击「读取代码」加载图表</div>
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
