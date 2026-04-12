import { type Edge, type Node, MarkerType } from '@xyflow/react'
import type { FlowEdgeData, FlowNodeData } from './flowStore'
import { applyDagreLayout, updateEdgeHandles } from './layout'

export interface SequenceParseResult {
  nodes: Node<FlowNodeData>[]
  edges: Edge<FlowEdgeData>[]
  error: string | null
}

// Message types in sequence diagrams
// ->> or -> : solid arrow (synchronous)
// -->> or --> : dashed arrow (asynchronous/return)
// -) : solid arrow with open end
// --) : dashed arrow with open end
const SEQUENCE_MESSAGES: { pattern: RegExp; arrowType: string; edgeStyle: string }[] = [
  { pattern: /^(.+?)\s*->>\s*(.+?)\s*:\s*(.*)$/, arrowType: 'arrow', edgeStyle: 'solid' },
  { pattern: /^(.+?)\s*->\s*(.+?)\s*:\s*(.*)$/, arrowType: 'arrow', edgeStyle: 'solid' },
  { pattern: /^(.+?)\s*-->>\s*(.+?)\s*:\s*(.*)$/, arrowType: 'arrow', edgeStyle: 'dashed' },
  { pattern: /^(.+?)\s*-->\s*(.+?)\s*:\s*(.*)$/, arrowType: 'arrow', edgeStyle: 'dashed' },
  { pattern: /^(.+?)\s*-\)\s*(.+?)\s*:\s*(.*)$/, arrowType: 'none', edgeStyle: 'solid' },
  { pattern: /^(.+?)\s*--\)\s*(.+?)\s*:\s*(.*)$/, arrowType: 'none', edgeStyle: 'dashed' },
]

export function parseMermaidSequenceDiagram(syntax: string): SequenceParseResult {
  const empty: SequenceParseResult = { nodes: [], edges: [], error: null }

  try {
    const lines = syntax.split('\n').map(l => l.trim()).filter(Boolean)
    const nodesMap = new Map<string, Node<FlowNodeData>>()
    const edges: Edge<FlowEdgeData>[] = []
    let edgeIdx = 0

    // Helper to ensure a participant node exists
    const ensureParticipant = (id: string, label?: string) => {
      if (!nodesMap.has(id)) {
        nodesMap.set(id, {
          id,
          type: 'flowNode',
          position: { x: 0, y: 0 },
          data: { label: label || id, shape: 'rectangle' },
        })
      }
    }

    for (const line of lines) {
      // Skip header and comments
      if (/^sequenceDiagram/.test(line)) continue
      if (/^%%/.test(line)) continue

      // participant User as 用户
      const participantMatch = line.match(/^participant\s+(\w+)(?:\s+as\s+(.+))?$/)
      if (participantMatch) {
        const [, id, label] = participantMatch
        ensureParticipant(id, label)
        continue
      }

      // activate / deactivate (skip for now - simplified version)
      if (/^(activate|deactivate)\s+/.test(line)) {
        continue
      }

      // Note over / Note left of / Note right of (skip for now)
      if (/^[Nn]ote\s+(over|left of|right of)/.test(line)) {
        continue
      }

      // alt / else / opt / loop / par / and / end (skip for now)
      if (/^(alt|else|opt|loop|par|and|end)/.test(line)) {
        continue
      }

      // Try to match message patterns
      for (const msgPattern of SEQUENCE_MESSAGES) {
        const match = line.match(msgPattern.pattern)
        if (match) {
          const [, source, target, label] = match
          const sourceId = source.trim()
          const targetId = target.trim()
          const messageLabel = label.trim()

          // Ensure both participants exist
          ensureParticipant(sourceId)
          ensureParticipant(targetId)

          // Create edge
          const markers: Record<string, unknown> = {}
          if (msgPattern.arrowType === 'arrow') {
            markers.markerEnd = { type: MarkerType.ArrowClosed, color: '#9ca3af' }
          }

          edges.push({
            id: `edge_${edgeIdx++}`,
            source: sourceId,
            target: targetId,
            type: 'flowEdge',
            label: messageLabel || undefined,
            ...markers,
            data: {
              edgeStyle: msgPattern.edgeStyle as 'solid' | 'dashed',
              arrowType: msgPattern.arrowType as 'arrow' | 'none',
            },
          })
          break
        }
      }
    }

    if (nodesMap.size === 0) {
      return { ...empty, error: '未找到参与者。请添加至少一个参与者。' }
    }

    // Convert to array and apply layout
    let nodes = [...nodesMap.values()]

    // For sequence diagrams, use LR (left-to-right) layout
    nodes = applyDagreLayout(nodes, edges, 'LR')

    // Update edge handles based on layout direction
    const updatedEdges = updateEdgeHandles(nodes, edges, 'LR')

    return { nodes, edges: updatedEdges, error: null }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : '解析错误' }
  }
}
