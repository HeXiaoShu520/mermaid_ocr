import mermaid from 'mermaid'
import type { Node } from '@xyflow/react'
import type { FlowNodeData, Direction, Theme, Look, CurveStyle } from './flowStore'

/**
 * Render mermaid code into a hidden DOM element, then use getBoundingClientRect()
 * to extract precise node positions. This avoids manual SVG transform parsing.
 */
export async function applyMermaidLayout(
  nodes: Node<FlowNodeData>[],
  edges: { source: string; target: string }[],
  code: string,
  direction: Direction = 'TD',
  theme: Theme = 'default',
  look: Look = 'classic',
  curveStyle: CurveStyle = 'basis',
): Promise<Node<FlowNodeData>[] | null> {
  if (nodes.length === 0 || typeof window === 'undefined') return null

  try {
    mermaid.initialize({
      startOnLoad: false,
      logLevel: 'error',
      theme: theme as any,
      flowchart: { curve: curveStyle },
      ...(look !== 'classic' ? { look } as any : {}),
    } as any)

    const id = `layout-${Date.now()}`
    await mermaid.parse(code)
    const { svg } = await mermaid.render(id, code)

    // Insert SVG into a hidden container in the real DOM so we can use getBoundingClientRect
    const container = document.createElement('div')
    container.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;'
    container.innerHTML = svg
    document.body.appendChild(container)

    try {
      const svgEl = container.querySelector('svg')
      if (!svgEl) return null

      // Get the SVG element's own bounding rect as the origin reference
      const svgRect = svgEl.getBoundingClientRect()

      const allNodeEls = svgEl.querySelectorAll('g.node')
      console.log(`[mermaidLayout] Found ${allNodeEls.length} node elements in SVG`)

      // Map: nodeId -> { x, y, width, height } in SVG-local coordinates (top-left)
      const positionMap = new Map<string, { x: number; y: number; width: number; height: number }>()

      for (const el of allNodeEls) {
        const nodeId = extractNodeId(el)
        if (!nodeId) {
          console.log('[mermaidLayout] cannot extract node id:', el.getAttribute('id'))
          continue
        }

        // Extract position from transform attribute (center point)
        const transform = (el as SVGGElement).getAttribute('transform') || ''
        const translateMatch = transform.match(/translate\(([-\d.]+)[,\s]+([-\d.]+)\)/)

        const rect = (el as SVGGElement).getBoundingClientRect()
        const w = rect.width
        const h = rect.height

        let x: number, y: number

        if (translateMatch) {
          // Use transform translate (center point) and convert to top-left
          const centerX = parseFloat(translateMatch[1])
          const centerY = parseFloat(translateMatch[2])
          x = centerX - w / 2
          y = centerY - h / 2
          console.log(`[mermaidLayout] node "${nodeId}": center=(${centerX.toFixed(1)}, ${centerY.toFixed(1)}), topLeft=(${x.toFixed(1)}, ${y.toFixed(1)}), size=${w.toFixed(1)}x${h.toFixed(1)}`)
        } else {
          // Fallback to getBoundingClientRect
          x = rect.left - svgRect.left
          y = rect.top - svgRect.top
          console.log(`[mermaidLayout] node "${nodeId}": pos=(${x.toFixed(1)}, ${y.toFixed(1)}) [fallback], size=${w.toFixed(1)}x${h.toFixed(1)}`)
        }

        positionMap.set(nodeId, { x, y, width: w, height: h })
      }

      if (positionMap.size === 0) {
        console.warn('[mermaidLayout] No node positions extracted from SVG')
        return null
      }

      // Extract subgraph (cluster) positions
      const clusterEls = svgEl.querySelectorAll('g.cluster')
      console.log(`[mermaidLayout] Found ${clusterEls.length} cluster elements`)

      for (const el of clusterEls) {
        const clusterId = extractClusterId(el)
        if (!clusterId) continue

        // For clusters, getBoundingClientRect should be correct (already top-left)
        const rect = (el as SVGGElement).getBoundingClientRect()
        const x = rect.left - svgRect.left
        const y = rect.top - svgRect.top

        positionMap.set(clusterId, { x, y, width: rect.width, height: rect.height })
        console.log(`[mermaidLayout] cluster "${clusterId}": pos=(${x.toFixed(1)}, ${y.toFixed(1)}), size=${rect.width.toFixed(1)}x${rect.height.toFixed(1)}`)
      }

      // Apply positions and sizes to nodes
      return nodes.map((node) => {
        const info = positionMap.get(node.id)
        if (!info) return node

        if (node.data?.isSubgraph) {
          const parentInfo = node.parentId ? positionMap.get(node.parentId) : null
          return {
            ...node,
            position: {
              x: parentInfo ? info.x - parentInfo.x : info.x,
              y: parentInfo ? info.y - parentInfo.y : info.y,
            },
            style: {
              ...node.style,
              width: info.width,
              height: info.height,
            },
          }
        }

        // For child nodes inside a subgraph, compute relative position
        if (node.parentId) {
          const parentInfo = positionMap.get(node.parentId)
          if (parentInfo) {
            return {
              ...node,
              position: {
                x: info.x - parentInfo.x,
                y: info.y - parentInfo.y,
              },
              style: {
                ...node.style,
                width: info.width,
                height: info.height,
              },
            }
          }
        }

        return {
          ...node,
          position: { x: info.x, y: info.y },
          style: {
            ...node.style,
            width: info.width,
            height: info.height,
          },
        }
      })
    } finally {
      document.body.removeChild(container)
    }
  } catch (e) {
    console.warn('[mermaidLayout] failed, will fallback to dagre:', e)
    return null
  }
}

/** Extract node ID from a mermaid SVG node element */
function extractNodeId(el: Element): string | null {
  // data-id is the most reliable (some mermaid versions)
  const dataId = el.getAttribute('data-id')
  if (dataId) return dataId

  const elId = el.getAttribute('id') || ''

  // Flowchart: "flowchart-NodeId-123"
  let m = elId.match(/flowchart-(.+?)-\d+$/)
  if (m) return m[1]

  // Class diagram: "classId-ClassName-123"
  m = elId.match(/classId-(.+?)-\d+$/)
  if (m) return m[1]

  // State diagram: "state-StateId-123"
  m = elId.match(/state-(.+?)-\d+$/)
  if (m) return m[1]

  // Generic fallback: last segment before trailing number
  m = elId.match(/-([A-Za-z_]\w*)-\d+$/)
  return m ? m[1] : null
}

/** Extract the subgraph ID from a cluster <g> element */
function extractClusterId(el: Element): string | null {
  const dataId = el.getAttribute('data-id')
  if (dataId) return dataId

  const id = el.getAttribute('id')
  if (id) {
    const m = id.match(/flowchart-(.+?)(?:-\d+)?$/)
    if (m) return m[1]
  }

  return null
}
