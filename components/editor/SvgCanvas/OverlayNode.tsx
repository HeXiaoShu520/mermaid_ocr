'use client'

import { useCallback, useRef, useState } from 'react'
import { useSvgEditorStore, type NodeState, type HandleDir } from '@/lib/svgEditorStore'

interface OverlayNodeProps {
  node: NodeState
  viewTransform: { x: number; y: number; scale: number }
  onDragStart: (nodeId: string, startX: number, startY: number) => void
  onDragMove: (nodeId: string, dx: number, dy: number) => void
  onDragEnd: (nodeId: string) => void
}

export default function OverlayNode({
  node,
  viewTransform,
  onDragStart,
  onDragMove,
  onDragEnd,
}: OverlayNodeProps) {
  const {
    selectedNodeIds,
    selectNode,
    setEditingNode,
    setContextMenu,
    hoveredNodeId,
    setHoveredNodeId,
    connecting,
    startConnection,
  } = useSvgEditorStore()

  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 })

  const isSelected = selectedNodeIds.has(node.id)
  const isHovered = hoveredNodeId === node.id

  // ─── Drag Handlers ───

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return // 只响应左键
    if (connecting) return // 连线模式下不拖拽

    e.stopPropagation()

    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    }

    onDragStart(node.id, node.x, node.y)

    // 选中节点
    if (!isSelected) {
      selectNode(node.id, e.ctrlKey || e.metaKey)
    }
  }, [node, connecting, isSelected, selectNode, onDragStart])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return

    const dx = (e.clientX - dragStartRef.current.x) / viewTransform.scale
    const dy = (e.clientY - dragStartRef.current.y) / viewTransform.scale

    onDragMove(node.id, dx, dy)
  }, [isDragging, node.id, viewTransform.scale, onDragMove])

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    onDragEnd(node.id)
  }, [isDragging, node.id, onDragEnd])

  // 全局监听 mousemove 和 mouseup
  useState(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  })

  // ─── Click Handlers ───

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selectNode(node.id, e.ctrlKey || e.metaKey)
  }, [node.id, selectNode])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingNode(node.id)
  }, [node.id, setEditingNode])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, nodeId: node.id })
  }, [node.id, setContextMenu])

  // ─── Handle Connection ───

  const handleHandleMouseDown = useCallback((e: React.MouseEvent, handle: HandleDir) => {
    e.stopPropagation()
    startConnection(node.id, handle)
  }, [node.id, startConnection])

  // ─── Render ───

  const showHandles = isSelected || isHovered

  return (
    <>
      {/* 节点方块 */}
      <div
        style={{
          position: 'absolute',
          left: node.x - node.width / 2,
          top: node.y - node.height / 2,
          width: node.width,
          height: node.height,
          border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
          borderRadius: 4,
          cursor: isDragging ? 'grabbing' : 'grab',
          pointerEvents: 'auto',
          backgroundColor: isHovered ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
          transition: isSelected ? 'none' : 'background-color 0.15s',
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHoveredNodeId(node.id)}
        onMouseLeave={() => setHoveredNodeId(null)}
      />

      {/* Handles (连接点) */}
      {showHandles && (
        <>
          {(['top', 'bottom', 'left', 'right'] as HandleDir[]).map((dir) => {
            const handlePos = getHandlePosition(node, dir)
            return (
              <div
                key={dir}
                style={{
                  position: 'absolute',
                  left: handlePos.x - 6,
                  top: handlePos.y - 6,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  border: '2px solid white',
                  cursor: 'crosshair',
                  pointerEvents: 'auto',
                  zIndex: 10,
                }}
                onMouseDown={(e) => handleHandleMouseDown(e, dir)}
              />
            )
          })}
        </>
      )}
    </>
  )
}

// ─── Helper ───

function getHandlePosition(node: NodeState, dir: HandleDir): { x: number; y: number } {
  const { x, y, width, height } = node
  switch (dir) {
    case 'top':
      return { x, y: y - height / 2 }
    case 'bottom':
      return { x, y: y + height / 2 }
    case 'left':
      return { x: x - width / 2, y }
    case 'right':
      return { x: x + width / 2, y }
  }
}
