'use client'

import { useCallback, useRef, useEffect, useState, useMemo } from 'react'
import { useGraphEditorStore, type EdgeState, type NodeState } from '@/lib/graphEditorStore'

interface GraphEdgeProps {
  edge: EdgeState
  nodes: NodeState[]
  parallelIndex?: number
  parallelCount?: number
}

type EdgeSide = 'top' | 'bottom' | 'left' | 'right'

/** 获取节点某条边的中点坐标 */
function getNodeEdgePoint(node: NodeState, side: EdgeSide): { x: number; y: number } {
  switch (side) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y }
    case 'bottom':
      return { x: node.x + node.width / 2, y: node.y + node.height }
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 }
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 }
  }
}

/** 构建路径字符串 */
function buildPathD(
  x1: number, y1: number,
  x2: number, y2: number,
  curveStyle: string,
  startSide: EdgeSide,
  endSide: EdgeSide
): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  // 终点是垂直边（top/bottom）还是水平边（left/right）
  const endIsVertical = endSide === 'top' || endSide === 'bottom'
  const startIsVertical = startSide === 'top' || startSide === 'bottom'

  if (curveStyle === 'linear') {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  } else if (curveStyle === 'step') {
    if (endIsVertical) {
      const midY = (y1 + y2) / 2
      return `M ${x1} ${y1} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${y2}`
    } else {
      const midX = (x1 + x2) / 2
      return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
    }
  } else if (curveStyle === 'stepBefore') {
    if (endIsVertical) {
      return `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`
    } else {
      return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`
    }
  } else if (curveStyle === 'stepAfter') {
    if (endIsVertical) {
      return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`
    } else {
      return `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`
    }
  } else {
    // 贝塞尔曲线（basis / monotone 等）
    const straightLen = 15 // 终点直线段长度，确保箭头方向正确

    if (endIsVertical) {
      // 终点是垂直边（top/bottom），箭头必须垂直
      const preY2 = endSide === 'top' ? y2 - straightLen : y2 + straightLen

      // 控制点：确保曲线平滑
      const controlDist = Math.max(Math.abs(dy) * 0.4, 50)

      let cp1x: number, cp1y: number, cp2x: number, cp2y: number

      if (startIsVertical) {
        // 起点也是垂直边：垂直 → 垂直
        cp1x = x1
        cp1y = startSide === 'bottom' ? y1 + controlDist : y1 - controlDist
        cp2x = x2
        cp2y = endSide === 'top' ? y2 - controlDist : y2 + controlDist
      } else {
        // 起点是水平边：水平 → 垂直
        cp1x = startSide === 'right' ? x1 + controlDist : x1 - controlDist
        cp1y = y1
        cp2x = x2
        cp2y = endSide === 'top' ? y2 - controlDist : y2 + controlDist
      }

      return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${preY2} L ${x2} ${y2}`
    } else {
      // 终点是水平边（left/right），箭头必须水平
      const preX2 = endSide === 'left' ? x2 - straightLen : x2 + straightLen

      // 控制点：确保曲线平滑
      const controlDist = Math.max(Math.abs(dx) * 0.4, 50)

      let cp1x: number, cp1y: number, cp2x: number, cp2y: number

      if (startIsVertical) {
        // 起点是垂直边：垂直 → 水平
        cp1x = x1
        cp1y = startSide === 'bottom' ? y1 + controlDist : y1 - controlDist
        cp2x = endSide === 'left' ? x2 - controlDist : x2 + controlDist
        cp2y = y2
      } else {
        // 起点也是水平边：水平 → 水平
        cp1x = startSide === 'right' ? x1 + controlDist : x1 - controlDist
        cp1y = y1
        cp2x = endSide === 'left' ? x2 - controlDist : x2 + controlDist
        cp2y = y2
      }

      return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${preX2} ${y2} L ${x2} ${y2}`
    }
  }
}

/** 计算路径的实际长度 */
function getPathLength(pathD: string): number {
  if (typeof document === 'undefined') return Infinity
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', pathD)
    svg.appendChild(path)
    document.body.appendChild(svg)
    const len = path.getTotalLength()
    document.body.removeChild(svg)
    return len
  } catch {
    return Infinity
  }
}

