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
    // Track start/end node instances to allow multiple [*] nodes
    let startCount = 0
    let endCount = 0

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

      // state ID <<choice>> / <<fork>> / <<join>>
      const stateSpecial = line.match(/^state\s+(\S+)\s+<<(\w+)>>/)
      if (stateSpecial) {
        const [, id, kind] = stateSpecial
        const kindLower = kind.toLowerCase()
        if (kindLower === 'choice') ensureNode(id, id, 'diamond')
        else if (kindLower === 'fork' || kindLower === 'join') ensureNode(id, id, 'fork')
        else ensureNode(id, id, 'rounded')
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

        const resolveId = (raw: string, isSource: boolean) => {
          if (raw !== '[*]') return raw
          if (isSource) {
            // [*] as source = start node
            const id = startCount === 0 ? '__start__' : `__start_${startCount}__`
            startCount++
            return id
          } else {
            // [*] as target = end node
            const id = endCount === 0 ? '__end__' : `__end_${endCount}__`
            endCount++
            return id
          }
        }

        const src = resolveId(rawSrc, true)
        const tgt = resolveId(rawTgt, false)

        if (src.startsWith('__start')) ensureNode(src, '●', 'filled-circle')
        else ensureNode(src, src, 'rounded')

        if (tgt.startsWith('__end')) ensureNode(tgt, '◎', 'double-circle')
        else if (tgt.startsWith('__start')) ensureNode(tgt, '●', 'filled-circle')
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
