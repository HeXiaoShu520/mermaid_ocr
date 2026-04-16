'use client'

import { useEffect, useCallback, useState } from 'react'
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
  const tempMermaid = useStore(s => s.tempMermaid)
  const setTempMermaid = useStore(s => s.setTempMermaid)
  const loadToEditor = useStore(s => s.loadToEditor)
  const syncToCode = useStore(s => s.syncToCode)

  const { nodes, edges, subgraphs, initGraph, direction, curveStyle, setDirection, setCurveStyle } = useGraphEditorStore()

  // 专用编辑器的 state
  const [pieDraft, setPieDraft] = useState<{ title: string; data: PieData[] } | null>(null)
  const [xyDraft, setXyDraft] = useState<XyChartData | null>(null)
  const [seqDraft, setSeqDraft] = useState<{ participants: SeqParticipant[]; messages: SeqMessage[] } | null>(null)

  const isEmpty = !tempMermaid.trim()
  const diagramType = getDiagramType(tempMermaid)

  // 加载代码到各个编辑器
  useEffect(() => {
    if (!tempMermaid.trim()) return

    if (diagramType === 'pie') {
      const parsed = parseMermaidPieChart(tempMermaid)
      setPieDraft(parsed)
    } else if (diagramType === 'xychart') {
      const result = parseMermaidXyChart(tempMermaid)
      if (result.data) {
        setXyDraft(result.data)
      }
    } else if (diagramType === 'sequenceDiagram') {
      const parsed = parseSeqData(tempMermaid)
      setSeqDraft(parsed)
    } else if (diagramType === 'flowchart') {
      try {
        const result = importFromCode(tempMermaid, direction)
        initGraph(result.nodes, result.edges, result.layout, result.subgraphs)
        if (result.direction) setDirection(result.direction)
        if (result.curveStyle) setCurveStyle(result.curveStyle)
      } catch (err) {
        console.error('[VisualEditor] 加载失败:', err)
      }
    }
  }, [tempMermaid, diagramType, direction, initGraph])

  // 监听 direction 和 curveStyle 变化，自动同步到代码
  useEffect(() => {
    if (diagramType === 'flowchart' && nodes.length > 0) {
      const code = serializeToMermaid(nodes, edges, direction, subgraphs, curveStyle)
      setTempMermaid(code)
      syncToCode()
    }
  }, [direction, curveStyle])

  // 同步各个编辑器到代码
  const handleSyncToCode = useCallback(() => {
    try {
      let code = ''
      if (diagramType === 'pie' && pieDraft) {
        code = serializePieChart(pieDraft.title, pieDraft.data)
      } else if (diagramType === 'xychart' && xyDraft) {
        code = serializeXyChart(xyDraft)
      } else if (diagramType === 'sequenceDiagram' && seqDraft) {
        code = serializeSeqData(seqDraft.participants, seqDraft.messages)
      } else if (diagramType === 'flowchart') {
        code = serializeToMermaid(nodes, edges, direction, subgraphs, curveStyle)
      }

      if (code) {
        setTempMermaid(code)
        syncToCode()
      }
    } catch (err) {
      console.error('[VisualEditor] 同步失败:', err)
    }
  }, [diagramType, pieDraft, xyDraft, seqDraft, nodes, edges, direction, subgraphs, curveStyle, setTempMermaid, syncToCode])

  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 gap-4">
        <div className="text-gray-500 text-center mb-4">
          <div className="text-lg font-semibold mb-2">可视化编辑区</div>
          <div className="text-sm">点击下方按钮加载代码到编辑器</div>
        </div>
        <button
          onClick={loadToEditor}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-lg flex items-center gap-2"
        >
          <span>📥</span>
          <span>加载代码到编辑器</span>
        </button>
      </div>
    )
  }

  // 专用编辑器
  if (diagramType === 'pie' && pieDraft) {
    return (
      <div className="flex-1 relative">
        <SyncButtons onSync={handleSyncToCode} onReload={loadToEditor} />
        <PieEditor title={pieDraft.title} data={pieDraft.data} onUpdate={(title, data) => setPieDraft({ title, data })} />
      </div>
    )
  }

  if (diagramType === 'xychart' && xyDraft) {
    return (
      <div className="flex-1 relative">
        <SyncButtons onSync={handleSyncToCode} onReload={loadToEditor} />
        <XyChartEditor data={xyDraft} onUpdate={setXyDraft} />
      </div>
    )
  }

  if (diagramType === 'sequenceDiagram' && seqDraft) {
    return (
      <div className="flex-1 relative">
        <SyncButtons onSync={handleSyncToCode} onReload={loadToEditor} />
        <SequenceEditor participants={seqDraft.participants} messages={seqDraft.messages} onUpdate={(p, m) => setSeqDraft({ participants: p, messages: m })} />
      </div>
    )
  }

  // Graph 编辑器（流程图）
  return (
    <div className="flex-1 flex flex-col relative">
      {/* 标题栏 + 操作按钮 */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-gray-50">
        <div className="text-xs font-semibold text-gray-700">画布区</div>
        <button
          onClick={handleSyncToCode}
          className="px-4 py-2 bg-orange-50 border border-orange-300 text-orange-700 rounded text-sm hover:bg-orange-100 transition-colors"
          title="将编辑器的修改同步到代码"
        >
          ⬆️ 同步回代码
        </button>
        <button
          onClick={loadToEditor}
          className="px-4 py-2 bg-cyan-50 border border-cyan-300 text-cyan-700 rounded text-sm hover:bg-cyan-100 transition-colors"
          title="重新从代码加载并自动布局"
        >
          ⬇️ 格式化布局
        </button>
      </div>

      {/* 编辑区内容 */}
      <div className="flex-1 relative">
        <GraphCanvas />
      </div>
    </div>
  )
}

function SyncButtons({ onSync, onReload }: { onSync: () => void; onReload: () => void }) {
  return (
    <div className="absolute top-3 left-3 z-[100] flex gap-2">
      <button
        onClick={onSync}
        className="px-4 py-2 bg-white border border-gray-300 rounded shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        title="将编辑器的修改同步到代码"
      >
        <span>⬆️</span>
        <span>同步到代码</span>
      </button>
      <button
        onClick={onReload}
        className="px-4 py-2 bg-white border border-gray-300 rounded shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        title="重新从代码加载并自动布局"
      >
        <span>⬇️</span>
        <span>格式化布局</span>
      </button>
    </div>
  )
}
