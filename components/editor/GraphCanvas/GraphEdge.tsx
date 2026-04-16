'use client'

import { useCallback } from 'react'
import { useGraphEditorStore, type EdgeState, type NodeState } from '@/lib/graphEditorStore'

interface GraphEdgeProps {
  edge: EdgeState
  nodes: NodeState[]
}

export default function GraphEdge({ edge, nodes }: GraphEdgeProps) {
  const { selectedEdgeId, selectEdge, setContextMenu, setEditingEdge, curveStyle } = useGraphEditorStore()

  const fromNode = nodes.find(n => n.id === edge.source)
  const toNode = nodes.find(n => n.id === edge.target)

  if (!fromNode || !toNode) return null

  const isSelected = selectedEdgeId === edge.id

  // ─── Calculate Path ───

  // 计算节点中心
  const fromCenterX = fromNode.x + fromNode.width / 2
  const fromCenterY = fromNode.y + fromNode.height / 2
  const toCenterX = toNode.x + toNode.width / 2
  const toCenterY = toNode.y + toNode.height / 2

  const dx = toCenterX - fromCenterX
  const dy = toCenterY - fromCenterY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  // 计算起点：根据方向选择最近的边
  let x1: number, y1: number
  if (absDy > absDx) {
    // 垂直方向为主
    x1 = fromCenterX
    y1 = dy > 0 ? fromNode.y + fromNode.height : fromNode.y
  } else {
    // 水平方向为主
    y1 = fromCenterY
    x1 = dx > 0 ? fromNode.x + fromNode.width : fromNode.x
  }

  // 计算终点：根据方向选择最近的边
  let x2: number, y2: number
  if (absDy > absDx) {
    // 垂直方向为主
    x2 = toCenterX
    y2 = dy > 0 ? toNode.y : toNode.y + toNode.height
  } else {
    // 水平方向为主
    y2 = toCenterY
    x2 = dx > 0 ? toNode.x : toNode.x + toNode.width
  }

  let pathD = ''

  if (curveStyle === 'linear') {
    // 直线
    pathD = `M ${x1} ${y1} L ${x2} ${y2}`
  } else if (curveStyle === 'step') {
    // 阶梯线
    if (absDy > absDx) {
      // 垂直方向为主：先垂直，再水平，再垂直
      const midY = (y1 + y2) / 2
      pathD = `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
    } else {
      // 水平方向为主：先水平，再垂直，再水平
      const midX = (x1 + x2) / 2
      pathD = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
    }
  } else if (curveStyle === 'stepBefore') {
    // 阶梯线（先垂直/水平到目标位置）
    if (absDy > absDx) {
      pathD = `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`
    } else {
      pathD = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`
    }
  } else if (curveStyle === 'stepAfter') {
    // 阶梯线（先水平/垂直到目标位置）
    if (absDy > absDx) {
      pathD = `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`
    } else {
      pathD = `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`
    }
  } else if (curveStyle === 'monotoneX' || curveStyle === 'monotoneY') {
    // monotone 曲线，使用简化的贝塞尔曲线
    const controlOffset = 40
    const straightLen = 15
    let preX2 = x2, preY2 = y2
    if (absDy > absDx) {
      preY2 = dy > 0 ? y2 - straightLen : y2 + straightLen
    } else {
      preX2 = dx > 0 ? x2 - straightLen : x2 + straightLen
    }
    let cp1x = x1, cp1y = y1
    let cp2x = preX2, cp2y = preY2
    if (absDy > absDx) {
      cp1y = dy > 0 ? y1 + controlOffset : y1 - controlOffset
      cp2y = dy > 0 ? preY2 - controlOffset : preY2 + controlOffset
    } else {
      cp1x = dx > 0 ? x1 + controlOffset : x1 - controlOffset
      cp2x = dx > 0 ? preX2 - controlOffset : preX2 + controlOffset
    }
    pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${preX2} ${preY2} L ${x2} ${y2}`
  } else {
    // 贝塞尔曲线（默认）
    const controlOffset = 60
    const straightLen = 15 // 终点前的直线长度，确保箭头垂直

    // 计算终点前的直线起点
    let preX2 = x2, preY2 = y2
    if (absDy > absDx) {
      // 垂直连接
      preY2 = dy > 0 ? y2 - straightLen : y2 + straightLen
    } else {
      // 水平连接
      preX2 = dx > 0 ? x2 - straightLen : x2 + straightLen
    }

    // 计算控制点，让曲线更平滑
    let cp1x = x1, cp1y = y1
    let cp2x = preX2, cp2y = preY2

    if (absDy > absDx) {
      // 垂直方向为主
      cp1y = dy > 0 ? y1 + controlOffset : y1 - controlOffset
      cp2y = dy > 0 ? preY2 - controlOffset : preY2 + controlOffset
    } else {
      // 水平方向为主
      cp1x = dx > 0 ? x1 + controlOffset : x1 - controlOffset
      cp2x = dx > 0 ? preX2 - controlOffset : preX2 + controlOffset
    }

    pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${preX2} ${preY2} L ${x2} ${y2}`
  }

  // ─── Handlers ───

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selectEdge(edge.id)
  }, [edge.id, selectEdge])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingEdge(edge.id)
  }, [edge.id, setEditingEdge])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id })
  }, [edge.id, setContextMenu])

  // ─── Style ───

  const stroke = edge.strokeColor || (isSelected ? '#3b82f6' : '#6b7280')
  const strokeDasharray = edge.style === 'dotted' ? '5,5' : edge.style === 'thick' ? undefined : undefined
  const strokeWidth = edge.style === 'thick' ? 3 : 2

  // 箭头类型
  const arrowType = edge.arrowType || 'arrow'
  let markerEnd = ''
  if (arrowType !== 'none') {
    markerEnd = isSelected ? `url(#${arrowType}-selected)` : `url(#${arrowType})`
  }

  return (
    <g>
      {/* 透明宽路径（点击区域） */}
      <path
        d={pathD}
        stroke="transparent"
        strokeWidth={12}
        fill="none"
        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />

      {/* 实际显示的路径 */}
      <path
        d={pathD}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        fill="none"
        markerEnd={markerEnd}
        style={{ pointerEvents: 'none' }}
      />

      {/* 边标签 */}
      {edge.label && (
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={12}
          fill="#374151"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {edge.label}
        </text>
      )}
    </g>
  )
}

