'use client'

import { useState, useCallback } from 'react'
import type { TimelineData, TimelineSection, TimelinePeriod, TimelineEvent } from '@/lib/timelineParser'

interface TimelineEditorProps {
  data: TimelineData
  onUpdate: (data: TimelineData) => void
}

const SECTION_COLORS = [
  '#dbeafe', '#dcfce7', '#fef9c3', '#fce7f3', '#ede9fe', '#ccfbf1', '#fee2e2', '#f3e8ff',
]
const SECTION_BORDER = [
  '#93c5fd', '#86efac', '#fde047', '#f9a8d4', '#c4b5fd', '#5eead4', '#fca5a5', '#d8b4fe',
]

let _tlEditorCounter = 1000

export function TimelineEditor({ data, onUpdate }: TimelineEditorProps) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  // ─── Section actions ───
  const addSection = useCallback(() => {
    const newSec: TimelineSection = {
      id: `sec-${++_tlEditorCounter}`,
      label: '新阶段',
      periods: [],
    }
    onUpdate({ ...data, sections: [...data.sections, newSec] })
  }, [data, onUpdate])

  const removeSection = useCallback((secId: string) => {
    onUpdate({ ...data, sections: data.sections.filter(s => s.id !== secId) })
  }, [data, onUpdate])

  const updateSectionLabel = useCallback((secId: string, label: string) => {
    onUpdate({
      ...data,
      sections: data.sections.map(s => s.id === secId ? { ...s, label } : s),
    })
  }, [data, onUpdate])

  // ─── Period actions ───
  const addPeriod = useCallback((secId: string) => {
    const newPeriod: TimelinePeriod = {
      id: `period-${++_tlEditorCounter}`,
      time: '新时间点',
      events: [{ text: '事件描述' }],
    }
    onUpdate({
      ...data,
      sections: data.sections.map(s =>
        s.id === secId ? { ...s, periods: [...s.periods, newPeriod] } : s
      ),
    })
    setSelectedPeriodId(newPeriod.id)
  }, [data, onUpdate])

  const removePeriod = useCallback((secId: string, periodId: string) => {
    onUpdate({
      ...data,
      sections: data.sections.map(s =>
        s.id === secId ? { ...s, periods: s.periods.filter(p => p.id !== periodId) } : s
      ),
    })
    if (selectedPeriodId === periodId) setSelectedPeriodId(null)
  }, [data, onUpdate, selectedPeriodId])

  const updatePeriod = useCallback((secId: string, periodId: string, patch: Partial<TimelinePeriod>) => {
    onUpdate({
      ...data,
      sections: data.sections.map(s =>
        s.id === secId
          ? { ...s, periods: s.periods.map(p => p.id === periodId ? { ...p, ...patch } : p) }
          : s
      ),
    })
  }, [data, onUpdate])

  // ─── Event actions ───
  const addEvent = useCallback((secId: string, periodId: string) => {
    onUpdate({
      ...data,
      sections: data.sections.map(s =>
        s.id === secId
          ? {
              ...s, periods: s.periods.map(p =>
                p.id === periodId
                  ? { ...p, events: [...p.events, { text: '新事件' }] }
                  : p
              ),
            }
          : s
      ),
    })
  }, [data, onUpdate])

  const updateEvent = useCallback((secId: string, periodId: string, idx: number, text: string) => {
    onUpdate({
      ...data,
      sections: data.sections.map(s =>
        s.id === secId
          ? {
              ...s, periods: s.periods.map(p => {
                if (p.id !== periodId) return p
                const events = [...p.events]
                events[idx] = { text }
                return { ...p, events }
              }),
            }
          : s
      ),
    })
  }, [data, onUpdate])

  const removeEvent = useCallback((secId: string, periodId: string, idx: number) => {
    onUpdate({
      ...data,
      sections: data.sections.map(s =>
        s.id === secId
          ? {
              ...s, periods: s.periods.map(p => {
                if (p.id !== periodId) return p
                const events = p.events.filter((_, i) => i !== idx)
                return { ...p, events }
              }),
            }
          : s
      ),
    })
  }, [data, onUpdate])

  // 找到选中的 period 和它所在的 section
  const selectedInfo = selectedPeriodId ? (() => {
    for (const sec of data.sections) {
      const period = sec.periods.find(p => p.id === selectedPeriodId)
      if (period) return { sec, period }
    }
    return null
  })() : null

  return (
    <div className="flex h-full">
      {/* 主画布 */}
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        {/* 标题 */}
        <div className="mb-6 flex items-center gap-3">
          {editingId === '__title__' ? (
            <input
              autoFocus
              className="text-xl font-bold border-b-2 border-indigo-400 outline-none bg-transparent px-1"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={() => { onUpdate({ ...data, title: draft }); setEditingId(null) }}
              onKeyDown={e => {
                if (e.key === 'Enter') { onUpdate({ ...data, title: draft }); setEditingId(null) }
                if (e.key === 'Escape') setEditingId(null)
                e.stopPropagation()
              }}
            />
          ) : (
            <h2
              className="text-xl font-bold text-gray-800 cursor-pointer hover:text-indigo-600 border-b-2 border-transparent hover:border-indigo-300 transition-colors"
              onDoubleClick={() => { setEditingId('__title__'); setDraft(data.title || '') }}
              title="双击编辑标题"
            >
              {data.title || '（双击添加标题）'}
            </h2>
          )}
          <button
            onClick={addSection}
            className="text-xs px-3 py-1.5 bg-indigo-500 text-white rounded hover:bg-indigo-600 ml-auto"
          >+ 添加阶段</button>
        </div>

        {/* 时间线主体 */}
        <div className="relative">
          {/* 中轴线 */}
          <div className="absolute left-0 right-0 top-8 h-0.5 bg-gray-300" />

          {data.sections.map((sec, secIdx) => {
            const bg = SECTION_COLORS[secIdx % SECTION_COLORS.length]
            const border = SECTION_BORDER[secIdx % SECTION_BORDER.length]

            return (
              <div key={sec.id} className="mb-8">
                {/* Section 标题 */}
                {sec.label && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-0.5 w-4 bg-gray-400" />
                    {editingId === sec.id ? (
                      <input
                        autoFocus
                        className="text-sm font-semibold border-b border-indigo-400 outline-none bg-transparent"
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={() => { updateSectionLabel(sec.id, draft); setEditingId(null) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateSectionLabel(sec.id, draft); setEditingId(null) }
                          if (e.key === 'Escape') setEditingId(null)
                          e.stopPropagation()
                        }}
                      />
                    ) : (
                      <span
                        className="text-sm font-semibold text-gray-600 cursor-pointer hover:text-indigo-600"
                        onDoubleClick={() => { setEditingId(sec.id); setDraft(sec.label) }}
                        title="双击编辑阶段名"
                      >{sec.label}</span>
                    )}
                    <button
                      onClick={() => removeSection(sec.id)}
                      className="text-xs text-red-400 hover:text-red-600 ml-1"
                      title="删除阶段"
                    >×</button>
                  </div>
                )}

                {/* 时间周期列表 */}
                <div className="flex gap-4 flex-wrap">
                  {sec.periods.map(period => {
                    const isSelected = selectedPeriodId === period.id
                    return (
                      <div
                        key={period.id}
                        className="flex flex-col items-center cursor-pointer group"
                        style={{ minWidth: 120, maxWidth: 160 }}
                        onClick={() => setSelectedPeriodId(isSelected ? null : period.id)}
                      >
                        {/* 时间点圆圈 */}
                        <div
                          className="w-4 h-4 rounded-full border-2 z-10 transition-all"
                          style={{
                            background: isSelected ? border : 'white',
                            borderColor: border,
                            boxShadow: isSelected ? `0 0 0 3px ${bg}` : undefined,
                          }}
                        />
                        {/* 连接线 */}
                        <div className="w-0.5 h-4" style={{ background: border }} />
                        {/* 卡片 */}
                        <div
                          className="rounded-lg border p-2 w-full transition-all"
                          style={{
                            background: bg,
                            borderColor: isSelected ? border : 'transparent',
                            borderWidth: isSelected ? 2 : 1,
                          }}
                        >
                          {/* 时间标签 */}
                          {editingId === period.id + '-time' ? (
                            <input
                              autoFocus
                              className="w-full text-xs font-bold border-b border-indigo-400 outline-none bg-transparent mb-1"
                              value={draft}
                              onChange={e => setDraft(e.target.value)}
                              onBlur={() => {
                                updatePeriod(sec.id, period.id, { time: draft })
                                setEditingId(null)
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  updatePeriod(sec.id, period.id, { time: draft })
                                  setEditingId(null)
                                }
                                if (e.key === 'Escape') setEditingId(null)
                                e.stopPropagation()
                              }}
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <div
                              className="text-xs font-bold text-gray-700 mb-1 cursor-text hover:text-indigo-600"
                              onDoubleClick={e => {
                                e.stopPropagation()
                                setEditingId(period.id + '-time')
                                setDraft(period.time)
                              }}
                              title="双击编辑时间"
                            >{period.time}</div>
                          )}
                          {/* 事件列表 */}
                          <div className="flex flex-col gap-0.5">
                            {period.events.map((ev, idx) => (
                              <div key={idx} className="flex items-start gap-1 group/ev">
                                <span className="text-[10px] text-gray-400 mt-0.5">•</span>
                                <span className="text-[11px] text-gray-600 flex-1 leading-tight">{ev.text}</span>
                              </div>
                            ))}
                          </div>
                          {/* 删除按钮 */}
                          <button
                            className="hidden group-hover:block text-[10px] text-red-400 hover:text-red-600 mt-1"
                            onClick={e => { e.stopPropagation(); removePeriod(sec.id, period.id) }}
                          >删除</button>
                        </div>
                      </div>
                    )
                  })}

                  {/* 添加时间点按钮 */}
                  <div className="flex flex-col items-center" style={{ minWidth: 80 }}>
                    <div className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300 z-10" />
                    <div className="w-0.5 h-4 bg-gray-200" />
                    <button
                      onClick={() => addPeriod(sec.id)}
                      className="text-xs px-2 py-1 border border-dashed border-gray-300 rounded text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                    >+ 添加</button>
                  </div>
                </div>
              </div>
            )
          })}

          {data.sections.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📅</div>
              <div className="text-sm">点击"添加阶段"开始创建时间线</div>
            </div>
          )}
        </div>
      </div>

      {/* 右侧属性面板 */}
      <div className="w-56 border-l bg-white p-3 flex flex-col gap-3 overflow-y-auto">
        <div className="text-xs font-semibold text-gray-600">属性</div>
        {selectedInfo ? (
          <>
            <label className="text-xs text-gray-500">
              时间标签
              <input
                className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                value={selectedInfo.period.time}
                onChange={e => updatePeriod(selectedInfo.sec.id, selectedInfo.period.id, { time: e.target.value })}
                onKeyDown={e => e.stopPropagation()}
              />
            </label>
            <div className="text-xs text-gray-500">
              事件列表
              <div className="flex flex-col gap-1 mt-1">
                {selectedInfo.period.events.map((ev, idx) => (
                  <div key={idx} className="flex gap-1">
                    <input
                      className="flex-1 px-2 py-1 border rounded text-xs"
                      value={ev.text}
                      onChange={e => updateEvent(selectedInfo.sec.id, selectedInfo.period.id, idx, e.target.value)}
                      onKeyDown={e => e.stopPropagation()}
                    />
                    <button
                      onClick={() => removeEvent(selectedInfo.sec.id, selectedInfo.period.id, idx)}
                      className="text-red-400 hover:text-red-600 text-xs px-1"
                    >×</button>
                  </div>
                ))}
                <button
                  onClick={() => addEvent(selectedInfo.sec.id, selectedInfo.period.id)}
                  className="text-xs px-2 py-1 border border-dashed border-gray-300 rounded text-gray-400 hover:border-indigo-400 hover:text-indigo-500"
                >+ 添加事件</button>
              </div>
            </div>
            <button
              onClick={() => removePeriod(selectedInfo.sec.id, selectedInfo.period.id)}
              className="text-xs px-2 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100 mt-2"
            >删除时间点</button>
          </>
        ) : (
          <div className="text-xs text-gray-400">点击时间点查看属性</div>
        )}
      </div>
    </div>
  )
}
