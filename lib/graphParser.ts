/**
 * Parser 层：Mermaid 代码 → Graph 结构
 * 只负责提取节点和边的逻辑关系，不涉及坐标
 */

export interface GraphNode {
  id: string
  label: string
  shape?:
    | 'rectangle' | 'rounded' | 'stadium' | 'subroutine' | 'cylindrical' | 'circle'
    | 'diamond' | 'hexagon' | 'parallelogram' | 'parallelogram-alt' | 'trapezoid' | 'trapezoid-alt'
    | 'triangle' | 'triangle-down' | 'triangle-left' | 'triangle-right'
    | 'pentagon' | 'octagon' | 'star' | 'cross' | 'plus'
    | 'arrow-right' | 'arrow-left' | 'arrow-up' | 'arrow-down'
    | 'h-cyl' | 'lin-cyl' | 'tag-rect' | 'sl-rect' | 'bow-rect'
    | 'notch-pent' | 'curv-trap' | 'delay' | 'bolt'
    | 'doc' | 'lin-doc' | 'st-doc' | 'tag-doc'
    | 'fork' | 'brace' | 'brace-r' | 'braces' | 'win-pane'
    | 'ellipse' | 'cloud' | 'comment' | 'flag' | 'hourglass' | 'heart' | 'lightning' | 'moon'
  subgraph?: string  // 所属子图 ID
  fillColor?: string
  strokeColor?: string
  textColor?: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  label?: string
  style?: 'solid' | 'dotted' | 'thick'
  arrowType?: 'arrow' | 'none' | 'circle' | 'cross' | 'double'
  strokeColor?: string
}

export interface Subgraph {
  id: string
  label: string
  nodes: string[]  // 节点 ID 列表
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  subgraphs: Subgraph[]
  direction?: 'TB' | 'LR' | 'BT' | 'RL'
}

/**
 * 解析节点定义，识别形状
 */
function parseNodeDefinition(text: string): { id: string; label: string; shape: GraphNode['shape'] } | null {
  // 先检查是否有形状注释标记 %% shape-name
  const commentMatch = text.match(/%%\s*(\S+)\s*$/)
  let shapeFromComment: GraphNode['shape'] | undefined
  if (commentMatch) {
    shapeFromComment = commentMatch[1] as GraphNode['shape']
    // 移除注释部分
    text = text.replace(/\s*%%.*$/, '').trim()
  }

  // A([Label]) - 体育场形（必须在 A(Label) 之前检查）
  let m = text.match(/^(\w+)\(\[([^\]]+)\]\)/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'stadium' }

  // A[[Label]] - 子程序形
  m = text.match(/^(\w+)\[\[([^\]]+)\]\]/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'subroutine' }

  // A[(Label)] - 圆柱形
  m = text.match(/^(\w+)\[\(([^\)]+)\)\]/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'cylindrical' }

  // A((Label)) - 圆形
  m = text.match(/^(\w+)\(\(([^\)]+)\)\)/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'circle' }

  // A{{Label}} - 六边形
  m = text.match(/^(\w+)\{\{([^\}]+)\}\}/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'hexagon' }

  // A[/Label/] - 平行四边形
  m = text.match(/^(\w+)\[\/([^\/]+)\/\]/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'parallelogram' }

  // A[\\Label\\] - 平行四边形（反向）
  m = text.match(/^(\w+)\[\\([^\\]+)\\\]/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'parallelogram-alt' }

  // A[/Label\\] - 梯形
  m = text.match(/^(\w+)\[\/([^\\]+)\\\]/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'trapezoid' }

  // A[\\Label/] - 梯形（反向）
  m = text.match(/^(\w+)\[\\([^\/]+)\/\]/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'trapezoid-alt' }

  // A{Label} - 菱形
  m = text.match(/^(\w+)\{([^\}]+)\}/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'diamond' }

  // A(Label) - 圆角矩形
  m = text.match(/^(\w+)\(([^\)]+)\)/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'rounded' }

  // A[Label] - 矩形（或带注释的扩展形状）
  m = text.match(/^(\w+)\[([^\]]+)\]/)
  if (m) return { id: m[1], label: m[2], shape: shapeFromComment || 'rectangle' }

  return null
}

/**
 * 插入或更新节点（在子图内时更新 subgraph 字段）
 */
