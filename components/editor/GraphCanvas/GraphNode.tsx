'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import { useGraphEditorStore, type NodeState } from '@/lib/graphEditorStore'

interface GraphNodeProps {
  node: NodeState
  viewTransform: { x: number; y: number; scale: number }
  onDragStart: (nodeId: string) => void
  onDragMove: (nodeId: string, dx: number, dy: number) => void
  onDragEnd: (nodeId: string) => void
}

export default function GraphNode({
  node,
  viewTransform,
  onDragStart,
  onDragMove,
  onDragEnd,
}: GraphNodeProps) {
  const {
    selectedNodeIds,
    selectNode,
    setEditingNode,
    setContextMenu,
    hoveredNodeId,
    setHoveredNodeId,
    connecting,
    startConnection,
  } = useGraphEditorStore()

  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [resizeDir, setResizeDir] = useState<'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null>(null)
  const dragStartRef = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0 })
  const resizeStartRef = useRef({ x: 0, y: 0, nodeX: 0, nodeY: 0, nodeW: 0, nodeH: 0 })

  const isSelected = selectedNodeIds.has(node.id)
  const isHovered = hoveredNodeId === node.id

  // ─── Drag Handlers ───

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (connecting) return

    e.stopPropagation()

    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
    }

    onDragStart(node.id)

    if (!isSelected) {
      selectNode(node.id, e.ctrlKey || e.metaKey)
    }
  }, [node, connecting, isSelected, selectNode, onDragStart])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const dx = (e.clientX - dragStartRef.current.x) / viewTransform.scale
      const dy = (e.clientY - dragStartRef.current.y) / viewTransform.scale

      const newX = dragStartRef.current.nodeX + dx
      const newY = dragStartRef.current.nodeY + dy

      onDragMove(node.id, newX, newY)
    } else if (isResizing && resizeDir) {
      const dx = (e.clientX - resizeStartRef.current.x) / viewTransform.scale
      const dy = (e.clientY - resizeStartRef.current.y) / viewTransform.scale

      const { updateNode } = useGraphEditorStore.getState()
      let newX = resizeStartRef.current.nodeX
      let newY = resizeStartRef.current.nodeY
      let newW = resizeStartRef.current.nodeW
      let newH = resizeStartRef.current.nodeH

      // 根据调整方向计算新的位置和大小
      if (resizeDir.includes('n')) {
        newY = resizeStartRef.current.nodeY + dy
        newH = resizeStartRef.current.nodeH - dy
      }
      if (resizeDir.includes('s')) {
        newH = resizeStartRef.current.nodeH + dy
      }
      if (resizeDir.includes('w')) {
        newX = resizeStartRef.current.nodeX + dx
        newW = resizeStartRef.current.nodeW - dx
      }
      if (resizeDir.includes('e')) {
        newW = resizeStartRef.current.nodeW + dx
      }

      // 限制最小尺寸
      if (newW < 40) newW = 40
      if (newH < 30) newH = 30

      updateNode(node.id, { x: newX, y: newY, width: newW, height: newH })
    }
  }, [isDragging, isResizing, resizeDir, node.id, viewTransform.scale, onDragMove])

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      onDragEnd(node.id)
    }
    if (isResizing) {
      setIsResizing(false)
      setResizeDir(null)
    }
  }, [isDragging, isResizing, node.id, onDragEnd])

  // 全局监听 mousemove 和 mouseup
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

  // ─── Click Handlers ───

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()

    // 如果正在连线，点击节点完成连接
    if (connecting && connecting.sourceId !== node.id) {
      const { endConnection } = useGraphEditorStore.getState()
      endConnection(node.id)
      return
    }

    selectNode(node.id, e.ctrlKey || e.metaKey)
  }, [node.id, connecting, selectNode])

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

  const handleHandleMouseDown = useCallback((e: React.MouseEvent, handle: 'top' | 'bottom' | 'left' | 'right') => {
    e.stopPropagation()
    e.preventDefault()
    startConnection(node.id, handle)
  }, [node.id, startConnection])

  // ─── Resize Handlers ───

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw') => {
    e.stopPropagation()
    e.preventDefault()

    setIsResizing(true)
    setResizeDir(dir)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      nodeX: node.x,
      nodeY: node.y,
      nodeW: node.width,
      nodeH: node.height,
    }
  }, [node])

  // 当鼠标进入节点时，如果正在连线，则自动完成连接
  const handleMouseEnter = useCallback(() => {
    setHoveredNodeId(node.id)

    const state = useGraphEditorStore.getState()
    if (state.connecting && state.connecting.sourceId !== node.id) {
      // 自动完成连接
      state.endConnection(node.id)
    }
  }, [node.id, setHoveredNodeId])

  const handleMouseLeave = useCallback(() => {
    setHoveredNodeId(null)
  }, [setHoveredNodeId])

  // ─── Render ───

  const showHandles = isSelected || isHovered

  // 根据形状决定渲染方式
  const renderNodeShape = () => {
    const fillColor = node.fillColor || '#fff'
    const strokeColor = node.strokeColor || (isSelected ? '#3b82f6' : '#333')
    const textColor = node.textColor || '#000'
    const strokeWidth = isSelected ? 2 : 1

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: node.x,
      top: node.y,
      width: node.width,
      height: node.height,
      border: `${strokeWidth}px solid ${strokeColor}`,
      backgroundColor: fillColor,
      color: textColor,
      cursor: isDragging ? 'grabbing' : 'grab',
      pointerEvents: 'auto',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 14,
      userSelect: 'none',
      boxShadow: isHovered ? '0 2px 8px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.1)',
      transition: isSelected ? 'none' : 'box-shadow 0.15s',
    }

    // 文本样式（用于 SVG 形状中的文本）
    const textStyle: React.CSSProperties = {
      position: 'relative',
      zIndex: 1,
      color: textColor,
      userSelect: 'none',
      pointerEvents: 'none',
    }

    const shape = node.shape || 'rectangle'

    switch (shape) {
      case 'comment':
        return (
          <div style={{
            ...baseStyle,
            border: 'none',
            background: 'transparent',
            boxShadow: 'none',
            fontSize: 16,
            fontWeight: 500,
          }}>
            {node.label}
          </div>
        )
      case 'rounded':
        return <div style={{ ...baseStyle, borderRadius: 20 }}>{node.label}</div>
      case 'stadium':
        return <div style={{ ...baseStyle, borderRadius: node.height / 2 }}>{node.label}</div>
      case 'circle':
        return <div style={{ ...baseStyle, borderRadius: '50%' }}>{node.label}</div>
      case 'diamond':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`${node.width / 2},0 ${node.width},${node.height / 2} ${node.width / 2},${node.height} 0,${node.height / 2}`}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'hexagon':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`${node.width * 0.25},0 ${node.width * 0.75},0 ${node.width},${node.height / 2} ${node.width * 0.75},${node.height} ${node.width * 0.25},${node.height} 0,${node.height / 2}`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'parallelogram':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`${node.width * 0.2},0 ${node.width},0 ${node.width * 0.8},${node.height} 0,${node.height}`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'trapezoid':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`0,${node.height} ${node.width},${node.height} ${node.width * 0.9},0 ${node.width * 0.1},0`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'cylindrical':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <ellipse
                cx={node.width / 2}
                cy={node.height * 0.15}
                rx={node.width / 2}
                ry={node.height * 0.15}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <rect
                x={0}
                y={node.height * 0.15}
                width={node.width}
                height={node.height * 0.7}
                fill="#fff"
                stroke="none"
              />
              <line
                x1={0}
                y1={node.height * 0.15}
                x2={0}
                y2={node.height * 0.85}
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <line
                x1={node.width}
                y1={node.height * 0.15}
                x2={node.width}
                y2={node.height * 0.85}
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <ellipse
                cx={node.width / 2}
                cy={node.height * 0.85}
                rx={node.width / 2}
                ry={node.height * 0.15}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'subroutine':
        return (
          <div style={{ ...baseStyle, borderRadius: 4 }}>
            <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, borderLeft: isSelected ? '2px solid #3b82f6' : '1px solid #333' }} />
            <div style={{ position: 'absolute', right: 8, top: 0, bottom: 0, borderRight: isSelected ? '2px solid #3b82f6' : '1px solid #333' }} />
            {node.label}
          </div>
        )
      case 'triangle':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`${node.width / 2},0 ${node.width},${node.height} 0,${node.height}`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'parallelogram-alt':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`0,0 ${node.width * 0.8},0 ${node.width},${node.height} ${node.width * 0.2},${node.height}`}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'trapezoid-alt':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`${node.width * 0.2},0 ${node.width * 0.8},0 ${node.width},${node.height} 0,${node.height}`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )







      case 'hourglass':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`0,0 ${node.width},0 0,${node.height} ${node.width},${node.height}`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )




      case 'flag':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`0,0 ${node.width * 0.8},0 ${node.width},${node.height / 2} ${node.width * 0.8},${node.height} 0,${node.height}`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'cloud':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <path
                d={`M${node.width * 0.25},${node.height * 0.75} C${node.width * 0.1},${node.height * 0.75} ${node.width * 0.1},${node.height * 0.5} ${node.width * 0.2},${node.height * 0.4} C${node.width * 0.15},${node.height * 0.2} ${node.width * 0.3},${node.height * 0.1} ${node.width * 0.4},${node.height * 0.15} C${node.width * 0.5},${node.height * 0.05} ${node.width * 0.7},${node.height * 0.05} ${node.width * 0.75},${node.height * 0.15} C${node.width * 0.9},${node.height * 0.1} ${node.width * 0.95},${node.height * 0.3} ${node.width * 0.85},${node.height * 0.4} C${node.width * 0.95},${node.height * 0.55} ${node.width * 0.9},${node.height * 0.75} ${node.width * 0.75},${node.height * 0.75} Z`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )

      case 'h-cyl':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <ellipse
                cx={node.width * 0.15}
                cy={node.height / 2}
                rx={node.width * 0.15}
                ry={node.height / 2}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <line
                x1={node.width * 0.15}
                y1={0}
                x2={node.width * 0.85}
                y2={0}
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <line
                x1={node.width * 0.15}
                y1={node.height}
                x2={node.width * 0.85}
                y2={node.height}
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <ellipse
                cx={node.width * 0.85}
                cy={node.height / 2}
                rx={node.width * 0.15}
                ry={node.height / 2}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'lin-cyl':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <ellipse
                cx={node.width / 2}
                cy={node.height * 0.15}
                rx={node.width / 2}
                ry={node.height * 0.15}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <rect
                x={0}
                y={node.height * 0.15}
                width={node.width}
                height={node.height * 0.7}
                fill="#fff"
                stroke="none"
              />
              <line
                x1={0}
                y1={node.height * 0.15}
                x2={0}
                y2={node.height * 0.85}
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <line
                x1={node.width}
                y1={node.height * 0.15}
                x2={node.width}
                y2={node.height * 0.85}
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <ellipse
                cx={node.width / 2}
                cy={node.height * 0.85}
                rx={node.width / 2}
                ry={node.height * 0.15}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <ellipse
                cx={node.width / 2}
                cy={node.height * 0.4}
                rx={node.width / 2}
                ry={node.height * 0.1}
                fill="none"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'tag-rect':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <rect
                x={0}
                y={0}
                width={node.width}
                height={node.height}
                rx={4}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <polygon
                points={`${node.width * 0.75},0 ${node.width},0 ${node.width},${node.height * 0.4}`}
                fill="none"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'sl-rect':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`0,${node.height * 0.3} ${node.width},0 ${node.width},${node.height} 0,${node.height}`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'bow-rect':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <path
                d={`M${node.width * 0.2},0 L${node.width * 0.8},0 C${node.width * 0.9},0 ${node.width * 0.9},${node.height / 2} ${node.width * 0.8},${node.height / 2} C${node.width * 0.9},${node.height / 2} ${node.width * 0.9},${node.height} ${node.width * 0.8},${node.height} L${node.width * 0.2},${node.height} C${node.width * 0.1},${node.height} ${node.width * 0.1},${node.height / 2} ${node.width * 0.2},${node.height / 2} C${node.width * 0.1},${node.height / 2} ${node.width * 0.1},0 ${node.width * 0.2},0`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'notch-pent':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`${node.width * 0.2},0 ${node.width * 0.8},0 ${node.width},${node.height * 0.3} ${node.width},${node.height} 0,${node.height} 0,${node.height * 0.3}`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'curv-trap':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <path
                d={`M${node.width * 0.2},0 L${node.width * 0.8},0 C${node.width * 0.9},${node.height / 2} ${node.width * 0.9},${node.height / 2} ${node.width * 0.8},${node.height} L${node.width * 0.2},${node.height} C${node.width * 0.1},${node.height / 2} ${node.width * 0.1},${node.height / 2} ${node.width * 0.2},0`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'delay':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <path
                d={`M0,0 L${node.width * 0.75},0 C${node.width * 0.9},0 ${node.width * 0.9},${node.height} ${node.width * 0.75},${node.height} L0,${node.height} Z`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'bolt':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <polygon
                points={`${node.width * 0.55},0 ${node.width * 0.3},${node.height * 0.45} ${node.width * 0.5},${node.height * 0.45} ${node.width * 0.45},${node.height} ${node.width * 0.7},${node.height * 0.55} ${node.width * 0.5},${node.height * 0.55}`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'doc':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <path
                d={`M0,0 L${node.width},0 L${node.width},${node.height * 0.8} C${node.width * 0.7},${node.height * 0.7} ${node.width * 0.3},${node.height * 0.9} 0,${node.height * 0.8} Z`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'lin-doc':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <path
                d={`M0,0 L${node.width},0 L${node.width},${node.height * 0.8} C${node.width * 0.7},${node.height * 0.7} ${node.width * 0.3},${node.height * 0.9} 0,${node.height * 0.8} Z`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <line
                x1={node.width * 0.2}
                y1={0}
                x2={node.width * 0.2}
                y2={node.height * 0.75}
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'st-doc':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <path
                d={`M${node.width * 0.1},${node.height * 0.15} L${node.width * 0.9},${node.height * 0.15} L${node.width * 0.9},${node.height * 0.85} C${node.width * 0.65},${node.height * 0.8} ${node.width * 0.35},${node.height * 0.9} ${node.width * 0.1},${node.height * 0.85} Z`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <path
                d={`M0,0 L${node.width * 0.8},0 L${node.width * 0.8},${node.height * 0.7} C${node.width * 0.55},${node.height * 0.65} ${node.width * 0.25},${node.height * 0.75} 0,${node.height * 0.7} Z`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'tag-doc':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <path
                d={`M0,0 L${node.width},0 L${node.width},${node.height * 0.8} C${node.width * 0.7},${node.height * 0.7} ${node.width * 0.3},${node.height * 0.9} 0,${node.height * 0.8} Z`}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <polygon
                points={`${node.width * 0.75},0 ${node.width},0 ${node.width},${node.height * 0.3}`}
                fill="none"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'fork':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <rect
                x={0}
                y={node.height * 0.3}
                width={node.width}
                height={node.height * 0.4}
                fill={isSelected ? '#3b82f6' : '#333'}
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={{ ...textStyle, color: '#fff' }}>{node.label}</span>
          </div>
        )
      case 'brace':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <path
                d={`M${node.width * 0.8},0 C${node.width * 0.5},0 ${node.width * 0.5},${node.height * 0.4} ${node.width * 0.2},${node.height / 2} C${node.width * 0.5},${node.height * 0.6} ${node.width * 0.5},${node.height} ${node.width * 0.8},${node.height}`}
                fill="none"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'brace-r':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <path
                d={`M${node.width * 0.2},0 C${node.width * 0.5},0 ${node.width * 0.5},${node.height * 0.4} ${node.width * 0.8},${node.height / 2} C${node.width * 0.5},${node.height * 0.6} ${node.width * 0.5},${node.height} ${node.width * 0.2},${node.height}`}
                fill="none"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'braces':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <path
                d={`M${node.width * 0.35},0 C${node.width * 0.2},0 ${node.width * 0.2},${node.height * 0.4} ${node.width * 0.05},${node.height / 2} C${node.width * 0.2},${node.height * 0.6} ${node.width * 0.2},${node.height} ${node.width * 0.35},${node.height}`}
                fill="none"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <path
                d={`M${node.width * 0.65},0 C${node.width * 0.8},0 ${node.width * 0.8},${node.height * 0.4} ${node.width * 0.95},${node.height / 2} C${node.width * 0.8},${node.height * 0.6} ${node.width * 0.8},${node.height} ${node.width * 0.65},${node.height}`}
                fill="none"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'win-pane':
        return (
          <div style={{ ...baseStyle, border: 'none', background: 'transparent', boxShadow: 'none' }}>
            <svg width={node.width} height={node.height} style={{ position: 'absolute', left: 0, top: 0 }}>
              <rect
                x={0}
                y={0}
                width={node.width}
                height={node.height}
                rx={4}
                fill="#fff"
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={isSelected ? 2 : 1}
              />
              <line
                x1={node.width / 2}
                y1={0}
                x2={node.width / 2}
                y2={node.height}
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={1}
              />
              <line
                x1={0}
                y1={node.height / 2}
                x2={node.width}
                y2={node.height / 2}
                stroke={isSelected ? '#3b82f6' : '#333'}
                strokeWidth={1}
              />
            </svg>
            <span style={textStyle}>{node.label}</span>
          </div>
        )
      case 'rectangle':
      default:
        return <div style={{ ...baseStyle, borderRadius: 4 }}>{node.label}</div>
    }
  }

  return (
    <>
      {/* 节点主体 */}
      <div
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {renderNodeShape()}
      </div>

      {/* Handles (连接点) */}
      {showHandles && (
        <>
          {(['top', 'bottom', 'left', 'right'] as const).map((dir) => {
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

      {/* Resize Handles (调整大小手柄) */}
      {isSelected && (
        <>
          {/* 四个角 */}
          {(['nw', 'ne', 'sw', 'se'] as const).map((dir) => {
            const pos = getResizeHandlePosition(node, dir)
            const cursor = dir === 'nw' || dir === 'se' ? 'nwse-resize' : 'nesw-resize'
            return (
              <div
                key={dir}
                style={{
                  position: 'absolute',
                  left: pos.x - 4,
                  top: pos.y - 4,
                  width: 8,
                  height: 8,
                  backgroundColor: '#fff',
                  border: '1.5px solid #3b82f6',
                  cursor,
                  pointerEvents: 'auto',
                  zIndex: 11,
                }}
                onMouseDown={(e) => handleResizeMouseDown(e, dir)}
              />
            )
          })}

          {/* 四条边 */}
          {(['n', 's', 'e', 'w'] as const).map((dir) => {
            const pos = getResizeHandlePosition(node, dir)
            const cursor = dir === 'n' || dir === 's' ? 'ns-resize' : 'ew-resize'
            const isVertical = dir === 'n' || dir === 's'
            return (
              <div
                key={dir}
                style={{
                  position: 'absolute',
                  left: isVertical ? pos.x - 15 : pos.x - 4,
                  top: isVertical ? pos.y - 4 : pos.y - 15,
                  width: isVertical ? 30 : 8,
                  height: isVertical ? 8 : 30,
                  backgroundColor: '#fff',
                  border: '1.5px solid #3b82f6',
                  cursor,
                  pointerEvents: 'auto',
                  zIndex: 11,
                }}
                onMouseDown={(e) => handleResizeMouseDown(e, dir)}
              />
            )
          })}
        </>
      )}
    </>
  )
}

// ─── Helper ───

function getHandlePosition(node: NodeState, dir: 'top' | 'bottom' | 'left' | 'right'): { x: number; y: number } {
  const { x, y, width, height } = node
  switch (dir) {
    case 'top':
      return { x: x + width / 2, y }
    case 'bottom':
      return { x: x + width / 2, y: y + height }
    case 'left':
      return { x, y: y + height / 2 }
    case 'right':
      return { x: x + width, y: y + height / 2 }
  }
}

function getResizeHandlePosition(node: NodeState, dir: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'): { x: number; y: number } {
  const { x, y, width, height } = node
  switch (dir) {
    case 'n':
      return { x: x + width / 2, y }
    case 's':
      return { x: x + width / 2, y: y + height }
    case 'e':
      return { x: x + width, y: y + height / 2 }
    case 'w':
      return { x, y: y + height / 2 }
    case 'ne':
      return { x: x + width, y }
    case 'nw':
      return { x, y }
    case 'se':
      return { x: x + width, y: y + height }
    case 'sw':
      return { x, y: y + height }
  }
}
