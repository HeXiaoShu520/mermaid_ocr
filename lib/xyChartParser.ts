export interface XyChartData {
  title: string
  xLabels: string[]
  series: { name: string; type: 'bar' | 'line'; values: number[] }[]
}

export interface XyChartParseResult {
  data: XyChartData | null
  error: string | null
}

export function parseMermaidXyChart(syntax: string): XyChartParseResult {
  try {
    const lines = syntax.split('\n').map(l => l.trim()).filter(Boolean)
    let title = '图表'
    let xLabels: string[] = []
    const series: XyChartData['series'] = []

    for (const line of lines) {
      if (/^xychart-beta/i.test(line)) {
        const m = line.match(/title\s+"([^"]+)"/i)
        if (m) title = m[1]
        continue
      }
      const titleMatch = line.match(/^title\s+"([^"]+)"/i)
      if (titleMatch) { title = titleMatch[1]; continue }

      const xMatch = line.match(/^x-axis\s+(.+)$/i)
      if (xMatch) {
        const inner = xMatch[1].trim()
        const listMatch = inner.match(/^\[(.+)\]$/)
        if (listMatch) {
          xLabels = listMatch[1].split(',').map(s => s.trim().replace(/^"|"$/g, ''))
        }
        continue
      }

      const barMatch = line.match(/^bar\s+\[(.+)\]$/i)
      if (barMatch) {
        const values = barMatch[1].split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v))
        series.push({ name: `bar${series.length + 1}`, type: 'bar', values })
        continue
      }

      const lineMatch = line.match(/^line\s+\[(.+)\]$/i)
      if (lineMatch) {
        const values = lineMatch[1].split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v))
        series.push({ name: `line${series.length + 1}`, type: 'line', values })
        continue
      }
    }

    if (series.length === 0) return { data: null, error: '未找到数据系列' }
    return { data: { title, xLabels, series }, error: null }
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : '解析错误' }
  }
}

export function serializeXyChart(data: XyChartData): string {
  let result = `xychart-beta\n    title "${data.title}"\n`
  if (data.xLabels.length > 0) {
    result += `    x-axis [${data.xLabels.map(l => `"${l}"`).join(', ')}]\n`
  }
  for (const s of data.series) {
    result += `    ${s.type} [${s.values.join(', ')}]\n`
  }
  return result
}
