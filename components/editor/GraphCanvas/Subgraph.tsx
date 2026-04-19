'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { useGraphEditorStore, type SubgraphState, type NodeState } from '@/lib/graphEditorStore'

interface SubgraphProps {
  subgraph: SubgraphState
  nodes: NodeState[]
  viewTransform: { x: number; y: number; scale: number }
}

export default function Subgraph({ subgraph, nodes, viewTransform }: SubgraphProps) {
  const { selectedSubgraphId, selectSubgraph, moveSubgraph, setContextMenu, resizeSubgraph } = useGraphEditorStore()

  const isSelected = selectedSubgraphId === subgraph.id
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDir, setResizeDir] = useState<string | null>(null)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, sgX: 0, sgY: 0, sgW: 0, sgH: 0 })

  // 使用子图自身存储的尺寸
  const bounds = subgraph.x !== undefined && subgraph.y !== undefined && subgraph.width !== undefined && subgraph.height !== undefined
    ? { x: subgraph.x, y: subgraph.y, width: subgraph.width, height: subgraph.height }
    : null

  // ─── Drag Handlers (标题栏拖拽) ───

  const handleTitleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    selectSubgraph(subgraph.id)
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }, [subgraph.id, selectSubgraph])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const dx = (e.clientX - dragStartRef.current.x) / viewTransform.scale
      const dy = (e.clientY - dragStartRef.current.y) / viewTransform.scale
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        moveSubgraph(subgraph.id, dx, dy)
        dragStartRef.current = { x: e.clientX, y: e.clientY }
      }
    }
    if (isResizing && resizeDir && bounds) {
      const dx = (e.clientX - resizeStartRef.current.x) / viewTransform.scale
      const dy = (e.clientY - resizeStartRef.current.y) / viewTransform.scale
      const { sgX, sgY, sgW, sgH } = resizeStartRef.current

      let newX = sgX, newY = sgY, newW = sgW, newH = sgH

      if (resizeDir.includes('e')) newW = sgW + dx
      if (resizeDir.includes('w')) { newX = sgX + dx; newW = sgW - dx }
      if (resizeDir.includes('s')) newH = sgH + dy
      if (resizeDir.includes('n')) { newY = sgY + dy; newH = sgH - dy }

      // 最小尺寸
      if (newW < 80) { if (resizeDir.includes('w')) newX = sgX + sgW - 80; newW = 80 }
      if (newH < 60) { if (resizeDir.includes('n')) newY = sgY + sgH - 60; newH = 60 }

      resizeSubgraph(subgraph.id, { x: newX, y: newY, width: newW, height: newH })
    }
  }, [isDragging, isResizing, resizeDir, viewTransform.scale, subgraph.id, moveSubgraph, resizeSubgraph, bounds])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
    setResizeDir(null)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, subgraphId: subgraph.id })
  }, [subgraph.id, setContextMenu])

  const handleBodyClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selectSubgraph(subgraph.id)
  }, [subgraph.id, selectSubgraph])

  // ─── Resize Handlers ───

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, dir: string) => {
    e.stopPropagation()
    e.preventDefault()
    if (!bounds) return
    selectSubgraph(subgraph.id)
    setIsResizing(true)
    setResizeDir(dir)
    resizeStartRef.current = {
      x: e.clientX, y: e.clientY,
      sgX: bounds.x, sgY: bounds.y, sgW: bounds.width, sgH: bounds.height,
    }
  }, [bounds, subgraph.id, selectSubgraph])

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

  if (!bounds) return null

  const resizeHandleStyle = (cursor: string): React.CSSProperties => ({
    position: 'absolute',
    background: '#fff',
    border: '1.5px solid #3b82f6',
    pointerEvents: 'auto',
    cursor,
    zIndex: 2,
  })

  return (
    <div
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        border: isSelected ? '2px solid #3b82f6' : '2px dashed #9ca3af',
        borderRadius: 8,
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'rgba(243, 244, 246, 0.3)',
        pointerEvents: 'auto',
        zIndex: 0,
        boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        transition: (isDragging || isResizing) ? 'none' : 'border-color 0.15s, background-color 0.15s',
      }}
      onMouseDown={handleTitleMouseDown}
      onClick={handleBodyClick}
      onContextMenu={handleContextMenu}
    >
      {/* 子图标题栏 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 30,
          display: 'flex',
          alignItems: 'center',
          padding: '0 12px',
          userSelect: 'none',
          borderBottom: 'none',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isSelected ? '#3b82f6' : '#4b5563',
            pointerEvents: 'none',
          }}
        >
          {subgraph.label}
        </span>
      </div>

      {/* Resize Handles（选中时显示） */}
      {isSelected && (
        <>
          {/* 四角 */}
          <div style={{ ...resizeHandleStyle('nwse-resize'), left: -4, top: -4, width: 8, height: 8 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')} />
          <div style={{ ...resizeHandleStyle('nesw-resize'), right: -4, top: -4, width: 8, height: 8 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')} />
          <div style={{ ...resizeHandleStyle('nesw-resize'), left: -4, bottom: -4, width: 8, height: 8 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')} />
          <div style={{ ...resizeHandleStyle('nwse-resize'), right: -4, bottom: -4, width: 8, height: 8 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')} />
          {/* 四边 */}
          <div style={{ ...resizeHandleStyle('ns-resize'), left: '50%', marginLeft: -15, top: -4, width: 30, height: 8 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'n')} />
          <div style={{ ...resizeHandleStyle('ns-resize'), left: '50%', marginLeft: -15, bottom: -4, width: 30, height: 8 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 's')} />
          <div style={{ ...resizeHandleStyle('ew-resize'), left: -4, top: '50%', marginTop: -15, width: 8, height: 30 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'w')} />
          <div style={{ ...resizeHandleStyle('ew-resize'), right: -4, top: '50%', marginTop: -15, width: 8, height: 30 }}
            onMouseDown={(e) => handleResizeMouseDown(e, 'e')} />
        </>
      )}
    </div>
  )
}
