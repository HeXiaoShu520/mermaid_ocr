/**
 * Layout 层：使用 dagre 计算节点坐标
 */

import dagre from 'dagre'
import type { GraphNode, GraphEdge } from './graphParser'

export interface LayoutNode extends GraphNode {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutResult {
  nodes: LayoutNode[]
  edges: GraphEdge[]
}

const DEFAULT_NODE_WIDTH = 120
const DEFAULT_NODE_HEIGHT = 40

/**
 * 使用 dagre 计算布局
 */
export function dagreLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB'
): LayoutResult {
  const g = new dagre.graphlib.Graph()

  g.setGraph({
    rankdir: direction,
    nodesep: 50,
    ranksep: 80,
    marginx: 20,
    marginy: 20,
  })

  g.setDefaultEdgeLabel(() => ({}))

  // 添加节点
  nodes.forEach(node => {
    g.setNode(node.id, {
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
      label: node.label,
    })
  })

  // 添加边
  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target)
  })

  // 计算布局
  dagre.layout(g)

  // 提取坐标
  const layoutNodes: LayoutNode[] = nodes.map(node => {
    const dagreNode = g.node(node.id)
    return {
      ...node,
      x: dagreNode.x - DEFAULT_NODE_WIDTH / 2,
      y: dagreNode.y - DEFAULT_NODE_HEIGHT / 2,
      width: DEFAULT_NODE_WIDTH,
      height: DEFAULT_NODE_HEIGHT,
    }
  })

  return {
    nodes: layoutNodes,
    edges,
  }
}

/**
 * 应用已有的 Layout（从持久化数据恢复）
 */
export function applyLayout(
  nodes: GraphNode[],
  layout: Record<string, { x: number; y: number }>
): LayoutNode[] {
  return nodes.map(node => ({
    ...node,
    x: layout[node.id]?.x ?? 0,
    y: layout[node.id]?.y ?? 0,
    width: DEFAULT_NODE_WIDTH,
    height: DEFAULT_NODE_HEIGHT,
  }))
}

/**
 * 提取当前布局（用于持久化）
 */
export function extractLayout(nodes: LayoutNode[]): Record<string, { x: number; y: number }> {
  const layout: Record<string, { x: number; y: number }> = {}
  nodes.forEach(node => {
    layout[node.id] = { x: node.x, y: node.y }
  })
  return layout
}
