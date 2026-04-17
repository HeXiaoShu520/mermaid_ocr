'use client'

import { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import { useGraphEditorStore, type NodeState } from '@/lib/graphEditorStore'

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
        cp1x = x1
        cp1y = startSide === 'bottom' ? y1 + controlDist : y1 - controlDist
        cp2x = x2
        cp2y = endSide === 'top' ? y2 - controlDist : y2 + controlDist
      } else {
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
        cp1x = x1
        cp1y = startSide === 'bottom' ? y1 + controlDist : y1 - controlDist
        cp2x = endSide === 'left' ? x2 - controlDist : x2 + controlDist
        cp2y = y2
      } else {
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

export default function EdgeEditor() {
  const { editingEdgeId, edges, nodes, updateEdge, setEditingEdge, curveStyle, direction } = useGraphEditorStore()
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const edge = edges.find(e => e.id === editingEdgeId)
  const sourceNode = nodes.find(n => n.id === edge?.source)
  const targetNode = nodes.find(n => n.id === edge?.target)

  useEffect(() => {
    if (edge) {
      setText(edge.label || '')
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [edge])

  const handleSave = useCallback(() => {
    if (edge) {
      updateEdge(edge.id, { label: text.trim() })
    }
    setEditingEdge(null)
  }, [edge, text, updateEdge, setEditingEdge])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setEditingEdge(null)
    }
  }, [handleSave, setEditingEdge])

  // ─── 计算路径（与 GraphEdge 相同的逻辑） ───
  const pathData = useMemo(() => {
    if (!sourceNode || !targetNode) return null

    const fromCenterX = sourceNode.x + sourceNode.width / 2
    const fromCenterY = sourceNode.y + sourceNode.height / 2
    const toCenterX = targetNode.x + targetNode.width / 2
    const toCenterY = targetNode.y + targetNode.height / 2

    // 起点节点的4个边中点
    const fromPoints = [
      { side: 'top' as EdgeSide, x: fromCenterX, y: sourceNode.y },
      { side: 'bottom' as EdgeSide, x: fromCenterX, y: sourceNode.y + sourceNode.height },
      { side: 'left' as EdgeSide, x: sourceNode.x, y: fromCenterY },
      { side: 'right' as EdgeSide, x: sourceNode.x + sourceNode.width, y: fromCenterY },
    ]

    // 终点节点的4个边中点
    const toPoints = [
      { side: 'top' as EdgeSide, x: toCenterX, y: targetNode.y },
      { side: 'bottom' as EdgeSide, x: toCenterX, y: targetNode.y + targetNode.height },
      { side: 'left' as EdgeSide, x: targetNode.x, y: toCenterY },
      { side: 'right' as EdgeSide, x: targetNode.x + targetNode.width, y: toCenterY },
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
        // 相对位置打折
        if (isVerticalLayout && endIsVert) dist *= 0.8
        if (!isVerticalLayout && !endIsVert) dist *= 0.8
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

    const pathD = buildPathD(bestStart.x, bestStart.y, bestEnd.x, bestEnd.y, curveStyle, bestStart.side, bestEnd.side)

    // 用 SVG path 计算真实中点
    let midX = sourceNode.x + sourceNode.width / 2
    let midY = sourceNode.y + sourceNode.height / 2
    try {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      path.setAttribute('d', pathD)
      svg.appendChild(path)
      document.body.appendChild(svg)
      const totalLen = path.getTotalLength()
      const pt = path.getPointAtLength(totalLen / 2)
      midX = pt.x
      midY = pt.y
      document.body.removeChild(svg)
    } catch {
      // fallback to simple midpoint
    }

    return { pathD, midX, midY }
  }, [sourceNode, targetNode, curveStyle])

  if (!edge || !sourceNode || !targetNode || !pathData) return null

  const { midX, midY } = pathData

  return (
    <div
      style={{
        position: 'absolute',
        left: midX - 60,
        top: midY - 15,
        width: 120,
        height: 30,
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
        placeholder="标签"
        style={{
          width: '100%',
          height: '100%',
          border: '2px solid #3b82f6',
          borderRadius: 4,
          padding: '4px 8px',
          fontSize: 12,
          textAlign: 'center',
          outline: 'none',
          background: '#fff',
        }}
        autoFocus
      />
    </div>
  )
}
