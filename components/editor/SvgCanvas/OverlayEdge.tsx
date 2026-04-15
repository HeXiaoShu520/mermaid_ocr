'use client'

import { useCallback } from 'react'
import { useSvgEditorStore, type EdgeState, type NodeState } from '@/lib/svgEditorStore'

interface OverlayEdgeProps {
  edge: EdgeState
  nodes: NodeState[]
}

export default function OverlayEdge({ edge, nodes }: OverlayEdgeProps) {
  const { selectedEdgeId, selectEdge, setContextMenu } = useSvgEditorStore()

  const fromNode = nodes.find(n => n.id === edge.fromNodeId)
  const toNode = nodes.find(n => n.id === edge.toNodeId)

  if (!fromNode || !toNode) return null

  const isSelected = selectedEdgeId === edge.id

  // ─── Calculate Path ───

  const x1 = fromNode.x
  const y1 = fromNode.y
  const x2 = toNode.x
  const y2 = toNode.y

  // 简单直线（后续可以改成贝塞尔曲线）
  const pathD = `M ${x1} ${y1} L ${x2} ${y2}`

  // ─── Handlers ───

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selectEdge(edge.id)
  }, [edge.id, selectEdge])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, edgeId: edge.id })
  }, [edge.id, setContextMenu])

  // ─── Style ───

  const strokeDasharray = edge.style === 'dotted' ? '5,5' : undefined
  const strokeWidth = edge.style === 'thick' ? 3 : 2
  const stroke = isSelected ? '#3b82f6' : '#6b7280'

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
        onContextMenu={handleContextMenu}
      />

      {/* 实际显示的路径 */}
      <path
        d={pathD}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        fill="none"
        markerEnd={`url(#arrow-${edge.arrow})`}
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

// ─── Arrow Markers (需要在 SVG defs 中定义) ───

export function EdgeMarkerDefs() {
  return (
    <defs>
      {/* Arrow */}
      <marker
        id="arrow-arrow"
        markerWidth="10"
        markerHeight="10"
        refX="9"
        refY="3"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L0,6 L9,3 z" fill="#6b7280" />
      </marker>

      {/* Open Arrow */}
      <marker
        id="arrow-open"
        markerWidth="10"
        markerHeight="10"
        refX="9"
        refY="3"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M0,0 L9,3 L0,6" fill="none" stroke="#6b7280" strokeWidth="1" />
      </marker>

      {/* Circle */}
      <marker
        id="arrow-circle"
        markerWidth="10"
        markerHeight="10"
        refX="8"
        refY="5"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <circle cx="5" cy="5" r="3" fill="none" stroke="#6b7280" strokeWidth="1" />
      </marker>

      {/* Cross */}
      <marker
        id="arrow-cross"
        markerWidth="10"
        markerHeight="10"
        refX="8"
        refY="5"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path d="M2,2 L8,8 M8,2 L2,8" fill="none" stroke="#6b7280" strokeWidth="1" />
      </marker>
    </defs>
  )
}
