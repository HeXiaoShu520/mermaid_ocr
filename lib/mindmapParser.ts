/**
 * Mindmap diagram parser / serializer
 * 语法：基于缩进的树形结构
 *
 * 节点形状：
 *   默认（无括号）  → default
 *   [text]         → square
 *   (text)         → rounded
 *   ((text))       → circle
 *   )text(         → bang
 *   {{text}}       → cloud / hexagon
 *
 * 特殊语法：
 *   Node::icon(fa fa-xxx)   → 图标
 *   Node:::className        → CSS 类
 */

export type MindmapShape = 'default' | 'square' | 'rounded' | 'circle' | 'bang' | 'cloud'

export interface MindmapNode {
  id: string
  label: string
  shape: MindmapShape
  icon?: string
  cssClass?: string
  children: MindmapNode[]
  /** 原始缩进层级（0 = 根节点） */
  depth: number
}

export interface MindmapData {
  root: MindmapNode | null
}

let _nodeCounter = 0

function parseNodeText(raw: string): { label: string; shape: MindmapShape; icon?: string; cssClass?: string } {
  let text = raw.trim()
  let icon: string | undefined
  let cssClass: string | undefined

  // 提取 ::icon(...)
  const iconMatch = text.match(/::icon\(([^)]+)\)/)
  if (iconMatch) {
    icon = iconMatch[1].trim()
    text = text.replace(iconMatch[0], '').trim()
  }

  // 提取 :::className
  const classMatch = text.match(/:::(\S+)/)
  if (classMatch) {
    cssClass = classMatch[1]
    text = text.replace(classMatch[0], '').trim()
  }

  // 识别形状
  if (/^\(\((.+)\)\)$/.test(text)) {
    return { label: text.slice(2, -2).trim(), shape: 'circle', icon, cssClass }
  }
  if (/^\{\{(.+)\}\}$/.test(text)) {
    return { label: text.slice(2, -2).trim(), shape: 'cloud', icon, cssClass }
  }
  if (/^\[(.+)\]$/.test(text)) {
    return { label: text.slice(1, -1).trim(), shape: 'square', icon, cssClass }
  }
  if (/^\((.+)\)$/.test(text)) {
    return { label: text.slice(1, -1).trim(), shape: 'rounded', icon, cssClass }
  }
  if (/^\)(.+)\($/.test(text)) {
    return { label: text.slice(1, -1).trim(), shape: 'bang', icon, cssClass }
  }
  return { label: text, shape: 'default', icon, cssClass }
}

export function parseMindmap(code: string): MindmapData {
  const lines = code.split('\n')
  const contentLines: { indent: number; text: string }[] = []

  for (const line of lines) {
    const trimmed = line.trimEnd()
    if (!trimmed.trim() || /^mindmap\s*$/.test(trimmed.trim()) || trimmed.trim().startsWith('%%')) continue
    const indent = trimmed.length - trimmed.trimStart().length
    contentLines.push({ indent, text: trimmed.trim() })
  }

  if (contentLines.length === 0) return { root: null }

  // 构建树：用栈跟踪父节点
  const makeNode = (text: string, depth: number): MindmapNode => {
    const parsed = parseNodeText(text)
    return {
      id: `mm-${++_nodeCounter}`,
      ...parsed,
      children: [],
      depth,
    }
  }

  const root = makeNode(contentLines[0].text, 0)
  const stack: { node: MindmapNode; indent: number }[] = [{ node: root, indent: contentLines[0].indent }]

  for (let i = 1; i < contentLines.length; i++) {
    const { indent, text } = contentLines[i]

    // 弹出缩进 >= 当前的节点
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    const parent = stack[stack.length - 1].node
    const depth = parent.depth + 1
    const node = makeNode(text, depth)
    parent.children.push(node)
    stack.push({ node, indent })
  }

  return { root }
}

function serializeNode(node: MindmapNode, depth: number): string[] {
  const indent = '  '.repeat(depth)
  let text = node.label

  // 应用形状
  switch (node.shape) {
    case 'square': text = `[${text}]`; break
    case 'rounded': text = `(${text})`; break
    case 'circle': text = `((${text}))`; break
    case 'bang': text = `)${text}(`; break
    case 'cloud': text = `{{${text}}}`; break
  }

  if (node.icon) text += `::icon(${node.icon})`
  if (node.cssClass) text += `:::${node.cssClass}`

  const lines = [`${indent}${text}`]
  for (const child of node.children) {
    lines.push(...serializeNode(child, depth + 1))
  }
  return lines
}

export function serializeMindmap(data: MindmapData): string {
  if (!data.root) return 'mindmap\n  Root'
  const lines = ['mindmap']
  lines.push(...serializeNode(data.root, 1))
  return lines.join('\n')
}
