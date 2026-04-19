/**
 * Parser 层：Mermaid 代码 → Graph 结构
 * 只负责提取节点和边的逻辑关系，不涉及坐标
 */

export interface GraphNode {
  id: string
  label: string
  shape?:
    | 'rectangle' | 'rounded' | 'stadium' | 'subroutine' | 'cylinder' | 'cylindrical' | 'circle'
    | 'diamond' | 'hexagon' | 'parallelogram' | 'parallelogram-alt' | 'trapezoid' | 'trapezoid-alt'
    | 'triangle' | 'triangle-down' | 'triangle-left' | 'triangle-right'
    | 'pentagon' | 'octagon' | 'star' | 'cross' | 'plus'
    | 'arrow-right' | 'arrow-left' | 'arrow-up' | 'arrow-down'
    | 'h-cyl' | 'lin-cyl' | 'tag-rect' | 'sl-rect' | 'bow-rect'
    | 'notch-pent' | 'curv-trap' | 'delay' | 'bolt'
    | 'doc' | 'lin-doc' | 'st-doc' | 'tag-doc'
    | 'fork' | 'brace' | 'brace-r' | 'braces' | 'win-pane'
    | 'ellipse' | 'cloud' | 'comment' | 'flag' | 'hourglass' | 'heart' | 'lightning' | 'moon' | 'text'
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
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  subgraphs: Subgraph[]
  direction?: 'TB' | 'LR' | 'BT' | 'RL'
  curveStyle?: 'basis' | 'linear' | 'step' | 'stepBefore' | 'stepAfter' | 'monotoneX' | 'monotoneY'
}

/**
 * 解析节点定义，识别形状
 */
function parseNodeDefinition(text: string): { id: string; label: string; shape: GraphNode['shape'] } | null {
  // Mermaid v11 @{ shape: xxx, label: "yyy" } 语法
  const atShapeMatch = text.match(/^(\w+)@\{\s*shape:\s*([\w-]+)(?:,\s*label:\s*"([^"]*)")?\s*\}/)
  if (atShapeMatch) {
    const SHAPE_MAP: Record<string, GraphNode['shape']> = {
      'rect': 'rectangle', 'rounded': 'rounded', 'stadium': 'stadium', 'pill': 'stadium',
      'fr-rect': 'subroutine', 'subproc': 'subroutine',
      'cyl': 'cylindrical', 'diam': 'diamond', 'hex': 'hexagon',
      'circle': 'circle', 'dbl-circ': 'circle',
      'tri': 'triangle', 'flip-tri': 'triangle',
      'lean-r': 'parallelogram', 'lean-l': 'parallelogram-alt',
      'trap-b': 'trapezoid', 'trap-t': 'trapezoid-alt',
      'flag': 'flag', 'hourglass': 'hourglass', 'cloud': 'cloud',
      'h-cyl': 'h-cyl', 'lin-cyl': 'lin-cyl',
      'tag-rect': 'tag-rect', 'sl-rect': 'sl-rect', 'bow-rect': 'bow-rect',
      'notch-pent': 'notch-pent', 'curv-trap': 'curv-trap',
      'delay': 'delay', 'bolt': 'bolt',
      'doc': 'doc', 'lin-doc': 'lin-doc', 'st-doc': 'st-doc', 'tag-doc': 'tag-doc',
      'fork': 'fork', 'brace': 'brace', 'brace-r': 'brace-r', 'braces': 'braces',
      'win-pane': 'win-pane', 'ellipse': 'ellipse', 'text': 'text',
    }
    const mappedShape = SHAPE_MAP[atShapeMatch[2]] ?? atShapeMatch[2] as GraphNode['shape']
    return { id: atShapeMatch[1], label: atShapeMatch[3] || atShapeMatch[1], shape: mappedShape }
  }

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
    const existing = nodes.get(id)!
    if (!existing.shape && data.shape) existing.shape = data.shape
    if (existing.label === id && data.label !== id) existing.label = data.label
    // 允许子图声明覆盖节点归属
    if (currentSubgraph) {
      // 如果节点已属于其他子图，从旧子图移除
      if (existing.subgraph && existing.subgraph !== currentSubgraph) {
        const oldSg = subgraphs.find(s => s.id === existing.subgraph)
        if (oldSg) {
          const idx = oldSg.nodes.indexOf(id)
          if (idx !== -1) oldSg.nodes.splice(idx, 1)
        }
      }
      existing.subgraph = currentSubgraph
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
 * 根据箭头符号判断边样式
 */
function classifyEdgeStyle(arrow: string): 'solid' | 'dotted' | 'thick' {
  if (/=/.test(arrow)) return 'thick'
  if (/\./.test(arrow)) return 'dotted'
  return 'solid'
}

/**
 * 根据箭头符号判断箭头类型
 */
function classifyArrowType(arrow: string): 'arrow' | 'none' | 'circle' | 'cross' {
  if (/x$/.test(arrow)) return 'cross'
  if (/o$/.test(arrow)) return 'circle'
  if (/>$/.test(arrow)) return 'arrow'
  if (/~$/.test(arrow)) return 'none'
  // --- 或 === 无箭头
  if (/^-+-$/.test(arrow) || /^=+=/.test(arrow)) return 'none'
  return 'arrow'
}

/**
 * 解析 Mermaid flowchart 代码
 */
export function parseMermaidFlowchart(code: string): GraphData {
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const subgraphs: Subgraph[] = []
  let direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB'
  let curveStyle: GraphData['curveStyle'] = undefined

  // 先从 init 指令中提取 curveStyle
  const initMatch = code.match(/%%\{init:\s*(\{[\s\S]*?\})\s*\}%%/)
  if (initMatch) {
    try {
      const initStr = initMatch[1].replace(/'/g, '"')
      const initObj = JSON.parse(initStr)
      const curve = initObj?.flowchart?.curve
      if (curve) {
        curveStyle = curve as GraphData['curveStyle']
      }
    } catch {
      // init 解析失败，忽略
    }
  }

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
    if (line.match(/^subgraph\s+(.+?)(?:\s*\[(.+?)\])?\s*$/i)) {
      const m = line.match(/^subgraph\s+(.+?)(?:\s*\[(.+?)\])?\s*$/i)
      if (m) {
        const subgraphId = m[1].trim()
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
    // 用一个通用正则匹配所有 Mermaid 边语法
    const ARROW_RE = /<?-+\.+-+>?|-?\.+->|<?-+>|<?>?=+>?|<?>?-+-<?|=+=|~+|-+x|-+o/
    const edgeWithLabelRe = new RegExp(`^(.+?)\\s*(${ARROW_RE.source})\\s*\\|([^\\|]+)\\|\\s*(.+)$`)
    const edgeWithLabelMatch = line.match(edgeWithLabelRe)
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

      const edgeStyle = classifyEdgeStyle(arrow)
      const arrowType = classifyArrowType(arrow)
      edges.push({
        id: `${fromId}-${toId}-${edges.length}`,
        source: fromId,
        target: toId,
        label: label.trim(),
        style: edgeStyle,
        arrowType,
      })
      continue
    }

    // 边：无标签
    const edgeRe = new RegExp(`^(.+?)\\s*(${ARROW_RE.source})\\s*(.+)$`)
    const edgeMatch = line.match(edgeRe)
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

      const edgeStyle = classifyEdgeStyle(arrow)
      const arrowType = classifyArrowType(arrow)
      edges.push({
        id: `${fromId}-${toId}-${edges.length}`,
        source: fromId,
        target: toId,
        style: edgeStyle,
        arrowType,
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
    curveStyle,
  }
}
