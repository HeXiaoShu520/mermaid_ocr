/**
 * TreeView diagram parser
 * 解析 Mermaid treeView-beta 语法
 *
 * 语法规则：
 * - 第一行 `treeView-beta`
 * - 缩进决定层级关系
 * - 每行一个节点，格式为 "label" 或 label
 */

export interface TreeNode {
  id: string
  label: string
  children: TreeNode[]
  level: number
}

export interface TreeViewData {
  root: TreeNode[]
}

let _treeNodeCounter = 0

export function parseTreeViewDiagram(code: string): TreeViewData {
  const lines = code.split('\n')
  const root: TreeNode[] = []
  const stack: { node: TreeNode; indent: number }[] = []

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed === 'treeView-beta' || trimmed.startsWith('%%')) continue

    const indent = rawLine.search(/\S/)
    if (indent < 0) continue

    // 提取标签（支持引号）
    let label = trimmed
    const quoted = trimmed.match(/^"([^"]+)"$/)
    if (quoted) {
      label = quoted[1]
    }

    const node: TreeNode = {
      id: `tree-${++_treeNodeCounter}`,
      label,
      children: [],
      level: indent,
    }

    // 找到父节点
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop()
    }

    if (stack.length === 0) {
      root.push(node)
    } else {
      stack[stack.length - 1].node.children.push(node)
    }

    stack.push({ node, indent })
  }

  return { root }
}

export function serializeTreeViewDiagram(data: TreeViewData): string {
  const lines = ['treeView-beta']

  function serializeNode(node: TreeNode, indent: number) {
    const prefix = '    '.repeat(indent)
    // 如果标签包含空格或特殊字符，加引号
    const needsQuotes = /[\s\[\]{}()]/.test(node.label)
    const label = needsQuotes ? `"${node.label}"` : node.label
    lines.push(`${prefix}${label}`)
    for (const child of node.children) {
      serializeNode(child, indent + 1)
    }
  }

  for (const node of data.root) {
    serializeNode(node, 0)
  }

  return lines.join('\n')
}
