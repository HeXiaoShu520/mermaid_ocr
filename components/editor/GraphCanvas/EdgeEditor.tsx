'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGraphEditorStore } from '@/lib/graphEditorStore'

export default function EdgeEditor() {
  const { editingEdgeId, edges, nodes, updateEdge, setEditingEdge } = useGraphEditorStore()
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const edge = edges.find(e => e.id === editingEdgeId)
  const sourceNode = nodes.find(n => n.id === edge?.source)
  const targetNode = nodes.find(n => n.id === edge?.target)

  useEffect(() => {
    if (edge) {
      setText(edge.label || '')
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [edge])

  const handleSave = useCallback(() => {
    if (edge) {
      updateEdge(edge.id, { label: text.trim() })
    }
    setEditingEdge(null)
  }, [edge, text, updateEdge, setEditingEdge])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setEditingEdge(null)
    }
  }, [handleSave, setEditingEdge])

  if (!edge || !sourceNode || !targetNode) return null

  // 计算边的中点位置
  const midX = (sourceNode.x + sourceNode.width / 2 + targetNode.x + targetNode.width / 2) / 2
  const midY = (sourceNode.y + sourceNode.height / 2 + targetNode.y + targetNode.height / 2) / 2

  return (
    <div
      style={{
        position: 'absolute',
        left: midX - 60,
        top: midY - 15,
        width: 120,
        height: 30,
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        placeholder="标签"
        style={{
          width: '100%',
          height: '100%',
          border: '2px solid #3b82f6',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 12,
          textAlign: 'center',
          outline: 'none',
          background: '#fff',
        }}
        autoFocus
      />
    </div>
  )
}
