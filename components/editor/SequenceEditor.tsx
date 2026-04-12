'use client'

import { useState, useRef, useEffect } from 'react'

export interface SeqParticipant {
  id: string
  label: string
}

export interface SeqMessage {
  from: string
  to: string
  label: string
  style: 'solid' | 'dashed'
  arrow: 'filled' | 'open' | 'none'
}

interface Props {
  participants: SeqParticipant[]
  messages: SeqMessage[]
  onUpdate: (participants: SeqParticipant[], messages: SeqMessage[]) => void
}

const COL_W = 120
const ROW_H = 44
const HEAD_H = 48
const PAD_X = 60
const BOX_W = 90
const BOX_H = 32

export function SequenceEditor({ participants, messages, onUpdate }: Props) {
  const [editingP, setEditingP] = useState<number | null>(null)
  const [pDraft, setPDraft] = useState('')
  const [editingM, setEditingM] = useState<number | null>(null)
  const [mDraft, setMDraft] = useState('')
  const [selectedM, setSelectedM] = useState<number | null>(null)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const viewportRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    let dragging = false, lx = 0, ly = 0
    const onDown = (e: PointerEvent) => {
      if ((e.target as Element).closest('input,foreignObject')) return
      dragging = true; lx = e.clientX; ly = e.clientY
      el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'
    }
    const onMove = (e: PointerEvent) => {
      if (!dragging) return
      setTranslate(t => ({ x: t.x + e.clientX - lx, y: t.y + e.clientY - ly }))
      lx = e.clientX; ly = e.clientY
    }
    const onUp = (e: PointerEvent) => {
      dragging = false; el.releasePointerCapture(e.pointerId); el.style.cursor = 'grab'
    }
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      setScale(s => Math.min(2, Math.max(0.3, s - e.deltaY * 0.001)))
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  const W = PAD_X * 2 + participants.length * COL_W
  const H = HEAD_H + messages.length * ROW_H + ROW_H

  const colX = (i: number) => PAD_X + i * COL_W + COL_W / 2

  const saveParticipant = (i: number) => {
    if (!pDraft.trim()) { setEditingP(null); return }
    const next = participants.map((p, idx) => idx === i ? { ...p, label: pDraft.trim() } : p)
    onUpdate(next, messages)
    setEditingP(null)
  }

  const saveMessage = (i: number) => {
    if (!mDraft.trim()) { setEditingM(null); return }
    const next = messages.map((m, idx) => idx === i ? { ...m, label: mDraft.trim() } : m)
    onUpdate(participants, next)
    setEditingM(null)
  }

  const deleteMessage = (i: number) => {
    onUpdate(participants, messages.filter((_, idx) => idx !== i))
    setSelectedM(null)
  }

  const moveMessage = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= messages.length) return
    const next = [...messages]
    ;[next[i], next[j]] = [next[j], next[i]]
    onUpdate(participants, next)
    setSelectedM(j)
  }

  const addMessage = () => {
    if (participants.length < 2) return
    const m: SeqMessage = { from: participants[0].id, to: participants[1].id, label: '消息', style: 'solid', arrow: 'filled' }
    onUpdate(participants, [...messages, m])
    setSelectedM(messages.length)
  }

  const addParticipant = () => {
    const id = `P${participants.length + 1}`
    onUpdate([...participants, { id, label: id }], messages)
  }

  const deleteParticipant = (i: number) => {
    const pid = participants[i].id
    const next = participants.filter((_, idx) => idx !== i)
    const nextM = messages.filter(m => m.from !== pid && m.to !== pid)
    onUpdate(next, nextM)
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      <div ref={viewportRef} style={{ flex: 1, overflow: 'hidden', cursor: 'grab', userSelect: 'none', touchAction: 'none' }}>
        <div style={{ transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`, transformOrigin: '0 0', display: 'inline-block' }}>
        <svg width={W} height={H} style={{ minWidth: W, flexShrink: 0 }}>
        {/* lifelines */}
        {participants.map((_, i) => (
          <line key={i} x1={colX(i)} y1={HEAD_H} x2={colX(i)} y2={H - ROW_H / 2}
            stroke="#c7d2fe" strokeWidth={1.5} strokeDasharray="6 4" />
        ))}

        {/* participant boxes top */}
        {participants.map((p, i) => {
          const cx = colX(i)
          return (
            <g key={i}>
              <rect x={cx - BOX_W / 2} y={4} width={BOX_W} height={BOX_H}
                rx={4} fill="#eef2ff" stroke="#a5b4fc" strokeWidth={1.5} />
              {editingP === i ? (
                <foreignObject x={cx - BOX_W / 2 + 2} y={6} width={BOX_W - 4} height={BOX_H - 4}>
                  <input value={pDraft} onChange={e => setPDraft(e.target.value)}
                    onBlur={() => saveParticipant(i)}
                    onKeyDown={e => { if (e.key === 'Enter') saveParticipant(i); if (e.key === 'Escape') setEditingP(null) }}
                    className="w-full h-full text-center text-xs border-none outline-none bg-transparent"
                    autoFocus />
                </foreignObject>
              ) : (
                <text x={cx} y={4 + BOX_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#3730a3"
                  style={{ cursor: 'pointer' }}
                  onDoubleClick={() => { setEditingP(i); setPDraft(p.label) }}>
                  {p.label}
                </text>
              )}
            </g>
          )
        })}

        {/* messages */}
        {messages.map((m, i) => {
          const fromIdx = participants.findIndex(p => p.id === m.from)
          const toIdx = participants.findIndex(p => p.id === m.to)
          if (fromIdx < 0 || toIdx < 0) return null
          const x1 = colX(fromIdx)
          const x2 = colX(toIdx)
          const y = HEAD_H + i * ROW_H + ROW_H / 2
          const isSelected = selectedM === i
          const isSelf = fromIdx === toIdx
          const dir = x2 > x1 ? 1 : -1
          const ax2 = isSelf ? x1 + 30 : x2 - dir * 6

          return (
            <g key={i} style={{ cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); setSelectedM(i === selectedM ? null : i) }}>
              {/* hit area */}
              <line x1={x1} y1={y} x2={x2} y2={y} stroke="transparent" strokeWidth={16} />
              {/* line */}
              {isSelf ? (
                <path d={`M${x1},${y} Q${x1 + 50},${y - 20} ${x1 + 50},${y} Q${x1 + 50},${y + 20} ${x1},${y + 20}`}
                  fill="none" stroke={isSelected ? '#3b82f6' : '#6b7280'}
                  strokeWidth={isSelected ? 2 : 1.5}
                  strokeDasharray={m.style === 'dashed' ? '5 3' : undefined} />
              ) : (
                <line x1={x1} y1={y} x2={ax2} y2={y}
                  stroke={isSelected ? '#3b82f6' : '#6b7280'}
                  strokeWidth={isSelected ? 2 : 1.5}
                  strokeDasharray={m.style === 'dashed' ? '5 3' : undefined} />
              )}
              {/* arrowhead */}
              {m.arrow !== 'none' && !isSelf && (
                <polygon
                  points={m.arrow === 'filled'
                    ? `${x2},${y} ${x2 - dir * 10},${y - 5} ${x2 - dir * 10},${y + 5}`
                    : `${x2},${y} ${x2 - dir * 10},${y - 5} ${x2 - dir * 8},${y} ${x2 - dir * 10},${y + 5}`}
                  fill={m.arrow === 'filled' ? (isSelected ? '#3b82f6' : '#6b7280') : 'none'}
                  stroke={isSelected ? '#3b82f6' : '#6b7280'} strokeWidth={1} />
              )}
              {/* label */}
              {editingM === i ? (
                <foreignObject x={Math.min(x1, x2) + Math.abs(x2 - x1) / 2 - 50} y={y - 22} width={100} height={20}>
                  <input value={mDraft} onChange={e => setMDraft(e.target.value)}
                    onBlur={() => saveMessage(i)}
                    onKeyDown={e => { if (e.key === 'Enter') saveMessage(i); if (e.key === 'Escape') setEditingM(null) }}
                    className="w-full text-center text-xs border border-blue-400 rounded outline-none bg-white"
                    autoFocus onClick={e => e.stopPropagation()} />
                </foreignObject>
              ) : (
                <text x={isSelf ? x1 + 55 : (x1 + x2) / 2} y={y - 6}
                  textAnchor="middle" fontSize={11} fill={isSelected ? '#2563eb' : '#374151'}
                  onDoubleClick={e => { e.stopPropagation(); setEditingM(i); setMDraft(m.label) }}>
                  {m.label}
                </text>
              )}
            </g>
          )
        })}

        {/* participant boxes bottom */}
        {participants.map((p, i) => {
          const cx = colX(i)
          const by = H - ROW_H
          return (
            <g key={i}>
              <rect x={cx - BOX_W / 2} y={by} width={BOX_W} height={BOX_H}
                rx={4} fill="#eef2ff" stroke="#a5b4fc" strokeWidth={1.5} />
              <text x={cx} y={by + BOX_H / 2 + 4} textAnchor="middle" fontSize={12} fill="#3730a3">{p.label}</text>
            </g>
          )
        })}
      </svg>
        </div>
      </div>

      {/* toolbar */}
      <div className="flex gap-2 p-3 border-t border-gray-100 flex-wrap items-center">
        <button onClick={addMessage} className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer select-none">+ 消息</button>
        <button onClick={addParticipant} className="text-xs px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600 cursor-pointer select-none">+ 参与者</button>
        {selectedM !== null && (
          <>
            <span className="text-xs text-gray-400 ml-2">消息 {selectedM + 1}：</span>
            <button onClick={() => moveMessage(selectedM, -1)} className="text-xs px-2 py-1 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 cursor-pointer">↑ 上移</button>
            <button onClick={() => moveMessage(selectedM, 1)} className="text-xs px-2 py-1 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 cursor-pointer">↓ 下移</button>
            <select value={messages[selectedM]?.style} onChange={e => {
              const next = messages.map((m, i) => i === selectedM ? { ...m, style: e.target.value as 'solid' | 'dashed' } : m)
              onUpdate(participants, next)
            }} className="text-xs border border-gray-300 rounded px-1 py-0.5">
              <option value="solid">实线</option>
              <option value="dashed">虚线</option>
            </select>
            <select value={messages[selectedM]?.from} onChange={e => {
              const next = messages.map((m, i) => i === selectedM ? { ...m, from: e.target.value } : m)
              onUpdate(participants, next)
            }} className="text-xs border border-gray-300 rounded px-1 py-0.5">
              {participants.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <span className="text-xs text-gray-400">→</span>
            <select value={messages[selectedM]?.to} onChange={e => {
              const next = messages.map((m, i) => i === selectedM ? { ...m, to: e.target.value } : m)
              onUpdate(participants, next)
            }} className="text-xs border border-gray-300 rounded px-1 py-0.5">
              {participants.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <button onClick={() => deleteMessage(selectedM)} className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer">删除</button>
          </>
        )}
        {/* participant delete buttons */}
        {participants.map((p, i) => (
          <button key={i} onClick={() => deleteParticipant(i)}
            className="text-xs px-2 py-0.5 bg-gray-100 border border-gray-200 rounded hover:bg-red-50 hover:border-red-300 hover:text-red-600 cursor-pointer">
            删除 {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}
