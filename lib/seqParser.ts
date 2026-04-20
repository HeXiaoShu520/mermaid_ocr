/**
 * 时序图解析器和序列化器
 * 支持 participant, message, fragment (loop/alt/opt/par/critical/break/rect)
 */

import type { SeqParticipant, SeqMessage, SeqFragment, SeqFragmentSection } from './seqEditorStore'
import { SEQ_PAD_X, SEQ_COL_W } from './seqEditorStore'

// ─── 解析 ───────────────────────────────────────────────────────────────────

export interface SeqParseResult {
  participants: SeqParticipant[]
  messages: SeqMessage[]
  fragments: SeqFragment[]
}

const FRAGMENT_TYPES = ['loop', 'alt', 'opt', 'par', 'critical', 'break', 'rect'] as const
type FragmentType = typeof FRAGMENT_TYPES[number]

const MESSAGE_PATTERNS: [RegExp, 'solid' | 'dashed', 'filled' | 'open' | 'none'][] = [
  [/^(.+?)-->>([+-])?\s*(.+?)\s*:\s*(.*)$/, 'dashed', 'filled'],
  [/^(.+?)->>([+-])?\s*(.+?)\s*:\s*(.*)$/, 'solid', 'filled'],
  [/^(.+?)--\)([+-])?\s*(.+?)\s*:\s*(.*)$/, 'dashed', 'none'],
  [/^(.+?)-\)([+-])?\s*(.+?)\s*:\s*(.*)$/, 'solid', 'none'],
  [/^(.+?)-->([+-])?\s*(.+?)\s*:\s*(.*)$/, 'dashed', 'open'],
  [/^(.+?)->([+-])?\s*(.+?)\s*:\s*(.*)$/, 'solid', 'open'],
]

export function parseSeqCode(code: string): SeqParseResult {
  const lines = code.split('\n').map(l => l.trim()).filter(Boolean)
  const participants: SeqParticipant[] = []
  const messages: SeqMessage[] = []
  const fragments: SeqFragment[] = []
  const pMap = new Map<string, string>()
  let msgOrder = 0

  const ensure = (id: string) => {
    if (!pMap.has(id)) {
      pMap.set(id, id)
      participants.push({
        id,
        label: id,
        x: SEQ_PAD_X + participants.length * SEQ_COL_W + SEQ_COL_W / 2,
        type: 'participant',
      })
    }
  }

  // fragment 栈
  const fragStack: {
    type: FragmentType
    label: string
    startOrder: number
    sections: SeqFragmentSection[]
    participantsSeen: Set<string>
  }[] = []

  for (const line of lines) {
    if (/^sequenceDiagram/i.test(line) || /^%%/.test(line)) continue

    // participant / actor
    const pm = line.match(/^(participant|actor)\s+(\S+)(?:\s+as\s+(.+))?$/i)
    if (pm) {
      const [, typeStr, id, label] = pm
      const type = typeStr.toLowerCase() === 'actor' ? 'actor' : 'participant'
      if (!pMap.has(id)) {
        pMap.set(id, label || id)
        participants.push({
          id,
          label: label || id,
          x: SEQ_PAD_X + participants.length * SEQ_COL_W + SEQ_COL_W / 2,
          type,
        })
      }
      continue
    }

    // fragment 开始
    const fragMatch = line.match(new RegExp(`^(${FRAGMENT_TYPES.join('|')})\\s*(.*)$`, 'i'))
    if (fragMatch) {
      const fType = fragMatch[1].toLowerCase() as FragmentType
      const fLabel = fragMatch[2].trim()
      fragStack.push({
        type: fType,
        label: fLabel,
        startOrder: msgOrder,
        sections: [],
        participantsSeen: new Set(),
      })
      continue
    }

    // else / and（alt/par 的分支）
    if (/^else\s*(.*)/i.test(line) || /^and\s*(.*)/i.test(line)) {
      const m = line.match(/^(?:else|and)\s*(.*)/i)
      if (m && fragStack.length > 0) {
        const top = fragStack[fragStack.length - 1]
        top.sections.push({
          label: m[1].trim(),
          afterMessageId: messages.length > 0 ? messages[messages.length - 1].id : undefined,
        })
      }
      continue
    }

    // end
    if (/^end$/i.test(line)) {
      if (fragStack.length > 0) {
        const frag = fragStack.pop()!
        // 确定覆盖的参与者
        const coverP = frag.participantsSeen.size > 0
          ? Array.from(frag.participantsSeen)
          : participants.map(p => p.id)

        fragments.push({
          id: `frag-${fragments.length + 1}`,
          type: frag.type,
          label: frag.label,
          coverParticipants: coverP,
          startOrder: frag.startOrder,
          endOrder: Math.max(frag.startOrder, msgOrder - 1),
          sections: frag.sections.length > 0 ? frag.sections : undefined,
        })
      }
      continue
    }

    // Note（跳过，暂不支持）
    if (/^Note\s/i.test(line)) continue
    // activate/deactivate（跳过）
    if (/^(activate|deactivate)\s/i.test(line)) continue

    // 消息
    let matched = false
    for (const [pat, style, arrow] of MESSAGE_PATTERNS) {
      const m = line.match(pat)
      if (m) {
        const from = m[1].trim()
        const to = m[3].trim()
        const label = m[4].trim()
        ensure(from)
        ensure(to)

        const msgId = `msg-${messages.length}`
        messages.push({
          id: msgId,
          from,
          to,
          label,
          order: msgOrder,
          style,
          arrow,
        })

        // 记录到当前 fragment 栈
        for (const f of fragStack) {
          f.participantsSeen.add(from)
          f.participantsSeen.add(to)
        }

        msgOrder++
        matched = true
        break
      }
    }
    if (matched) continue
  }

  return { participants, messages, fragments }
}