export default function GraphEdge({ edge, nodes, parallelIndex = 0, parallelCount = 1 }: GraphEdgeProps) {
  const { selectedEdgeId, selectEdge, setContextMenu, setEditingEdge, curveStyle, direction } = useGraphEditorStore()

  const fromNode = nodes.find(n => n.id === edge.source)
  const toNode = nodes.find(n => n.id === edge.target)

  if (!fromNode || !toNode) return null

  const isSelected = selectedEdgeId === edge.id

  // ─── 计算路径 ───
  const pathD = useMemo(() => {
    const fromCenterX = fromNode.x + fromNode.width / 2
    const fromCenterY = fromNode.y + fromNode.height / 2
    const toCenterX = toNode.x + toNode.width / 2
    const toCenterY = toNode.y + toNode.height / 2

    // 起点节点的4个边中点
    const fromPoints = [
      { side: 'top' as EdgeSide, x: fromCenterX, y: fromNode.y },
      { side: 'bottom' as EdgeSide, x: fromCenterX, y: fromNode.y + fromNode.height },
      { side: 'left' as EdgeSide, x: fromNode.x, y: fromCenterY },
      { side: 'right' as EdgeSide, x: fromNode.x + fromNode.width, y: fromCenterY },
    ]

    // 终点节点的4个边中点
    const toPoints = [
      { side: 'top' as EdgeSide, x: toCenterX, y: toNode.y },
      { side: 'bottom' as EdgeSide, x: toCenterX, y: toNode.y + toNode.height },
      { side: 'left' as EdgeSide, x: toNode.x, y: toCenterY },
      { side: 'right' as EdgeSide, x: toNode.x + toNode.width, y: toCenterY },
    ]

    // 计算所有16种组合的距离，选择最短的
    // 1. 相对位置：上下分布时 top/bottom ×0.8，左右分布时 left/right ×0.8
    // 2. 布局方向：终点边与 mermaid direction 一致时再 ×0.8
    const absDy = Math.abs(toCenterY - fromCenterY)
    const absDx = Math.abs(toCenterX - fromCenterX)
    const isVerticalLayout = absDy > absDx
    const isVerticalDirection = direction === 'TB' || direction === 'BT'

    let minDist = Infinity
    let bestStart = fromPoints[0]
    let bestEnd = toPoints[0]

    for (const start of fromPoints) {
      for (const end of toPoints) {
        let dist = Math.hypot(end.x - start.x, end.y - start.y)

        const endIsVert = end.side === 'top' || end.side === 'bottom'
        // 相对位置打折（1 = 不打折）
        if (isVerticalLayout && endIsVert) dist *= 1
        if (!isVerticalLayout && !endIsVert) dist *= 1
        // 布局方向打折
        if (isVerticalDirection && endIsVert) dist *= 0.8
        if (!isVerticalDirection && !endIsVert) dist *= 0.8

        if (dist < minDist) {
          minDist = dist
          bestStart = start
          bestEnd = end
        }
      }
    }

    // 平行边偏移：同一对节点间多条边时，沿连接点的垂直方向偏移
    let sx = bestStart.x, sy = bestStart.y, ex = bestEnd.x, ey = bestEnd.y
    if (parallelCount > 1) {
      const spacing = 15 // 每条边之间的间距
      const offset = (parallelIndex - (parallelCount - 1) / 2) * spacing
      const startIsVert = bestStart.side === 'top' || bestStart.side === 'bottom'
      const endIsVert = bestEnd.side === 'top' || bestEnd.side === 'bottom'
      // 垂直边（top/bottom）沿 X 偏移，水平边（left/right）沿 Y 偏移
      if (startIsVert) { sx += offset } else { sy += offset }
      if (endIsVert) { ex += offset } else { ey += offset }
    }

    return buildPathD(sx, sy, ex, ey, curveStyle, bestStart.side, bestEnd.side)
  }, [fromNode, toNode, curveStyle, direction, parallelIndex, parallelCount])

  // ─── 计算曲线真实中点 ───
  const pathRef = useRef<SVGPathElement>(null)
  const [labelPos, setLabelPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (pathRef.current) {
      try {
        const totalLen = pathRef.current.getTotalLength()
        const pt = pathRef.current.getPointAtLength(totalLen / 2)
        setLabelPos({ x: pt.x, y: pt.y })
      } catch {
        // fallback: 使用简单中点
        const fromCenterX = fromNode.x + fromNode.width / 2
        const y1 = fromNode.y + fromNode.height
        const toCenterX = toNode.x + toNode.width / 2
        const toCenterY = toNode.y + toNode.height / 2
        setLabelPos({ x: (fromCenterX + toCenterX) / 2, y: (y1 + toCenterY) / 2 })
      }
    }
  }, [pathD, fromNode, toNode])

  const midX = labelPos?.x ?? fromNode.x + fromNode.width / 2
  const midY = labelPos?.y ?? fromNode.y + fromNode.height / 2

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

  // 估算标签文字宽度
  const labelText = edge.label || ''
  const labelPadX = 6
  const labelPadY = 3
  const charWidth = 7
  const labelWidth = labelText.length * charWidth + labelPadX * 2
  const labelHeight = 16 + labelPadY * 2

  return (
    <g>
      {/* 隐藏的路径用于计算长度 */}
      <path
        ref={pathRef}
        d={pathD}
        fill="none"
        stroke="none"
        style={{ pointerEvents: 'none' }}
      />

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

      {/* 边标签（带背景） */}
      {edge.label && (
        <g style={{ pointerEvents: 'none' }}>
          {/* 白色背景矩形，遮住线条 */}
          <rect
            x={midX - labelWidth / 2}
            y={midY - labelHeight / 2}
            width={labelWidth}
            height={labelHeight}
            rx={4}
            fill="white"
            fillOpacity={0.92}
            stroke={isSelected ? '#3b82f6' : '#d1d5db'}
            strokeWidth={0.8}
          />
          <text
            x={midX}
            y={midY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fill="#374151"
            style={{ userSelect: 'none' }}
          >
            {edge.label}
          </text>
        </g>
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
