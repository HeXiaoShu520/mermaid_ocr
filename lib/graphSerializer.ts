/**
 * Serializer 层：Graph → Mermaid 代码 + Layout JSON
 */

import type { NodeState, EdgeState, LayoutMetadata } from './graphEditorStore'

/**
 * 根据形状生成节点语法
 */
function serializeNodeShape(node: NodeState): string {
  const shape = node.shape || 'rectangle'
  const label = node.label

  switch (shape) {
    // 基础形状
    case 'rectangle':
      return `${node.id}[${label}]`
    case 'rounded':
      return `${node.id}(${label})`
    case 'stadium':
      return `${node.id}([${label}])`
    case 'subroutine':
      return `${node.id}[[${label}]]`
    case 'cylindrical':
      return `${node.id}[(${label})]`
    case 'circle':
      return `${node.id}((${label}))`
    case 'diamond':
      return `${node.id}{${label}}`
    case 'hexagon':
      return `${node.id}{{${label}}}`
    case 'parallelogram':
      return `${node.id}[/${label}/]`
    case 'parallelogram-alt':
      return `${node.id}[\\${label}\\]`
    case 'trapezoid':
      return `${node.id}[/${label}\\]`
    case 'trapezoid-alt':
      return `${node.id}[\\${label}/]`

    // 扩展形状（使用最接近的 Mermaid 语法或注释标记）
    case 'triangle':
      return `${node.id}[${label}] %% triangle`
    case 'triangle-down':
      return `${node.id}[${label}] %% triangle-down`
    case 'triangle-left':
      return `${node.id}[${label}] %% triangle-left`
    case 'triangle-right':
      return `${node.id}[${label}] %% triangle-right`
    case 'pentagon':
      return `${node.id}[${label}] %% pentagon`
    case 'octagon':
      return `${node.id}[${label}] %% octagon`
    case 'star':
      return `${node.id}[${label}] %% star`
    case 'cross':
      return `${node.id}[${label}] %% cross`
    case 'plus':
      return `${node.id}[${label}] %% plus`
    case 'arrow-right':
      return `${node.id}[${label}] %% arrow-right`
    case 'arrow-left':
      return `${node.id}[${label}] %% arrow-left`
    case 'arrow-up':
      return `${node.id}[${label}] %% arrow-up`
    case 'arrow-down':
      return `${node.id}[${label}] %% arrow-down`
    case 'h-cyl':
      return `${node.id}[${label}] %% h-cyl`
    case 'lin-cyl':
      return `${node.id}[${label}] %% lin-cyl`
    case 'tag-rect':
      return `${node.id}[${label}] %% tag-rect`
    case 'sl-rect':
      return `${node.id}[${label}] %% sl-rect`
    case 'bow-rect':
      return `${node.id}[${label}] %% bow-rect`
    case 'notch-pent':
      return `${node.id}[${label}] %% notch-pent`
    case 'curv-trap':
      return `${node.id}[${label}] %% curv-trap`
    case 'delay':
      return `${node.id}[${label}] %% delay`
    case 'bolt':
      return `${node.id}[${label}] %% bolt`
    case 'doc':
      return `${node.id}[${label}] %% doc`
    case 'lin-doc':
      return `${node.id}[${label}] %% lin-doc`
    case 'st-doc':
      return `${node.id}[${label}] %% st-doc`
    case 'tag-doc':
      return `${node.id}[${label}] %% tag-doc`
    case 'fork':
      return `${node.id}[${label}] %% fork`
    case 'brace':
      return `${node.id}[${label}] %% brace`
    case 'brace-r':
      return `${node.id}[${label}] %% brace-r`
    case 'braces':
      return `${node.id}[${label}] %% braces`
    case 'win-pane':
      return `${node.id}[${label}] %% win-pane`
    case 'ellipse':
      return `${node.id}[${label}] %% ellipse`
    case 'cloud':
      return `${node.id}[${label}] %% cloud`
    case 'comment':
      return `${node.id}[${label}] %% comment`
    case 'flag':
      return `${node.id}[${label}] %% flag`
    case 'hourglass':
      return `${node.id}[${label}] %% hourglass`
    case 'heart':
      return `${node.id}[${label}] %% heart`
    case 'lightning':
      return `${node.id}[${label}] %% lightning`
    case 'moon':
      return `${node.id}[${label}] %% moon`

    default:
      return `${node.id}[${label}]`
  }
}

/**
 * 序列化为 Mermaid flowchart 代码
 */
export function serializeToMermaid(
  nodes: NodeState[],
  edges: EdgeState[],
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB'
): string {
  const lines: string[] = []

  lines.push(`flowchart ${direction}`)

  // 按子图分组节点
  const subgraphMap = new Map<string, NodeState[]>()
  const noSubgraphNodes: NodeState[] = []

  nodes.forEach(node => {
    if (node.subgraph) {
      if (!subgraphMap.has(node.subgraph)) {
        subgraphMap.set(node.subgraph, [])
      }
      subgraphMap.get(node.subgraph)!.push(node)
    } else {
      noSubgraphNodes.push(node)
    }
  })

  // 输出非子图节点
  noSubgraphNodes.forEach(node => {
    if (node.label !== node.id || node.shape) {
      lines.push(`  ${serializeNodeShape(node)}`)
    }
  })

  // 输出子图
  subgraphMap.forEach((subgraphNodes, subgraphId) => {
    lines.push(`  subgraph ${subgraphId}`)
    subgraphNodes.forEach(node => {
      if (node.label !== node.id || node.shape) {
        lines.push(`    ${serializeNodeShape(node)}`)
      }
    })
    lines.push(`  end`)
  })

  // 边定义
  edges.forEach(edge => {
    const arrow = edge.style === 'thick' ? '==>' : edge.style === 'dotted' ? '-..->' : '-->'
    if (edge.label) {
      lines.push(`  ${edge.source} ${arrow}|${edge.label}| ${edge.target}`)
    } else {
      lines.push(`  ${edge.source} ${arrow} ${edge.target}`)
    }
  })

  return lines.join('\n')
}

/**
 * 提取布局元数据
 */
export function extractLayoutMetadata(nodes: NodeState[]): LayoutMetadata {
  const layout: LayoutMetadata = {}
  nodes.forEach(node => {
    layout[node.id] = { x: node.x, y: node.y }
  })
  return layout
}

/**
 * 导出完整数据（代码 + 布局）
 */
export interface ExportData {
  code: string
  layout: LayoutMetadata
}

export function exportGraph(
  nodes: NodeState[],
  edges: EdgeState[],
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB'
): ExportData {
  return {
    code: serializeToMermaid(nodes, edges, direction),
    layout: extractLayoutMetadata(nodes),
  }
}

/**
 * 导出为 JSON 字符串
 */
export function exportGraphJSON(
  nodes: NodeState[],
  edges: EdgeState[],
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB'
): string {
  return JSON.stringify(exportGraph(nodes, edges, direction), null, 2)
}