// ─── 序列化 ─────────────────────────────────────────────────────────────────

export function serializeSeqCode(
  participants: SeqParticipant[],
  messages: SeqMessage[],
  fragments: SeqFragment[] = []
): string {
  const lines: string[] = ['sequenceDiagram']

  // 按 x 排序输出参与者
  const sortedP = [...participants].sort((a, b) => a.x - b.x)
  for (const p of sortedP) {
    const typeStr = p.type === 'actor' ? 'actor' : 'participant'
    lines.push(p.label !== p.id
      ? `    ${typeStr} ${p.id} as ${p.label}`
      : `    ${typeStr} ${p.id}`)
  }

  // 按 order 排序消息
  const sortedM = [...messages].sort((a, b) => a.order - b.order)

  // 构建 fragment 事件（开始/结束/分支）
  interface FragEvent {
    order: number
    priority: number  // 0=fragment start, 1=section, 2=fragment end
    text: string
  }
  const events: FragEvent[] = []

  for (const f of fragments) {
    const indent = '    '
    events.push({
      order: f.startOrder,
      priority: 0,
      text: `${indent}${f.type} ${f.label}`,
    })
    if (f.sections) {
      for (const sec of f.sections) {
        // 找到 section 对应的 order
        if (sec.afterMessageId) {
          const msg = sortedM.find(m => m.id === sec.afterMessageId)
          if (msg) {
            events.push({
              order: msg.order + 0.5,  // 在消息之后
              priority: 1,
              text: `${indent}${f.type === 'par' ? 'and' : 'else'} ${sec.label}`,
            })
          }
        }
      }
    }
    events.push({
      order: f.endOrder + 0.5,
      priority: 2,
      text: `${indent}end`,
    })
  }

  // 合并消息和事件，按 order 排序
  interface OutputItem {
    order: number
    priority: number
    text: string
  }
  const items: OutputItem[] = []

  for (const m of sortedM) {
    const conn = m.style === 'solid'
      ? (m.arrow === 'filled' ? '->>' : m.arrow === 'open' ? '->' : '-)')
      : (m.arrow === 'filled' ? '-->>' : m.arrow === 'open' ? '-->' : '--)')
    items.push({
      order: m.order,
      priority: 0.5,
      text: `    ${m.from} ${conn} ${m.to}: ${m.label}`,
    })
  }

  items.push(...events)
  items.sort((a, b) => a.order - b.order || a.priority - b.priority)

  for (const item of items) {
    lines.push(item.text)
  }

  return lines.join('\n')
}
