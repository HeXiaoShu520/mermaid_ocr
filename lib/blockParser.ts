/**
 * Block diagram parser
 * 解析 Mermaid block-beta 语法
 *
 * 语法规则：
 * - 第一行 `block-beta`
 * - columns N 指定列数
 * - 块格式：id["label"] 或 id("label") 等
 * - space 或 space:N 表示空白块
 * - id:N 表示跨列
 */

export type BlockShape =
  | 'rectangle'      // id["label"]
  | 'rounded'        // id("label")
  | 'stadium'        // id(["label"])
  | 'subroutine'     // id[["label"]]
  | 'cylinder'       // id[("label")]
  | 'circle'         // id(("label"))
  | 'diamond'        // id{"label"}
  | 'hexagon'        // id{{"label"}}
  | 'parallelogram'  // id[/"label"/]
  | 'trapezoid'      // id[\"label"\]
  | 'double-circle'  // id((("label")))

export interface BlockItem {
  id: string
  label: string
  shape: BlockShape
  colspan?: number
  isSpace?: boolean
}

export interface BlockData {
  columns: number
  blocks: BlockItem[]
}

let _blockCounter = 0

const SHAPE_PATTERNS: [RegExp, BlockShape][] = [
  [/^(\w+)\(\(\("([^"]+)"\)\)\)$/, 'double-circle'],
  [/^(\w+)\(\("([^"]+)"\)\)$/, 'circle'],
  [/^(\w+)\(\["([^"]+)"\]\)$/, 'stadium'],
  [/^(\w+)\(\("([^"]+)"\)\)$/, 'circle'],
  [/^(\w+)\("([^"]+)"\)$/, 'rounded'],
  [/^(\w+)\[\["([^"]+)"\]\]$/, 'subroutine'],
  [/^(\w+)\[\("([^"]+)"\)\]$/, 'cylinder'],
  [/^(\w+)\{\{"([^"]+)"\}\}$/, 'hexagon'],
  [/^(\w+)\{"([^"]+)"\}$/, 'diamond'],
  [/^(\w+)\[\\?"([^"]+)"\\?\]$/, 'trapezoid'],
  [/^(\w+)\[\/"([^"]+)"\/\]$/, 'parallelogram'],
  [/^(\w+)\["([^"]+)"\]$/, 'rectangle'],
]

export function parseBlockDiagram(code: string): BlockData {
  const lines = code.split('\n')
  let columns = 3
  const blocks: BlockItem[] = []

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed === 'block-beta' || trimmed.startsWith('%%')) continue

    // columns N
    const colMatch = trimmed.match(/^columns\s+(\d+)$/)
    if (colMatch) {
      columns = parseInt(colMatch[1])
      continue
    }

    // 将行拆分为 token（保留带括号/引号的完整块语法）
    // 用正则提取每个 token：space[:N] 或 形状语法
    const tokenRe = /space(?::\d+)?|[\w:]+(?:\(\(\("[^"]*"\)\)\)|\(\("[^"]*"\)\)|\(\["[^"]*"\]\)|\("([^"]*)"\)|\[\["[^"]*"\]\]|\[\("([^"]*)"\)\]|\{\{"[^"]*"\}\}|\{"[^"]*"\}|\[\/"[^"]*"\/\]|\[\\"[^"]*"\\\]|\["[^"]*"\])/g
    const tokens = trimmed.match(tokenRe)
    if (!tokens) continue

    for (const token of tokens) {
      // space 或 space:N
      const spaceMatch = token.match(/^space(?::(\d+))?$/)
      if (spaceMatch) {
        const colspan = spaceMatch[1] ? parseInt(spaceMatch[1]) : 1
        blocks.push({ id: `space-${++_blockCounter}`, label: '', shape: 'rectangle', colspan, isSpace: true })
        continue
      }

      let matched = false
      for (const [pattern, shape] of SHAPE_PATTERNS) {
        const m = token.match(pattern)
        if (m) {
          const [, id, label] = m
          const colonMatch = id.match(/^(\w+):(\d+)$/)
          const actualId = colonMatch ? colonMatch[1] : id
          const colspan = colonMatch ? parseInt(colonMatch[2]) : undefined
          blocks.push({ id: actualId, label, shape, colspan })
          matched = true
          break
        }
      }

      if (!matched) {
        const simpleColspan = token.match(/^(\w+):(\d+)$/)
        if (simpleColspan) {
          blocks.push({ id: simpleColspan[1], label: simpleColspan[1], shape: 'rectangle', colspan: parseInt(simpleColspan[2]) })
        }
      }
    }
  }

  return { columns, blocks }
}

export function serializeBlockDiagram(data: BlockData): string {
  const lines = ['block-beta']
  lines.push(`  columns ${data.columns}`)

  for (const block of data.blocks) {
    if (block.isSpace) {
      const span = block.colspan && block.colspan > 1 ? `:${block.colspan}` : ''
      lines.push(`  space${span}`)
      continue
    }

    const id = block.colspan && block.colspan > 1 ? `${block.id}:${block.colspan}` : block.id
    let syntax = ''

    switch (block.shape) {
      case 'double-circle':
        syntax = `${id}((("${block.label}")))`
        break
      case 'circle':
        syntax = `${id}(("${block.label}"))`
        break
      case 'stadium':
        syntax = `${id}(["${block.label}"])`
        break
      case 'rounded':
        syntax = `${id}("${block.label}")`
        break
      case 'subroutine':
        syntax = `${id}[["${block.label}"]]`
        break
      case 'cylinder':
        syntax = `${id}[("${block.label}")]`
        break
      case 'hexagon':
        syntax = `${id}{{"${block.label}"}}`
        break
      case 'diamond':
        syntax = `${id}{"${block.label}"}`
        break
      case 'trapezoid':
        syntax = `${id}[\\"${block.label}"\\]`
        break
      case 'parallelogram':
        syntax = `${id}[/"${block.label}"/]`
        break
      default: // rectangle
        syntax = `${id}["${block.label}"]`
    }

    lines.push(`  ${syntax}`)
  }

  return lines.join('\n')
}
