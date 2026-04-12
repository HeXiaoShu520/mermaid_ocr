import dagre from '@dagrejs/dagre'
import { Position, type Edge, type Node } from '@xyflow/react'
import type { Direction, FlowNodeData } from './flowStore'

function getPositions(direction: Direction): { source: Position; target: Position } {
  switch (direction) {
    case 'LR': return { source: Position.Right, target: Position.Left }
    case 'RL': return { source: Position.Left, target: Position.Right }
    case 'BT': return { source: Position.Top, target: Position.Bottom }
    default:   return { source: Position.Bottom, target: Position.Top }
  }
}

const NODE_WIDTH = 150
const NODE_HEIGHT = 60
const SUBGRAPH_PADDING = 40

const RANKDIR: Record<Direction, string> = {
  TD: 'TB',
  LR: 'LR',
  BT: 'BT',
  RL: 'RL',
}

// Calculate which handle to use based on layout direction
function calculateHandles(
  direction: Direction
): { sourceHandle: string; targetHandle: string } {
  switch (direction) {
    case 'TD':
      return {
        sourceHandle: `${Position.Bottom}-s`,
        targetHandle: `${Position.Top}-t`,
      }
    case 'BT':
      return {
        sourceHandle: `${Position.Top}-s`,
        targetHandle: `${Position.Bottom}-t`,
      }
    case 'LR':
      return {
        sourceHandle: `${Position.Right}-s`,
        targetHandle: `${Position.Left}-t`,
      }
    case 'RL':
      return {
        sourceHandle: `${Position.Left}-s`,
        targetHandle: `${Position.Right}-t`,
      }
  }
}

export function applyDagreLayout(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  direction: Direction = 'TD'
): Node<FlowNodeData>[] {
  if (nodes.length === 0) return nodes

  const g = new dagre.graphlib.Graph({ compound: true })
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: RANKDIR[direction],
    nodesep: 60,
    ranksep: 80,
    ranker: 'longest-path'  // Use longest-path ranker to better preserve order
  })

  // Add all nodes with order index to preserve declaration order
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]
    if (node.data?.isSubgraph) {
      // Let dagre auto-size subgraphs from children; provide padding
      g.setNode(node.id, {
        width: 0,
        height: 0,
        paddingX: SUBGRAPH_PADDING,
        paddingY: SUBGRAPH_PADDING,
      })
    } else {
      const isCircle = node.data?.shape === 'circle' || node.data?.shape === 'double-circle'
      const defaultW = isCircle ? 80 : NODE_WIDTH
      const defaultH = isCircle ? 80 : NODE_HEIGHT
      const w = typeof node.style?.width === 'number' ? node.style.width : defaultW
      const h = typeof node.style?.height === 'number' ? node.style.height : defaultH
      g.setNode(node.id, { width: w, height: h })
    }
  }

  // Set parent relationships for compound layout
  for (const node of nodes) {
    if (node.parentId) {
      g.setParent(node.id, node.parentId)
    }
  }

  // Add ALL edges — dagre handles cross-boundary edges in compound mode
  // Add edges in order to help dagre maintain node ordering
  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i]
    g.setEdge(edge.source, edge.target, { weight: edges.length - i })
  }

  dagre.layout(g)

  const { source: sourcePosition, target: targetPosition } = getPositions(direction)

  return nodes.map((node) => {
    const layout = g.node(node.id)
    if (!layout) return node

    if (node.data?.isSubgraph) {
      return {
        ...node,
        position: {
          x: layout.x - layout.width / 2,
          y: layout.y - layout.height / 2,
        },
        style: {
          ...node.style,
          width: layout.width,
          height: layout.height,
        },
      }
    }

    const posProps = { sourcePosition, targetPosition }

    if (node.parentId) {
      const parentLayout = g.node(node.parentId)
      if (!parentLayout) return node
      const w = typeof node.style?.width === 'number' ? node.style.width : NODE_WIDTH
      const h = typeof node.style?.height === 'number' ? node.style.height : NODE_HEIGHT
      const parentTopLeftX = parentLayout.x - parentLayout.width / 2
      const parentTopLeftY = parentLayout.y - parentLayout.height / 2
      return {
        ...node,
        ...posProps,
        position: {
          x: layout.x - w / 2 - parentTopLeftX,
          y: layout.y - h / 2 - parentTopLeftY,
        },
      }
    }

    const w = typeof node.style?.width === 'number' ? node.style.width : NODE_WIDTH
    const h = typeof node.style?.height === 'number' ? node.style.height : NODE_HEIGHT
    return {
      ...node,
      ...posProps,
      position: {
        x: layout.x - w / 2,
        y: layout.y - h / 2,
      },
    }
  })
}

// Update edges with correct handle IDs based on layout direction
export function updateEdgeHandles(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  direction: Direction = 'TD'
): Edge[] {
  const { sourceHandle, targetHandle } = calculateHandles(direction)

  return edges.map(edge => ({
    ...edge,
    sourceHandle,
    targetHandle,
  }))
}
