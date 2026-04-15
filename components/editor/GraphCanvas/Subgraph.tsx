'use client'

import { useMemo } from 'react'
import type { SubgraphState, NodeState } from '@/lib/graphEditorStore'

interface SubgraphProps {
  subgraph: SubgraphState
  nodes: NodeState[]
}

export default function Subgraph({ subgraph, nodes }: SubgraphProps) {
  // 计算子图的边界框
  const bounds = useMemo(() => {
    const subgraphNodes = nodes.filter(n => n.subgraph === subgraph.id)
    if (subgraphNodes.length === 0) {
      return { x: 0, y: 0, width: 200, height: 100 }
    }

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
      y: minY - padding - 30, // 额外空间给标题
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2 + 30,
    }
  }, [subgraph.id, nodes])

  return (
    <div
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        border: '2px solid #9ca3af',
        borderRadius: 8,
        backgroundColor: 'rgba(243, 244, 246, 0.5)',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* 子图标题 */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          fontSize: 14,
          fontWeight: 600,
          color: '#4b5563',
          userSelect: 'none',
        }}
      >
        {subgraph.label}
      </div>
    </div>
  )
}