// ─── Arrow Marker ───

export function EdgeMarkerDefs() {
  return (
    <defs>
      {/* 普通箭头 */}
      <marker
        id="arrow"
        viewBox="0 0 10 10"
        refX="10"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b7280" />
      </marker>
      <marker
        id="arrow-selected"
        viewBox="0 0 10 10"
        refX="10"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
      </marker>

      {/* 圆形箭头 */}
      <marker
        id="circle"
        viewBox="0 0 10 10"
        refX="10"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <circle cx="5" cy="5" r="3" fill="none" stroke="#6b7280" strokeWidth="1.5" />
      </marker>
      <marker
        id="circle-selected"
        viewBox="0 0 10 10"
        refX="10"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <circle cx="5" cy="5" r="3" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      </marker>

      {/* 叉形箭头 */}
      <marker
        id="cross"
        viewBox="0 0 10 10"
        refX="10"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 2 2 L 8 8 M 8 2 L 2 8" stroke="#6b7280" strokeWidth="1.5" fill="none" />
      </marker>
      <marker
        id="cross-selected"
        viewBox="0 0 10 10"
        refX="10"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 2 2 L 8 8 M 8 2 L 2 8" stroke="#3b82f6" strokeWidth="1.5" fill="none" />
      </marker>

      {/* 双箭头 */}
      <marker
        id="double"
        viewBox="0 0 14 10"
        refX="14"
        refY="5"
        markerWidth="8"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 0 0 L 6 5 L 0 10 M 4 0 L 10 5 L 4 10" fill="none" stroke="#6b7280" strokeWidth="1.5" />
      </marker>
      <marker
        id="double-selected"
        viewBox="0 0 14 10"
        refX="14"
        refY="5"
        markerWidth="8"
        markerHeight="6"
        orient="auto"
      >
        <path d="M 0 0 L 6 5 L 0 10 M 4 0 L 10 5 L 4 10" fill="none" stroke="#3b82f6" strokeWidth="1.5" />
      </marker>
    </defs>
  )
}
