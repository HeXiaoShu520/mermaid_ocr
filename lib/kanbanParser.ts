/**
 * Kanban diagram parser
 * 解析 Mermaid kanban 语法
 *
 * 语法规则：
 * - 第一行 `kanban`
 * - 缩进较少 = 列名（纯文本或 [label] 或 id[label]）
 * - 缩进较多 = 卡片（[label] 或 id[label] 或 id[label]@{ metadata }）
 * - 列和卡片通过相对缩进区分
 */

export interface KanbanItem {
  id: string
  label: string
  metadata?: Record<string, string>
}

export interface KanbanColumn {
  id: string
  label: string
  items: KanbanItem[]
}

export interface KanbanData {
  columns: KanbanColumn[]
}

let _kanbanColCounter = 0
let _kanbanItemCounter = 0

/** 将 label 转为合法的 mermaid id（字母数字下划线，中文转拼音首字母或直接保留） */
function labelToId(label: string, usedIds: Set<string>): string {
  // 保留字母数字下划线，其余替换为下划线
  let base = label.replace(/[^\w]/g, '_').replace(/^(\d)/, '_$1').slice(0, 20) || 'col'
  let id = base
  let n = 2
  while (usedIds.has(id)) { id = `${base}_${n++}` }
  usedIds.add(id)
  return id
}

export function parseKanbanDiagram(code: string): KanbanData {
  const columns: KanbanColumn[] = []
  const lines = code.split('\n')
  const usedColIds = new Set<string>()

  let currentColumn: KanbanColumn | null = null
  let colIndent = -1 // 第一个列的缩进

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed === 'kanban' || trimmed.startsWith('%%')) continue

    const indent = rawLine.search(/\S/)
    if (indent < 0) continue

    // 第一个非 kanban 行确定列缩进
    if (colIndent < 0) colIndent = indent

    const isCard = currentColumn !== null && indent > colIndent

    if (!isCard) {
      // ─── 列 ───
      // id[label]
      const idBracket = trimmed.match(/^(\w+)\[([^\]]+)\]$/)
      if (idBracket) {
        const id = idBracket[1]
        usedColIds.add(id)
        currentColumn = { id, label: idBracket[2], items: [] }
        columns.push(currentColumn)
        colIndent = indent
        continue
      }
      // [label]
      const bracket = trimmed.match(/^\[([^\]]+)\]$/)
      if (bracket) {
        const label = bracket[1]
        const id = labelToId(label, usedColIds)
        currentColumn = { id, label, items: [] }
        columns.push(currentColumn)
        colIndent = indent
        continue
      }
      // 纯文本
      const id = labelToId(trimmed, usedColIds)
      currentColumn = { id, label: trimmed, items: [] }
      columns.push(currentColumn)
      colIndent = indent
      continue
    }

    // ─── 卡片 ───
    if (!currentColumn) continue

    // 提取 @{ ... } 元数据
    let metaStr: string | undefined
    let mainPart = trimmed
    const metaMatch = trimmed.match(/@\{\s*([^}]+)\}\s*$/)
    if (metaMatch) {
      metaStr = metaMatch[1]
      mainPart = trimmed.slice(0, metaMatch.index!).trim()
    }

    let itemId: string
    let itemLabel: string

    // id[label]
    const idBracket = mainPart.match(/^(\w+)\[([^\]]+)\]$/)
    if (idBracket) {
      itemId = idBracket[1]
      itemLabel = idBracket[2]
    } else {
      // [label]
      const bracket = mainPart.match(/^\[([^\]]+)\]$/)
      if (bracket) {
        itemId = `item-${++_kanbanItemCounter}`
        itemLabel = bracket[1]
      } else {
        // 纯文本
        itemId = `item-${++_kanbanItemCounter}`
        itemLabel = mainPart
      }
    }

    let metadata: Record<string, string> | undefined
    if (metaStr) {
      metadata = {}
      // 解析 key: 'value' 或 key: value
      const regex = /(\w+)\s*:\s*(?:'([^']*)'|"([^"]*)"|(\S+?))\s*(?:,|$)/g
      let m
      while ((m = regex.exec(metaStr)) !== null) {
        metadata[m[1]] = m[2] ?? m[3] ?? m[4] ?? ''
      }
    }

    currentColumn.items.push({ id: itemId, label: itemLabel, metadata })
  }

  return { columns }
}

export function serializeKanbanDiagram(data: KanbanData): string {
  const lines = ['kanban']

  for (const col of data.columns) {
    // 列始终用 id[label] 格式，确保唯一性
    lines.push(`  ${col.id}[${col.label}]`)

    for (const item of col.items) {
      let line = ''
      if (item.id.startsWith('item-')) {
        // 自动生成的 id，用 [label] 格式
        line = `    [${item.label}]`
      } else {
        line = `    ${item.id}[${item.label}]`
      }

      if (item.metadata && Object.keys(item.metadata).length > 0) {
        const pairs = Object.entries(item.metadata)
          .map(([k, v]) => `${k}: '${v}'`)
          .join(', ')
        line += `@{ ${pairs} }`
      }

      lines.push(line)
    }
  }

  return lines.join('\n')
}
