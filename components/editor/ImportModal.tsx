'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseMermaidFlowchart } from '@/lib/parser'
import type { ParseResult } from '@/lib/parser'
import { useFlowStore } from '@/lib/flowStore'

interface ImportModalProps {
  onClose: () => void
}

export function ImportModal({ onClose }: ImportModalProps) {
  const importDiagram = useFlowStore((s) => s.importDiagram)
  const [value, setValue] = useState('')
  const [result, setResult] = useState<ParseResult | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Live parse feedback with 300ms debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(null);
      return
    }
    debounceRef.current = setTimeout(() => {
      setResult(parseMermaidFlowchart(value))
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [value])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleImport = useCallback(() => {
    if (!result || result.error) return
    const { nodes, edges, direction, theme, look, curveStyle } = result
    importDiagram(nodes, edges, { direction, theme, look, curveStyle })
    onClose()
  }, [result, importDiagram, onClose])

  const canImport = result !== null && result.error === null && result.nodes.length > 0

  const statusText = () => {
    if (!value.trim()) return null
    if (!result) return <span className="text-gray-400">解析中…</span>
    if (result.error) return <span className="text-red-500">{result.error}</span>
    return (
      <span className="text-emerald-600">
        检测到 {result.nodes.length} 个节点，{result.edges.length} 条边
      </span>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-[580px] max-h-[85vh] flex flex-col border border-gray-200/60"
        role="dialog"
        aria-labelledby="import-modal-title"
        aria-describedby="import-modal-desc"
        aria-modal="true"
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 id="import-modal-title" className="text-sm font-semibold text-gray-900">导入 Mermaid 语法</h2>
            <p id="import-modal-desc" className="text-xs text-gray-400 mt-0.5">粘贴流程图定义以加载到画布</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        {/* Textarea */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 w-full font-mono text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-lg p-3 resize-none outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={`flowchart TD\n  A["开始"] --> B{"决策?"}\n  B --> |"是"| C["执行"]\n  B --> |"否"| D["跳过"]`}
            spellCheck={false}
            rows={14}
            aria-label="Mermaid 语法"
          />
          <div className="text-xs min-h-[16px]" aria-live="polite">{statusText()}</div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={!canImport}
            className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            导入到画布
          </button>
        </div>
      </div>
    </div>
  )
}
