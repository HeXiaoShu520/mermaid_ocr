/**
 * Scan a mermaid-rendered SVG and extract NodeState, EdgeState, SubgraphState.
 * This is the ONLY place where we read from SVG DOM.
 * After this, all editing happens on the state, not on SVG.
 */

import type { NodeState, EdgeState, SubgraphState, NodeShape, EdgeStyle, EdgeArrow } from './svgEditorStore'
import { genEdgeId } from './svgEditorStore'

// ─── Node ID Extraction ──────────────────────────────────────────────────────

/** Extract node ID from a mermaid SVG g.node element */
export function extractNodeId(el: Element): string | null {
  // data-id is the most reliable (some mermaid versions)
  const dataId = el.getAttribute('data-id')
  if (dataId) return dataId

  const elId = el.getAttribute('id') || ''

  // Mermaid 11.x flowchart: "layout-xxx-flowchart-NodeId-123"
  let m = elId.match(/flowchart-(.+?)-\d+$/)
  if (m) return m[1]

  // Class diagram: "classId-ClassName-123"
  m = elId.match(/classId-(.+?)-\d+$/)
  if (m) return m[1]

  // State diagram: "state-StateId-123" or similar
  m = elId.match(/state-(.+?)-\d+$/)
  if (m) return m[1]

  // Generic fallback: last segment before trailing number
  m = elId.match(/-([A-Za-z_]\w*)-\d+$/)
  if (m) return m[1]

  return null
}

// ─── Cluster/Subgraph ID Extraction ──────────────────────────────────────────

/** Extract cluster/subgraph ID from a g.cluster element */
export function extractClusterId(el: Element): string | null {
  const dataId = el.getAttribute('data-id')
  if (dataId) return dataId

  const id = el.getAttribute('id') || ''
  const m = id.match(/flowchart-(.+?)(?:-\d+)?$/)
  return m ? m[1] : null
}

// ─── Label Extraction ────────────────────────────────────────────────────────

/** Extract label text from a node element */
function extractLabel(el: SVGGElement): string {
  // Try the label group first
  const labelG = el.querySelector('g.label')
  if (labelG) {
    const textEl = labelG.querySelector('text, foreignObject span, foreignObject div, foreignObject p')
    if (textEl) return textEl.textContent?.trim() || ''
  }
  // Fallback: any text element
  const text = el.querySelector('text')
  return text?.textContent?.trim() || ''
}

// ─── Shape Detection ─────────────────────────────────────────────────────────

/** Detect node shape from SVG path/rect/polygon */
function detectNodeShape(el: SVGGElement): NodeShape {
  const path = el.querySelector('path')
  const rect = el.querySelector('rect')
  const polygon = el.querySelector('polygon')
  const circle = el.querySelector('circle')

  if (circle) return 'circle'
  if (polygon) return 'hexagon' // 简化判断
  if (rect) {
    const rx = rect.getAttribute('rx')
    if (rx && parseFloat(rx) > 5) return 'rounded'
    return 'rectangle'
  }
  if (path) {
    const d = path.getAttribute('d') || ''
    if (d.includes('Q') || d.includes('C')) return 'rounded'
    return 'rectangle'
  }

  return 'rectangle' // fallback
}

// ─── Edge Extraction ─────────────────────────────────────────────────────────

/** Extract edge source/target from SVG edge element */
function extractEdgeEndpoints(el: SVGGElement, nodeIds: Set<string>): { from: string; to: string } | null {
  // Try data attributes first
  const dataFrom = el.getAttribute('data-from') || el.getAttribute('data-source')
  const dataTo = el.getAttribute('data-to') || el.getAttribute('data-target')
  if (dataFrom && dataTo && nodeIds.has(dataFrom) && nodeIds.has(dataTo)) {
    return { from: dataFrom, to: dataTo }
  }

  // Try parsing id like "L-A-B-0" (from A to B)
  const id = el.getAttribute('id') || ''
  const m = id.match(/L-(.+?)-(.+?)-\d+$/)
  if (m) {
    const [, from, to] = m
    if (nodeIds.has(from) && nodeIds.has(to)) {
      return { from, to }
    }
  }

  // Fallback: try to find marker-end and trace path
  // (This is unreliable, but better than nothing)
  const path = el.querySelector('path')
  if (path) {
    const d = path.getAttribute('d') || ''
    // Extract start/end coordinates and find closest nodes
    // (Too complex for now, skip)
  }

  return null
}

