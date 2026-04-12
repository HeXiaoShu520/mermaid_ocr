import type { Edge, Node } from '@xyflow/react'
import type { FlowNodeData, FlowEdgeData, NodeShape } from './flowStore'

export function deserialize(mermaidText: string): {
  nodes: Node<FlowNodeData>[]
  edges: Edge<FlowEdgeData>[]
} {
  const lines = mermaidText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))

  // Detect diagram type
  const firstLine = lines[0] || ''
  if (firstLine.startsWith('stateDiagram')) {
    return deserializeStateDiagram(lines)
  }
  if (firstLine.startsWith('sequenceDiagram')) {
    return deserializeSequenceDiagram(lines)
  }

  // Default: flowchart
  return deserializeFlowchart(lines)
}

function deserializeFlowchart(lines: string[]): {
  nodes: Node<FlowNodeData>[]
  edges: Edge<FlowEdgeData>[]
} {
  const nodes: Node<FlowNodeData>[] = []
  const edges: Edge<FlowEdgeData>[] = []
  const nodeIds = new Set<string>()

  let yOffset = 0
  let xOffset = 0
  let currentSubgraph: string | null = null

  for (const line of lines) {
    // Skip flowchart declaration
    if (line.startsWith('flowchart')) continue

    // Subgraph start
    if (line.startsWith('subgraph')) {
      const match = line.match(/subgraph\s+(\w+)\s*\["?([^"\]]+)"?\]?/)
      if (match) {
        const [, id, label] = match
        currentSubgraph = id
        nodeIds.add(id)
        nodes.push({
          id,
          type: 'flowNode',
          position: { x: 100, y: yOffset },
          data: { label, shape: 'rectangle', isSubgraph: true },
          style: { width: 320, height: 220 },
        })
        yOffset += 250
      }
      continue
    }

    // Subgraph end
    if (line === 'end') {
      currentSubgraph = null
      continue
    }

    // Edge declaration with label
    const edgeMatch = line.match(/(\w+)\s*(-->|---|-\.-|==>|<-->)\s*\|([^|]+)\|\s*(\w+)/)
    if (edgeMatch) {
      const [, source, connector, label, target] = edgeMatch

      // 确保源节点和目标节点存在
      if (!nodeIds.has(source)) {
        nodeIds.add(source)
        nodes.push({
          id: source,
          type: 'flowNode',
          position: { x: 100 + xOffset, y: yOffset },
          data: { label: source, shape: 'rectangle' },
          ...(currentSubgraph && { parentId: currentSubgraph }),
        })
        xOffset += 150
      }
      if (!nodeIds.has(target)) {
        nodeIds.add(target)
        nodes.push({
          id: target,
          type: 'flowNode',
          position: { x: 100 + xOffset, y: yOffset },
          data: { label: target, shape: 'rectangle' },
          ...(currentSubgraph && { parentId: currentSubgraph }),
        })
        xOffset += 150
      }

      edges.push({
        id: `${source}-${target}`,
        source,
        target,
        type: 'flowEdge',
        label: label.trim(),
        data: {
          edgeStyle: connector.includes('.') ? 'dashed' : connector.includes('=') ? 'thick' : 'solid',
          arrowType: connector.includes('<') ? 'bidirectional' : 'arrow',
        },
      })
      continue
    }

    // Edge declaration without label
    const edgeMatch2 = line.match(/(\w+)\s*(-->|---|-\.-|==>|<-->)\s*(\w+)/)
    if (edgeMatch2) {
      const [, source, connector, target] = edgeMatch2

      // 确保源节点和目标节点存在
      if (!nodeIds.has(source)) {
        nodeIds.add(source)
        nodes.push({
          id: source,
          type: 'flowNode',
          position: { x: 100 + xOffset, y: yOffset },
          data: { label: source, shape: 'rectangle' },
          ...(currentSubgraph && { parentId: currentSubgraph }),
        })
        xOffset += 150
      }
      if (!nodeIds.has(target)) {
        nodeIds.add(target)
        nodes.push({
          id: target,
          type: 'flowNode',
          position: { x: 100 + xOffset, y: yOffset },
          data: { label: target, shape: 'rectangle' },
          ...(currentSubgraph && { parentId: currentSubgraph }),
        })
        xOffset += 150
      }

      edges.push({
        id: `${source}-${target}`,
        source,
        target,
        type: 'flowEdge',
        data: {
          edgeStyle: connector.includes('.') ? 'dashed' : connector.includes('=') ? 'thick' : 'solid',
          arrowType: connector.includes('<') ? 'bidirectional' : 'arrow',
        },
      })
      continue
    }

    // Node declaration - 支持更多格式
    const nodeMatch = line.match(/(\w+)([\[\(\{>]+)(.+?)([\]\)\}]+)/)
    if (nodeMatch) {
      const [, id, , label] = nodeMatch
      if (!nodeIds.has(id)) {
        nodeIds.add(id)
        const shape = detectShape(line)
        nodes.push({
          id,
          type: 'flowNode',
          position: { x: 100 + xOffset, y: yOffset },
          data: { label: label.replace(/["\[\]\(\)]/g, ''), shape },
          ...(currentSubgraph && { parentId: currentSubgraph }),
        })
        xOffset += 150
        if (xOffset > 600) {
          xOffset = 0
          yOffset += 100
        }
      }
      continue
    }
  }

  return { nodes, edges }
}

function detectShape(line: string): NodeShape {
  if (line.includes('([') && line.includes('])')) return 'stadium'
  if (line.includes('((') && line.includes('))')) return 'circle'
  if (line.includes('(((') && line.includes(')))')) return 'double-circle'
  if (line.includes('[(') && line.includes(')]')) return 'cylinder'
  if (line.includes('[[') && line.includes(']]')) return 'subroutine'
  if (line.includes('(') && line.includes(')')) return 'rounded'
  if (line.includes('{{') && line.includes('}}')) return 'hexagon'
  if (line.includes('{') && line.includes('}')) return 'diamond'
  if (line.includes('[/') && line.includes('/]')) return 'parallelogram'
  if (line.includes('[\\') && line.includes('\\]')) return 'trapezoid'
  if (line.includes('>') && line.includes(']')) return 'asymmetric'
  return 'rectangle'
}

function deserializeStateDiagram(lines: string[]): {
  nodes: Node<FlowNodeData>[]
  edges: Edge<FlowEdgeData>[]
} {
  const nodes: Node<FlowNodeData>[] = []
  const edges: Edge<FlowEdgeData>[] = []
  const nodeIds = new Set<string>()
  let yOffset = 0
  let xOffset = 0

  for (const line of lines) {
    if (line.startsWith('stateDiagram')) continue

    // Transition: StateA --> StateB (支持中文)
    const transitionMatch = line.match(/(\[\*\]|[\u4e00-\u9fa5\w]+)\s*-->\s*(\[\*\]|[\u4e00-\u9fa5\w]+)/)
    if (transitionMatch) {
      const [, source, target] = transitionMatch
      const sourceId = source === '[*]' ? 'Start' : source
      const targetId = target === '[*]' ? 'End' : target

      if (!nodeIds.has(sourceId)) {
        nodeIds.add(sourceId)
        nodes.push({
          id: sourceId,
          type: 'flowNode',
          position: { x: 100 + xOffset, y: yOffset },
          data: { label: sourceId, shape: sourceId === 'Start' || sourceId === 'End' ? 'stadium' : 'rounded' },
        })
        xOffset += 200
        if (xOffset > 600) { xOffset = 0; yOffset += 120 }
      }

      if (!nodeIds.has(targetId)) {
        nodeIds.add(targetId)
        nodes.push({
          id: targetId,
          type: 'flowNode',
          position: { x: 100 + xOffset, y: yOffset },
          data: { label: targetId, shape: targetId === 'Start' || targetId === 'End' ? 'stadium' : 'rounded' },
        })
        xOffset += 200
        if (xOffset > 600) { xOffset = 0; yOffset += 120 }
      }

      edges.push({
        id: `${sourceId}-${targetId}-${edges.length}`,
        source: sourceId,
        target: targetId,
        type: 'flowEdge',
      })
    }
  }

  return { nodes, edges }
}

function deserializeSequenceDiagram(lines: string[]): {
  nodes: Node<FlowNodeData>[]
  edges: Edge<FlowEdgeData>[]
} {
  const nodes: Node<FlowNodeData>[] = []
  const edges: Edge<FlowEdgeData>[] = []
  const nodeIds = new Set<string>()
  let xOffset = 0

  for (const line of lines) {
    if (line.startsWith('sequenceDiagram')) continue

    // Participant definition (支持中文)
    const participantMatch = line.match(/participant\s+([\u4e00-\u9fa5\w]+)(?:\s+as\s+(.+))?/)
    if (participantMatch) {
      const [, id, label] = participantMatch
      if (!nodeIds.has(id)) {
        nodeIds.add(id)
        nodes.push({
          id,
          type: 'flowNode',
          position: { x: 100 + xOffset, y: 50 },
          data: { label: label || id, shape: 'rectangle' },
        })
        xOffset += 200
      }
      continue
    }

    // Message: A->>B: message (支持中文)
    const messageMatch = line.match(/([\u4e00-\u9fa5\w]+)\s*->>?\+?\s*([\u4e00-\u9fa5\w]+)\s*:\s*(.+)/)
    if (messageMatch) {
      const [, source, target, label] = messageMatch

      if (!nodeIds.has(source)) {
        nodeIds.add(source)
        nodes.push({
          id: source,
          type: 'flowNode',
          position: { x: 100 + xOffset, y: 50 },
          data: { label: source, shape: 'rectangle' },
        })
        xOffset += 200
      }

      if (!nodeIds.has(target)) {
        nodeIds.add(target)
        nodes.push({
          id: target,
          type: 'flowNode',
          position: { x: 100 + xOffset, y: 50 },
          data: { label: target, shape: 'rectangle' },
        })
        xOffset += 200
      }

      edges.push({
        id: `${source}-${target}-${edges.length}`,
        source,
        target,
        type: 'flowEdge',
        label,
      })
    }
  }

  return { nodes, edges }
}

