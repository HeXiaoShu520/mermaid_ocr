'use client'

import { useEffect } from 'react'
import { useGraphEditorStore } from '@/lib/graphEditorStore'
import { useAiStore } from '@/lib/aiStore'

export default function GraphContextMenu() {
  const { contextMenu, setContextMenu, removeNode, removeEdge, nodes, subgraphs, removeSubgraph } = useGraphEditorStore()
  const { addContextNode, setIsOpen, insertTextToInput } = useAiStore()

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
    } else if (contextMenu.subgraphId) {
      removeSubgraph(contextMenu.subgraphId)
    }
    setContextMenu(null)
  }

  const handleReferenceToAi = () => {
    if (contextMenu.nodeId) {
      const node = nodes.find((n) => n.id === contextMenu.nodeId)
      if (node) {
        insertTextToInput(`「${node.label}」`)
        setIsOpen(true)
      }
    } else if (contextMenu.subgraphId) {
      const subgraph = subgraphs.find((s) => s.id === contextMenu.subgraphId)
      if (subgraph) {
        const childNodes = nodes.filter((n) => n.subgraph === subgraph.id)
        const childDesc = childNodes.map((n) => `「${n.label}」`).join('、')
        insertTextToInput(`「${subgraph.label}」(包含${childDesc})`)
        setIsOpen(true)
      }
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
      {(contextMenu.nodeId || contextMenu.subgraphId) && (
        <button
          onClick={handleReferenceToAi}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: 13,
            color: '#667eea',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f3ff')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
        >
          <span style={{ display: 'inline-flex' }}>
            <svg width="16" height="16" viewBox="0 0 100 100" style={{ borderRadius: '50%' }}>
              <defs><linearGradient id="ctxAiBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
              <circle cx="50" cy="50" r="50" fill="url(#ctxAiBg)" />
              <circle cx="50" cy="50" r="10" fill="#fff" /><circle cx="50" cy="50" r="6" fill="#6366f1" />
              <circle cx="50" cy="22" r="5" fill="rgba(255,255,255,0.9)" />
              <circle cx="25.8" cy="64" r="5" fill="rgba(255,255,255,0.9)" />
              <circle cx="74.2" cy="64" r="5" fill="rgba(255,255,255,0.9)" />
              <line x1="50" y1="44" x2="50" y2="27" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <line x1="44" y1="53" x2="30.5" y2="61" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <line x1="56" y1="53" x2="69.5" y2="61" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
            </svg>
          </span>
          <span>引用到 AI</span>
        </button>
      )}
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
