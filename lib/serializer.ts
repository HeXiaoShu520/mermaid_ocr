import type { Edge, Node } from '@xyflow/react'
import type {
  ArrowType,
  CurveStyle,
  Direction,
  EdgeStyle,
  FlowEdgeData,
  FlowNodeData,
  Look,
  NodeShape,
  Theme,
} from './flowStore'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeId(id: string): string {
  // If id contains non-ASCII chars, generate a stable short id
  if (/[^\x00-\x7F]/.test(id)) {
    let h = 0
    for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0
    return 'sg_' + Math.abs(h).toString(36)
  }
  return id.replace(/[^a-zA-Z0-9_]/g, '_')
}

function escapeLabel(label: string): string {
  return label.replace(/"/g, "'")
}

const SHAPE_TEMPLATES: Partial<Record<NodeShape, [string, string]>> = {
  'rounded': ['("', '")'],
  'stadium': ['(["', '"])'],
  'subroutine': ['[["', '"]]'],
  'cylinder': ['[("', '")]'],
  'circle': ['(("', '"))'],
  'double-circle': ['((("', '")))'],
  'diamond': ['{"', '"}'],
  'hexagon': ['{{"', '"}}'],
  'parallelogram': ['[/"', '"/]'],
  'parallelogram-alt': ['[\\"', '"\\]'],
  'trapezoid': ['[/"', '"\\]'],
  'trapezoid-alt': ['[\\"', '"/]'],
  'asymmetric': ['>"', '"]'],
  'rectangle': ['["', '"]'],
}

/** Wrap a label in the correct Mermaid shape syntax */
function shapeWrap(id: string, label: string, shape: NodeShape): string {
  const sid = sanitizeId(id)
  const lbl = escapeLabel(label)
  const template = SHAPE_TEMPLATES[shape]
  if (template) {
    const [open, close] = template
    return `${sid}${open}${lbl}${close}`
  }
  // v11.3.0+ new shape syntax: A@{ shape: xxx, label: "xxx" }
  return `${sid}@{ shape: ${shape}, label: "${lbl}" }`
}

/** Build the Mermaid edge connector string based on style and arrow type */
function edgeConnector(edgeStyle: EdgeStyle, arrowType: ArrowType): string {
  if (edgeStyle === 'dashed') {
    switch (arrowType) {
      case 'none':          return '-.-'
      case 'bidirectional': return '<-.->'
      case 'circle':        return '-.-o'
      case 'cross':         return '-.-x'
      default:              return '-.->'
    }
  }
  if (edgeStyle === 'thick') {
    switch (arrowType) {
      case 'none':          return '==='
      case 'bidirectional': return '<===>'
      default:              return '==>'
    }
  }
  // solid (default)
  switch (arrowType) {
    case 'none':          return '---'
    case 'bidirectional': return '<-->'
    case 'circle':        return '--o'
    case 'cross':         return '--x'
    default:              return '-->'
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SerializeOptions {
  direction?: Direction
  theme?: Theme
  look?: Look
  curveStyle?: CurveStyle
}

export function serialize(
  nodes: Node<FlowNodeData>[],
  edges: Edge<FlowEdgeData>[],
  options: SerializeOptions = {}
): string {
  const { direction = 'TD', theme = 'default', look = 'classic', curveStyle = 'basis' } = options

  if (nodes.length === 0) {
    return `flowchart TD\n  %% 添加节点开始使用`
  }

  const lines: string[] = []

  // ── Frontmatter for non-default settings ──────────────────────────────────
  const initConfig: Record<string, unknown> = {}
  if (theme !== 'default') initConfig.theme = theme
  if (look !== 'classic') initConfig.look = look
  if (curveStyle !== 'basis') initConfig.flowchart = { curve: curveStyle }

  if (Object.keys(initConfig).length > 0) {
    lines.push(`%%{ init: ${JSON.stringify(initConfig)} }%%`)
  }

  // ── Graph header ──────────────────────────────────────────────────────────
  lines.push(`flowchart ${direction}`)

  // ── Separate node categories ──────────────────────────────────────────────
  const subgraphNodes = nodes.filter((n) => n.data.isSubgraph)
  const standaloneNodes = nodes.filter((n) => !n.data.isSubgraph && !n.parentId)
  const childNodes = nodes.filter((n) => n.parentId && !n.data.isSubgraph)

  // ── Standalone node declarations ──────────────────────────────────────────
  for (const node of standaloneNodes) {
    const shape = (node.data.shape ?? 'rectangle') as NodeShape
    const label = node.data.label || node.id
    lines.push(`  ${shapeWrap(node.id, label, shape)}`)
  }

  // ── Subgraph blocks ───────────────────────────────────────────────────────
  for (const sg of subgraphNodes) {
    const sgId = sanitizeId(sg.id)
    const sgLabel = escapeLabel(sg.data.label || sg.id)
    lines.push(`  subgraph ${sgId} ["${sgLabel}"]`)
    const children = childNodes.filter((c) => c.parentId === sg.id)
    for (const child of children) {
      const shape = (child.data.shape ?? 'rectangle') as NodeShape
      const label = child.data.label || child.id
      lines.push(`    ${shapeWrap(child.id, label, shape)}`)
    }
    lines.push(`  end`)
  }

  // ── Node styles (only for custom-coloured nodes) ──────────────────────────
  for (const node of nodes.filter((n) => !n.data.isSubgraph)) {
    const parts: string[] = []
    if (node.data.fillColor) parts.push(`fill:${node.data.fillColor}`)
    if (node.data.strokeColor) parts.push(`stroke:${node.data.strokeColor}`)
    if (node.data.textColor) parts.push(`color:${node.data.textColor}`)
    if (parts.length > 0) {
      lines.push(`  style ${sanitizeId(node.id)} ${parts.join(',')}`)
    }
  }

  // ── Edge declarations ─────────────────────────────────────────────────────
  for (const edge of edges) {
    const src = sanitizeId(edge.source)
    const tgt = sanitizeId(edge.target)
    const label = typeof edge.label === 'string' ? edge.label : undefined
    const edgeStyle = (edge.data?.edgeStyle as EdgeStyle) ?? 'solid'
    const arrowType = (edge.data?.arrowType as ArrowType) ?? 'arrow'
    const connector = edgeConnector(edgeStyle, arrowType)

    if (label?.trim()) {
      lines.push(`  ${src} ${connector}|"${escapeLabel(label)}"| ${tgt}`)
    } else {
      lines.push(`  ${src} ${connector} ${tgt}`)
    }
  }

  // ── Edge custom colours (linkStyle by index) ──────────────────────────────
  edges.forEach((edge, i) => {
    const strokeColor = edge.data?.strokeColor as string | undefined
    if (strokeColor) {
      lines.push(`  linkStyle ${i} stroke:${strokeColor}`)
    }
  })

  return lines.join('\n')
}
