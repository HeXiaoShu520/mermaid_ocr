'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useGraphEditorStore } from '@/lib/graphEditorStore'

export default function NodeEditor() {
  const { editingNodeId, nodes, updateNode, setEditingNode } = useGraphEditorStore()
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const node = nodes.find(n => n.id === editingNodeId)

  useEffect(() => {
    if (node) {
      setText(node.label || '')
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [node])

  const handleSave = useCallback(() => {
    if (node && text.trim()) {
      updateNode(node.id, { label: text.trim() })
    }
    setEditingNode(null)
  }, [node, text, updateNode, setEditingNode])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setEditingNode(null)
    }
  }, [handleSave, setEditingNode])

  if (!node) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
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
        style={{
          width: '100%',
          height: '100%',
          border: '2px solid #3b82f6',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 14,
          textAlign: 'center',
          outline: 'none',
          background: '#fff',
        }}
        autoFocus
      />
    </div>
  )
}
