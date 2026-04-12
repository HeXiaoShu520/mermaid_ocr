import type { Edge, Node } from '@xyflow/react'
import type { FlowEdgeData, FlowNodeData } from './flowStore'

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_')
}

// ─── Class diagram serializer ─────────────────────────────────────────────────

export function serializeClassDiagram(
  nodes: Node<FlowNodeData>[],
  edges: Edge<FlowEdgeData>[]
): string {
  const lines: string[] = ['classDiagram']

  for (const node of nodes) {
    const id = sanitizeId(node.id)
    const labelLines = node.data.label.split('\n')
    const name = labelLines[0]
    const members = labelLines.slice(1)
    if (members.length > 0) {
      lines.push(`  class ${name} {`)
      for (const m of members) lines.push(`    ${m}`)
      lines.push(`  }`)
    } else {
      lines.push(`  class ${name}`)
    }
    if (id !== name) lines.push(`  class ${name} as ${id}`)
  }

  for (const edge of edges) {
    const src = sanitizeId(edge.source)
    const tgt = sanitizeId(edge.target)
    const arrowType = edge.data?.arrowType ?? 'arrow'
    const edgeStyle = edge.data?.edgeStyle ?? 'solid'
    let connector = '-->'
    if (edgeStyle === 'dashed' && arrowType === 'arrow') connector = '..|>'
    else if (edgeStyle === 'solid' && arrowType === 'arrow') connector = '--|>'
    else if (arrowType === 'circle') connector = '--o'
    else if (edgeStyle === 'dashed') connector = '..'
    else connector = '--'
    const label = typeof edge.label === 'string' && edge.label.trim() ? ` : ${edge.label}` : ''
    lines.push(`  ${src} ${connector} ${tgt}${label}`)
  }

  return lines.join('\n')
}

// ─── State diagram serializer ─────────────────────────────────────────────────

export function serializeStateDiagram(
  nodes: Node<FlowNodeData>[],
  edges: Edge<FlowEdgeData>[]
): string {
  const lines: string[] = ['stateDiagram-v2']

  for (const node of nodes) {
    if (node.id === '__start__' || node.id === '__end__') continue
    const id = sanitizeId(node.id)
    const label = node.data.label
    if (label !== id) {
      lines.push(`  state "${label}" as ${id}`)
    }
  }

  for (const edge of edges) {
    const src = edge.source === '__start__' ? '[*]' : sanitizeId(edge.source)
    const tgt = edge.target === '__start__' ? '[*]' : sanitizeId(edge.target)
    const label = typeof edge.label === 'string' && edge.label.trim() ? ` : ${edge.label}` : ''
    lines.push(`  ${src} --> ${tgt}${label}`)
  }

  return lines.join('\n')
}