/** Detect edge style from SVG path */
function detectEdgeStyle(el: SVGGElement): EdgeStyle {
  const path = el.querySelector('path')
  if (!path) return 'solid'

  const strokeDasharray = path.getAttribute('stroke-dasharray')
  const strokeWidth = path.getAttribute('stroke-width')

  if (strokeDasharray && strokeDasharray !== 'none') return 'dotted'
  if (strokeWidth && parseFloat(strokeWidth) > 2) return 'thick'

  return 'solid'
}

/** Detect edge arrow type from marker-end */
function detectEdgeArrow(el: SVGGElement): EdgeArrow {
  const path = el.querySelector('path')
  if (!path) return 'arrow'

  const markerEnd = path.getAttribute('marker-end')
  if (!markerEnd) return 'open'

  if (markerEnd.includes('circle')) return 'circle'
  if (markerEnd.includes('cross')) return 'cross'

  return 'arrow'
}

// ─── Main Scan Function ──────────────────────────────────────────────────────

export interface SvgScanResult {
  nodes: NodeState[]
  edges: EdgeState[]
  subgraphs: SubgraphState[]
}

/** Scan the SVG and return NodeState[], EdgeState[], SubgraphState[] */
export function scanSvgElements(svgEl: SVGSVGElement): SvgScanResult {
  const nodes: NodeState[] = []
  const edges: EdgeState[] = []
  const subgraphs: SubgraphState[] = []

  const nodeIds = new Set<string>()

  // ─── Scan Nodes ───
  for (const el of svgEl.querySelectorAll('g.node')) {
    const id = extractNodeId(el)
    if (!id) continue

    const bbox = (el as SVGGElement).getBBox()
    const label = extractLabel(el as SVGGElement)
    const shape = detectNodeShape(el as SVGGElement)

    nodes.push({
      id,
      x: bbox.x + bbox.width / 2,
      y: bbox.y + bbox.height / 2,
      width: bbox.width,
      height: bbox.height,
      label,
      shape,
    })

    nodeIds.add(id)
  }

  // ─── Scan Edges ───
  for (const el of svgEl.querySelectorAll('g.edgePath, g.edge')) {
    const endpoints = extractEdgeEndpoints(el as SVGGElement, nodeIds)
    if (!endpoints) continue

    const label = extractLabel(el as SVGGElement)
    const style = detectEdgeStyle(el as SVGGElement)
    const arrow = detectEdgeArrow(el as SVGGElement)

    edges.push({
      id: genEdgeId(),
      fromNodeId: endpoints.from,
      toNodeId: endpoints.to,
      label,
      style,
      arrow,
    })
  }

  // ─── Scan Subgraphs ───
  for (const el of svgEl.querySelectorAll('g.cluster')) {
    const id = extractClusterId(el)
    if (!id) continue

    const bbox = (el as SVGGElement).getBBox()
    const label = extractLabel(el as SVGGElement)

    // Find children nodes (nodes inside this cluster's bbox)
    const children: string[] = []
    for (const node of nodes) {
      if (
        node.x >= bbox.x &&
        node.x <= bbox.x + bbox.width &&
        node.y >= bbox.y &&
        node.y <= bbox.y + bbox.height
      ) {
        children.push(node.id)
        node.subgraphId = id
      }
    }

    subgraphs.push({
      id,
      label,
      x: bbox.x,
      y: bbox.y,
      width: bbox.width,
      height: bbox.height,
      children,
    })
  }

  return { nodes, edges, subgraphs }
}
