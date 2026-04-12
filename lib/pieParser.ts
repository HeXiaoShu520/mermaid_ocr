export interface PieData {
  label: string
  value: number
}

export interface PieParseResult {
  title: string
  data: PieData[]
  error: string | null
}

export function parseMermaidPieChart(syntax: string): PieParseResult {
  const empty: PieParseResult = { title: '', data: [], error: null }

  try {
    const lines = syntax.split('\n').map(l => l.trim()).filter(Boolean)
    let title = '饼图'
    const data: PieData[] = []

    for (const line of lines) {
      // Skip pie header
      if (/^pie\s*$/i.test(line)) continue

      // Parse title
      const titleMatch = line.match(/^pie\s+title\s+(.+)$/i)
      if (titleMatch) {
        title = titleMatch[1].trim()
        continue
      }

      // Skip comments
      if (/^%%/.test(line)) continue

      // Parse data: "Label" : value
      const dataMatch = line.match(/^"([^"]+)"\s*:\s*(\d+(?:\.\d+)?)$/)
      if (dataMatch) {
        const [, label, valueStr] = dataMatch
        const value = parseFloat(valueStr)
        if (!isNaN(value) && value > 0) {
          data.push({ label, value })
        }
        continue
      }

      // Parse data without quotes: Label : value
      const dataMatch2 = line.match(/^([^:]+?)\s*:\s*(\d+(?:\.\d+)?)$/)
      if (dataMatch2) {
        const [, label, valueStr] = dataMatch2
        const value = parseFloat(valueStr)
        if (!isNaN(value) && value > 0) {
          data.push({ label: label.trim(), value })
        }
      }
    }

    if (data.length === 0) {
      return { ...empty, error: '未找到饼图数据' }
    }

    return { title, data, error: null }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : '解析错误' }
  }
}

export function serializePieChart(title: string, data: PieData[]): string {
  let result = `pie title ${title}\n`
  for (const item of data) {
    result += `    "${item.label}" : ${item.value}\n`
  }
  return result
}
