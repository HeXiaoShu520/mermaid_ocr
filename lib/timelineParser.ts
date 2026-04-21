/**
 * Timeline diagram parser / serializer
 * 语法：
 *   timeline
 *     title 标题
 *     section 分组名
 *     时间周期 : 事件1 : 事件2
 *              : 事件3
 */

export interface TimelineEvent {
  text: string
}

export interface TimelinePeriod {
  id: string
  time: string
  events: TimelineEvent[]
}

export interface TimelineSection {
  id: string
  label: string
  periods: TimelinePeriod[]
}

export interface TimelineData {
  title: string
  sections: TimelineSection[]
}

let _tlCounter = 0

export function parseTimelineDiagram(code: string): TimelineData {
  const lines = code.split('\n').map(l => l.trim()).filter(Boolean)
  let title = ''
  const sections: TimelineSection[] = []
  let currentSection: TimelineSection | null = null
  let currentPeriod: TimelinePeriod | null = null

  const ensureSection = () => {
    if (!currentSection) {
      currentSection = { id: `sec-${++_tlCounter}`, label: '', periods: [] }
      sections.push(currentSection)
    }
  }

  for (const line of lines) {
    if (line === 'timeline') continue
    if (line.startsWith('%%')) continue

    // title
    if (/^title\s+/i.test(line)) {
      title = line.replace(/^title\s+/i, '').trim()
      continue
    }

    // section
    if (/^section\s+/i.test(line)) {
      currentSection = { id: `sec-${++_tlCounter}`, label: line.replace(/^section\s+/i, '').trim(), periods: [] }
      sections.push(currentSection)
      currentPeriod = null
      continue
    }

    // 续行：以 : 开头（属于上一个时间周期的额外事件）
    if (line.startsWith(':') && currentPeriod) {
      const events = line.slice(1).split(':').map(e => e.trim()).filter(Boolean)
      for (const e of events) currentPeriod.events.push({ text: e })
      continue
    }

    // 时间周期行：time : event1 : event2
    if (line.includes(':')) {
      ensureSection()
      const colonIdx = line.indexOf(':')
      const time = line.slice(0, colonIdx).trim()
      const rest = line.slice(colonIdx + 1)
      const events = rest.split(':').map(e => e.trim()).filter(Boolean)
      currentPeriod = {
        id: `period-${++_tlCounter}`,
        time,
        events: events.map(e => ({ text: e })),
      }
      currentSection!.periods.push(currentPeriod)
      continue
    }

    // 纯时间周期（无事件）
    ensureSection()
    currentPeriod = { id: `period-${++_tlCounter}`, time: line, events: [] }
    currentSection!.periods.push(currentPeriod)
  }

  return { title, sections }
}

export function serializeTimelineDiagram(data: TimelineData): string {
  const lines = ['timeline']
  if (data.title) lines.push(`    title ${data.title}`)

  for (const section of data.sections) {
    if (section.label) lines.push(`    section ${section.label}`)
    for (const period of section.periods) {
      if (period.events.length === 0) {
        lines.push(`        ${period.time}`)
      } else {
        const evStr = period.events.map(e => e.text).join(' : ')
        lines.push(`        ${period.time} : ${evStr}`)
      }
    }
  }

  return lines.join('\n')
}
