'use client'

import { useEffect } from 'react'
import { useGraphEditorStore } from '@/lib/graphEditorStore'

export default function GraphContextMenu() {
  const { contextMenu, setContextMenu, removeNode, removeEdge } = useGraphEditorStore()

  useEffect(() => {
    if (!contextMenu) return

    const handleClick = () => setContextMenu(null)
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [contextMenu, setContextMenu])

  if (!contextMenu) return null

  const handleDelete = () => {
    if (contextMenu.nodeId) {
      removeNode(contextMenu.nodeId)
    } else if (contextMenu.edgeId) {
      removeEdge(contextMenu.edgeId)
    }
    setContextMenu(null)
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: contextMenu.x,
        top: contextMenu.y,
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000,
        minWidth: 120,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={handleDelete}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: 'none',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: 13,
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
      >
        <span>🗑️</span>
        <span>删除</span>
      </button>
    </div>
  )
}