function upsertNode(
  nodes: Map<string, GraphNode>,
  subgraphs: Subgraph[],
  id: string,
  data: Omit<GraphNode, 'subgraph'>,
  currentSubgraph: string | null
) {
  if (nodes.has(id)) {
    // 已存在但在子图内 → 更新 subgraph 字段
    if (currentSubgraph && !nodes.get(id)!.subgraph) {
      nodes.get(id)!.subgraph = currentSubgraph
      const sg = subgraphs.find(s => s.id === currentSubgraph)
      if (sg && !sg.nodes.includes(id)) sg.nodes.push(id)
    }
  } else {
    nodes.set(id, { ...data, subgraph: currentSubgraph || undefined })
    if (currentSubgraph) {
      const sg = subgraphs.find(s => s.id === currentSubgraph)
      if (sg) sg.nodes.push(id)
    }
  }
}

/**
 * 解析 Mermaid flowchart 代码
 */
export function parseMermaidFlowchart(code: string): GraphData {
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const subgraphs: Subgraph[] = []
  let direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB'

  const lines = code.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'))

  let currentSubgraph: string | null = null
  const subgraphStack: string[] = []

  for (const line of lines) {
    // 方向
    if (line.match(/^flowchart\s+(TB|LR|BT|RL)/i)) {
      const m = line.match(/^flowchart\s+(TB|LR|BT|RL)/i)
      if (m) direction = m[1].toUpperCase() as any
      continue
    }

    // 子图开始：subgraph id [label]
    if (line.match(/^subgraph\s+(\w+)(?:\s*\[(.+?)\])?/i)) {
      const m = line.match(/^subgraph\s+(\w+)(?:\s*\[(.+?)\])?/i)
      if (m) {
        const subgraphId = m[1]
        const subgraphLabel = m[2] || subgraphId
        subgraphs.push({ id: subgraphId, label: subgraphLabel, nodes: [] })
        subgraphStack.push(subgraphId)
        currentSubgraph = subgraphId
      }
      continue
    }

    // 子图结束
    if (line.match(/^end$/i)) {
      subgraphStack.pop()
      currentSubgraph = subgraphStack[subgraphStack.length - 1] || null
      continue
    }

    // 边：支持多种箭头和标签
    // A -->|label| B, A ---|label| B, A -.->|label| B, A ==>|label| B
    // A --> B, A --- B, A -.-> B, A ==> B
    const edgeWithLabelMatch = line.match(/^(.+?)\s*(-->|---|\.\.->|==>)\s*\|([^\|]+)\|\s*(.+)$/)
    if (edgeWithLabelMatch) {
      const [, fromPart, arrow, label, toPart] = edgeWithLabelMatch

      // 解析源节点
      const fromNode = parseNodeDefinition(fromPart.trim())
      const fromId = fromNode ? fromNode.id : fromPart.trim()
      upsertNode(nodes, subgraphs, fromId, fromNode ? { ...fromNode } : { id: fromId, label: fromId }, currentSubgraph)

      // 解析目标节点
      const toNode = parseNodeDefinition(toPart.trim())
      const toId = toNode ? toNode.id : toPart.trim()
      upsertNode(nodes, subgraphs, toId, toNode ? { ...toNode } : { id: toId, label: toId }, currentSubgraph)

      const edgeStyle = arrow === '==>' ? 'thick' : arrow === '-..->' || arrow === '.-.->' ? 'dotted' : 'solid'
      edges.push({
        id: `${fromId}-${toId}-${edges.length}`,
        source: fromId,
        target: toId,
        label: label.trim(),
        style: edgeStyle,
      })
      continue
    }

    // 边：无标签
    const edgeMatch = line.match(/^(.+?)\s*(-->|---|\.\.->|==>)\s*(.+)$/)
    if (edgeMatch) {
      const [, fromPart, arrow, toPart] = edgeMatch

      // 解析源节点
      const fromNode = parseNodeDefinition(fromPart.trim())
      const fromId = fromNode ? fromNode.id : fromPart.trim()
      upsertNode(nodes, subgraphs, fromId, fromNode ? { ...fromNode } : { id: fromId, label: fromId }, currentSubgraph)

      // 解析目标节点
      const toNode = parseNodeDefinition(toPart.trim())
      const toId = toNode ? toNode.id : toPart.trim()
      upsertNode(nodes, subgraphs, toId, toNode ? { ...toNode } : { id: toId, label: toId }, currentSubgraph)

      const edgeStyle = arrow === '==>' ? 'thick' : arrow === '-..->' || arrow === '.-.->' ? 'dotted' : 'solid'
      edges.push({
        id: `${fromId}-${toId}-${edges.length}`,
        source: fromId,
        target: toId,
        style: edgeStyle,
      })
      continue
    }

    // 单独的节点定义
    const nodeDef = parseNodeDefinition(line)
    if (nodeDef) {
      upsertNode(nodes, subgraphs, nodeDef.id, nodeDef, currentSubgraph)
      continue
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    subgraphs,
    direction,
  }
}
