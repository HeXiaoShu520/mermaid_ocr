import { type Edge, type Node, MarkerType } from '@xyflow/react'
import type { FlowEdgeData, FlowNodeData } from './flowStore'
import { applyDagreLayout, updateEdgeHandles } from './layout'

export interface StateParseResult {
  nodes: Node<FlowNodeData>[]
  edges: Edge<FlowEdgeData>[]
  error: string | null
}

export function parseMermaidStateDiagram(syntax: string): StateParseResult {
  const empty: StateParseResult = { nodes: [], edges: [], error: null }
  try {
    const lines = syntax.split('\n').map(l => l.trim()).filter(Boolean)
    const nodesMap = new Map<string, Node<FlowNodeData>>()
    const edges: Edge<FlowEdgeData>[] = []
    let edgeIdx = 0

    // Special start/end nodes
    const ensureNode = (id: string, label?: string, shape: FlowNodeData['shape'] = 'rectangle') => {
      if (!nodesMap.has(id)) {
        nodesMap.set(id, {
          id, type: 'flowNode', position: { x: 0, y: 0 },
          data: { label: label ?? id, shape },
        })
      }
    }

    for (const line of lines) {
      if (/^stateDiagram(-v2)?/.test(line)) continue
      if (/^%%/.test(line)) continue
      if (line === '}') continue

      // state "label" as ID
      const stateAlias = line.match(/^state\s+"([^"]+)"\s+as\s+(\S+)/)
      if (stateAlias) {
        const [, label, id] = stateAlias
        ensureNode(id, label, 'rounded')
        continue
      }

      // state ID { ... } composite state (just register the container)
      const stateComposite = line.match(/^state\s+(\S+)\s*\{/)
      if (stateComposite) {
        ensureNode(stateComposite[1], stateComposite[1], 'subroutine')
        continue
      }

      // note right/left of ID : text  — skip
      if (/^note\s+(right|left)\s+of/.test(line)) continue
      if (line === 'end note') continue

      // [*] --> ID : label  or  ID --> [*]  or  ID --> ID2 : label
      const transition = line.match(/^(\[?\*\]?|[^\s\-]+)\s*-->\s*(\[?\*\]?|[^\s:]+)(?:\s*:\s*(.+))?$/)
      if (transition) {
        const [, rawSrc, rawTgt, label] = transition

        const resolveId = (raw: string) => raw === '[*]' ? '__start__' : raw
        const src = resolveId(rawSrc)
        const tgt = resolveId(rawTgt)

        if (src === '__start__') ensureNode(src, '●', 'filled-circle')
        else ensureNode(src, src, 'rounded')

        if (tgt === '__start__') ensureNode(tgt, '●', 'filled-circle')
        else if (tgt === '__end__') ensureNode(tgt, '◎', 'double-circle')
        else ensureNode(tgt, tgt, 'rounded')

        edges.push({
          id: `edge_${edgeIdx++}`,
          source: src, target: tgt,
          type: 'flowEdge',
          label: label?.trim(),
          markerEnd: { type: MarkerType.ArrowClosed, color: '#9ca3af' },
          data: { edgeStyle: 'solid', arrowType: 'arrow' },
        })
        continue
      }

      // bare state ID (standalone declaration)
      const bareState = line.match(/^(\S+)\s*$/)
      if (bareState && !bareState[1].includes('-->')) {
        ensureNode(bareState[1], bareState[1], 'rounded')
      }
    }

    if (nodesMap.size === 0) return { ...empty, error: '未找到状态定义' }

    const nodes = applyDagreLayout([...nodesMap.values()], edges, 'TD')
    const updatedEdges = updateEdgeHandles(nodes, edges, 'TD')
    return { nodes, edges: updatedEdges, error: null }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : '解析错误' }
  }
}
