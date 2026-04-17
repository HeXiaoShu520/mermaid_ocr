/**
 * Serializer 层：Graph → Mermaid 代码 + Layout JSON
 */

import type { NodeState, EdgeState, LayoutMetadata, SubgraphState } from './graphEditorStore'

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
    case 'cylinder':
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

    // 扩展形状：使用 Mermaid v11 @{ shape } 语法
    case 'triangle':
      return `${node.id}@{ shape: tri, label: "${label}" }`
    case 'flag':
      return `${node.id}@{ shape: flag, label: "${label}" }`
    case 'hourglass':
      return `${node.id}@{ shape: hourglass, label: "${label}" }`
    case 'bolt':
      return `${node.id}@{ shape: bolt, label: "${label}" }`
    case 'doc':
      return `${node.id}@{ shape: doc, label: "${label}" }`
    case 'delay':
      return `${node.id}@{ shape: delay, label: "${label}" }`
    case 'fork':
      return `${node.id}@{ shape: fork, label: "${label}" }`
    case 'cloud':
      return `${node.id}@{ shape: cloud, label: "${label}" }`
    case 'tag-rect':
      return `${node.id}@{ shape: tag-rect, label: "${label}" }`
    case 'win-pane':
      return `${node.id}@{ shape: win-pane, label: "${label}" }`
    case 'notch-pent':
      return `${node.id}@{ shape: notch-pent, label: "${label}" }`
    case 'curv-trap':
      return `${node.id}@{ shape: curv-trap, label: "${label}" }`
    case 'lin-cyl':
      return `${node.id}@{ shape: lin-cyl, label: "${label}" }`
    case 'h-cyl':
      return `${node.id}@{ shape: h-cyl, label: "${label}" }`
    case 'st-doc':
      return `${node.id}@{ shape: st-doc, label: "${label}" }`
    case 'tag-doc':
      return `${node.id}@{ shape: tag-doc, label: "${label}" }`
    case 'bow-rect':
      return `${node.id}@{ shape: bow-rect, label: "${label}" }`
    case 'sl-rect':
      return `${node.id}@{ shape: sl-rect, label: "${label}" }`
    case 'lin-doc':
      return `${node.id}@{ shape: lin-doc, label: "${label}" }`
    case 'brace':
      return `${node.id}@{ shape: brace, label: "${label}" }`
    case 'brace-r':
      return `${node.id}@{ shape: brace-r, label: "${label}" }`
    case 'braces':
      return `${node.id}@{ shape: braces, label: "${label}" }`
    case 'ellipse':
      return `${node.id}@{ shape: ellipse, label: "${label}" }`
    case 'text':
      return `${node.id}@{ shape: text, label: "${label}" }`

    case 'comment':
      return `${node.id}@{ shape: text, label: "${label}" }`

    // 无对应语法，降级为矩形
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
  direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB',
  subgraphs: SubgraphState[] = [],
  curveStyle: 'basis' | 'linear' | 'step' | 'stepBefore' | 'stepAfter' | 'monotoneX' | 'monotoneY' = 'basis'
): string {
  const lines: string[] = []

  // 添加曲线样式配置
  if (curveStyle !== 'basis') {
    lines.push(`%%{init: {'flowchart': {'curve': '${curveStyle}'}}}%%`)
  }

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

  // 输出子图（带标签）
  subgraphMap.forEach((subgraphNodes, subgraphId) => {
    const sg = subgraphs.find(s => s.id === subgraphId)
    const label = sg && sg.label !== sg.id ? ` [${sg.label}]` : ''
    lines.push(`  subgraph ${subgraphId}${label}`)
    subgraphNodes.forEach(node => {
      lines.push(`    ${serializeNodeShape(node)}`)
    })
    lines.push(`  end`)
  })

  // 边定义
  edges.forEach(edge => {
    let arrow: string
    const noArrow = edge.arrowType === 'none'
    if (edge.style === 'thick') {
      arrow = noArrow ? '===' : '==>'
    } else if (edge.style === 'dotted') {
      arrow = noArrow ? '-.-' : '-..->'
    } else {
      arrow = noArrow ? '---' : '-->'
    }
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
