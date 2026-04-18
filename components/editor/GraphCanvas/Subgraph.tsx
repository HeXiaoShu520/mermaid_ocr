'use client'

import { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import { useGraphEditorStore, type SubgraphState, type NodeState } from '@/lib/graphEditorStore'

interface SubgraphProps {
  subgraph: SubgraphState
  nodes: NodeState[]
  viewTransform: { x: number; y: number; scale: number }
}

export default function Subgraph({ subgraph, nodes, viewTransform }: SubgraphProps) {
  const { selectedSubgraphId, selectSubgraph, moveSubgraph, clearSelection, setContextMenu } = useGraphEditorStore()

  const isSelected = selectedSubgraphId === subgraph.id
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  // 计算子图的边界框
  const bounds = useMemo(() => {
    const subgraphNodes = nodes.filter(n => n.subgraph === subgraph.id)
    if (subgraphNodes.length === 0) return null

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    subgraphNodes.forEach(node => {
      minX = Math.min(minX, node.x)
      minY = Math.min(minY, node.y)
      maxX = Math.max(maxX, node.x + node.width)
      maxY = Math.max(maxY, node.y + node.height)
    })

    const padding = 20
    return {
      x: minX - padding,
      y: minY - padding - 30,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2 + 30,
    }
  }, [subgraph.id, nodes])

  // ─── Drag Handlers ───

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()

    selectSubgraph(subgraph.id)
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY }
  }, [subgraph.id, selectSubgraph])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const dx = (e.clientX - dragStartRef.current.x) / viewTransform.scale
    const dy = (e.clientY - dragStartRef.current.y) / viewTransform.scale

    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      moveSubgraph(subgraph.id, dx, dy)
      dragStartRef.current = { x: e.clientX, y: e.clientY }
    }
  }, [isDragging, viewTransform.scale, subgraph.id, moveSubgraph])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, subgraphId: subgraph.id })
  }, [subgraph.id, setContextMenu])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  if (!bounds) return null

  return (
    <div
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        border: isSelected ? '2px solid #3b82f6' : '2px solid #9ca3af',
        borderRadius: 8,
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'rgba(243, 244, 246, 0.5)',
        pointerEvents: 'auto',
        cursor: isDragging ? 'grabbing' : 'grab',
        zIndex: 0,
        boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
        transition: isDragging ? 'none' : 'border-color 0.15s, background-color 0.15s',
      }}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      {/* 子图标题 */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          fontSize: 14,
          fontWeight: 600,
          color: isSelected ? '#3b82f6' : '#4b5563',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {subgraph.label}
      </div>
    </div>
  )
}
