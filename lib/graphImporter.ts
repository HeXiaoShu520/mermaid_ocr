/**
 * 导入逻辑：优先使用 Layout，否则 dagre
 */

import { parseMermaidFlowchart } from './graphParser'
import { dagreLayout, applyLayout } from './graphLayout'
import type { LayoutMetadata } from './graphEditorStore'
import type { ExportData } from './graphSerializer'

export interface ImportResult {
  nodes: any[]
  edges: any[]
  subgraphs: any[]
  layout: LayoutMetadata | null
  direction?: 'TB' | 'LR' | 'BT' | 'RL'
  curveStyle?: 'basis' | 'linear' | 'step' | 'stepBefore' | 'stepAfter' | 'monotoneX' | 'monotoneY'
}

/**
 * 从 Mermaid 代码导入（无布局数据，使用 dagre）
 */
export function importFromCode(code: string, direction?: 'TB' | 'LR' | 'BT' | 'RL'): ImportResult {
  const graph = parseMermaidFlowchart(code)
  const layoutDirection = direction || graph.direction || 'TB'
  const layoutResult = dagreLayout(graph.nodes, graph.edges, layoutDirection)

  return {
    nodes: layoutResult.nodes,
    edges: layoutResult.edges,
    subgraphs: graph.subgraphs,
    layout: null,
    direction: layoutDirection,
    curveStyle: graph.curveStyle,
  }
}

/**
 * 从完整数据导入（有布局数据，优先使用）
 */
export function importFromExportData(data: ExportData): ImportResult {
  const graph = parseMermaidFlowchart(data.code)

  // 如果有布局数据，应用它
  if (data.layout && Object.keys(data.layout).length > 0) {
    const nodes = applyLayout(graph.nodes, data.layout)
    return {
      nodes,
      edges: graph.edges,
      subgraphs: graph.subgraphs,
      layout: data.layout,
    }
  }

  // 否则使用 dagre
  const layoutResult = dagreLayout(graph.nodes, graph.edges, graph.direction)
  return {
    nodes: layoutResult.nodes,
    edges: layoutResult.edges,
    subgraphs: graph.subgraphs,
    layout: null,
  }
}

/**
 * 从 JSON 字符串导入
 */
export function importFromJSON(json: string): ImportResult {
  try {
    const data = JSON.parse(json) as ExportData
    return importFromExportData(data)
  } catch (err) {
    console.error('[importFromJSON] 解析失败:', err)
    throw new Error('无效的 JSON 格式')
  }
}
