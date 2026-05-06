'use client'

import { useState, useRef, useCallback } from 'react'
import type { XyChartData } from '@/lib/xyChartParser'

interface Props {
  data: XyChartData
  onUpdate: (data: XyChartData) => void
}

const COLORS = ['#4f86c6', '#e07b54', '#5cb85c', '#f0ad4e', '#9b59b6']

export function XyChartEditor({ data, onUpdate }: Props) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(data.title)
  const [editingLabel, setEditingLabel] = useState<number | null>(null)
  const [labelDraft, setLabelDraft] = useState('')
  const [editingLegend, setEditingLegend] = useState<number | null>(null)
  const [legendDraft, setLegendDraft] = useState('')
  const [selectedCell, setSelectedCell] = useState<{ si: number; vi: number } | null>(null)
  const [selectedCol, setSelectedCol] = useState<number | null>(null)
  const [valueDraft, setValueDraft] = useState('')
  const [dragTooltip, setDragTooltip] = useState<{ si: number; vi: number; val: number } | null>(null)
  const [dragOverCol, setDragOverCol] = useState<number | null>(null)
  const valDragRef = useRef<{ si: number; vi: number; startY: number; startVal: number } | null>(null)
  const didValDrag = useRef(false)
  const colDragRef = useRef<{ fromVi: number; startX: number } | null>(null)

  const W = 560, H = 300, PAD_L = 50, PAD_B = 40, PAD_T = 20, PAD_R = 20
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  const allValues = data.series.flatMap(s => s.values)
  const maxVal = Math.max(...allValues, 1)
  const count = Math.max(...data.series.map(s => s.values.length), data.xLabels.length, 1)
  const barGroupW = chartW / count
  const barW = barGroupW / (data.series.filter(s => s.type === 'bar').length || 1) * 0.7

  const saveTitle = () => {
    if (titleDraft.trim()) onUpdate({ ...data, title: titleDraft.trim() })
    setEditingTitle(false)
  }

  const saveLabel = (i: number) => {
    const labels = [...data.xLabels]
    while (labels.length <= i) labels.push(String(labels.length + 1))
    labels[i] = labelDraft.trim() || labels[i]
    onUpdate({ ...data, xLabels: labels })
    setEditingLabel(null)
  }

  const saveLegend = (si: number) => {
    if (!legendDraft.trim()) { setEditingLegend(null); return }
    const series = data.series.map((s, i) => i === si ? { ...s, name: legendDraft.trim() } : s)
    onUpdate({ ...data, series })
    setEditingLegend(null)
  }

  const saveCell = (si: number, vi: number) => {
    const v = parseFloat(valueDraft)
    if (!isNaN(v) && v >= 0 && v <= 1e6) updateValue(si, vi, v)
    setSelectedCell(null)
  }

  const updateValue = useCallback((si: number, vi: number, v: number) => {
    const clamped = Math.max(0, Math.min(1e6, Math.round(v)))
    const series = data.series.map((s, i) => {
      if (i !== si) return s
      const values = [...s.values]; values[vi] = clamped
      return { ...s, values }
    })
    onUpdate({ ...data, series })
  }, [data, onUpdate])

  // vertical drag to change value
  const handleValDragStart = (e: React.MouseEvent, si: number, vi: number, currentVal: number) => {
    e.preventDefault(); e.stopPropagation()
    valDragRef.current = { si, vi, startY: e.clientY, startVal: currentVal }
    const onMove = (ev: MouseEvent) => {
      if (!valDragRef.current) return
      const { si, vi, startY, startVal } = valDragRef.current
      const newVal = Math.max(0, Math.min(1e6, Math.round(startVal + (startY - ev.clientY) / chartH * maxVal)))
      setDragTooltip({ si, vi, val: newVal })
      updateValue(si, vi, newVal)
    }
    const onUp = () => {
      valDragRef.current = null; setDragTooltip(null)
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  // horizontal drag to reorder columns
  const handleColDragStart = (e: React.MouseEvent, vi: number) => {
    e.preventDefault(); e.stopPropagation()
    colDragRef.current = { fromVi: vi, startX: e.clientX }
    const onMove = (ev: MouseEvent) => {
      if (!colDragRef.current) return
      const dx = ev.clientX - colDragRef.current.startX
      const toVi = Math.max(0, Math.min(count - 1, colDragRef.current.fromVi + Math.round(dx / barGroupW)))
      setDragOverCol(toVi)
    }
    const onUp = (ev: MouseEvent) => {
      if (!colDragRef.current) return
      const dx = ev.clientX - colDragRef.current.startX
      const fromVi = colDragRef.current.fromVi
      const toVi = Math.max(0, Math.min(count - 1, fromVi + Math.round(dx / barGroupW)))
      if (fromVi !== toVi) {
        const series = data.series.map(s => {
          const values = [...s.values]
          const [item] = values.splice(fromVi, 1)
          values.splice(toVi, 0, item)
          return { ...s, values }
        })
        const xLabels = [...data.xLabels]
        if (xLabels.length > Math.max(fromVi, toVi)) {
          const [lbl] = xLabels.splice(fromVi, 1)
          xLabels.splice(toVi, 0, lbl)
        }
        onUpdate({ ...data, series, xLabels })
      }
      colDragRef.current = null; setDragOverCol(null)
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }

  const insertCol = (at: number) => {
    const series = data.series.map(s => {
      const values = [...s.values]; values.splice(at, 0, 0); return { ...s, values }
    })
    // Ensure xLabels length matches values length before splice
    const xLabels = [...data.xLabels]
    while (xLabels.length < count) xLabels.push(String(xLabels.length + 1))
    xLabels.splice(at, 0, `新列`)
    onUpdate({ ...data, series, xLabels })
    setSelectedCell({ si: selectedCell?.si ?? 0, vi: at })
  }

  const deleteCol = (vi: number) => {
    if (count <= 1) return
    const series = data.series.map(s => {
      const values = [...s.values]; values.splice(vi, 1); return { ...s, values }
    })
    const xLabels = [...data.xLabels]
    while (xLabels.length < count) xLabels.push(String(xLabels.length + 1))
    xLabels.splice(vi, 1)
    onUpdate({ ...data, series, xLabels })
    setSelectedCell(null)
  }

  const addColumn = () => {
    const series = data.series.map(s => ({ ...s, values: [...s.values, 0] }))
    const xLabels = [...data.xLabels, `新列`]
    onUpdate({ ...data, series, xLabels })
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(maxVal * t))

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-white select-none">
      <div className="mb-4">
        {editingTitle ? (
          <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
            onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false) }}
            className="text-xl font-bold text-center border-b-2 border-blue-500 outline-none px-2" autoFocus />
        ) : (
          <h2 className="text-xl font-bold text-gray-800 cursor-pointer hover:text-blue-600"
            onDoubleClick={() => { setTitleDraft(data.title); setEditingTitle(true) }}>
            {data.title}
          </h2>
        )}
      </div>

      <svg width={W} height={H} style={{ userSelect: 'none', overflow: 'visible' }}
        onClick={() => { setSelectedCol(null); setSelectedCell(null) }}>
        {/* Y axis */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + chartH} stroke="#9ca3af" strokeWidth={1} />
        {ticks.map(tick => {
          const y = PAD_T + chartH - (tick / maxVal) * chartH
          return (
            <g key={tick}>
              <line x1={PAD_L - 4} y1={y} x2={PAD_L} y2={y} stroke="#9ca3af" strokeWidth={1} />
              <text x={PAD_L - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#6b7280">{tick}</text>
            </g>
          )
        })}

        {/* X axis */}
        <line x1={PAD_L} y1={PAD_T + chartH} x2={PAD_L + chartW} y2={PAD_T + chartH} stroke="#9ca3af" strokeWidth={1} />

        {/* drag-over indicator */}
        {dragOverCol !== null && (
          <line
            x1={PAD_L + dragOverCol * barGroupW} y1={PAD_T}
            x2={PAD_L + dragOverCol * barGroupW} y2={PAD_T + chartH}
            stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 2" />
        )}

        {/* X labels */}
        {Array.from({ length: count }).map((_, i) => {
          const cx = PAD_L + i * barGroupW + barGroupW / 2
          const isSelected = selectedCol === i
          return (
            <g key={i}>
              {isSelected && (
                <rect x={PAD_L + i * barGroupW} y={PAD_T} width={barGroupW} height={chartH}
                  fill="#3b82f6" fillOpacity={0.08} />
              )}
              {editingLabel === i ? (
                <foreignObject x={cx - 30} y={PAD_T + chartH + 4} width={60} height={22}>
                  <input value={labelDraft} onChange={e => setLabelDraft(e.target.value)}
                    onBlur={() => saveLabel(i)}
                    onKeyDown={e => { if (e.key === 'Enter') saveLabel(i); if (e.key === 'Escape') setEditingLabel(null) }}
                    className="w-full text-center text-xs border border-blue-500 rounded outline-none bg-white"
                    autoFocus onClick={e => e.stopPropagation()} />
                </foreignObject>
              ) : (
                <text x={cx} y={PAD_T + chartH + 14} textAnchor="middle" fontSize={10}
                  fill={isSelected ? '#3b82f6' : '#6b7280'} fontWeight={isSelected ? 600 : 400}
                  style={{ cursor: 'pointer' }}
                  onMouseDown={e => { e.stopPropagation(); setSelectedCol(i === selectedCol ? null : i) }}
                  onDoubleClick={e => { e.stopPropagation(); setEditingLabel(i); setLabelDraft(data.xLabels[i] ?? String(i + 1)) }}>
                  {data.xLabels[i] ?? i + 1}
                </text>
              )}
            </g>
          )
        })}

        {/* Bars */}
        {data.series.map((s, si) => {
          if (s.type !== 'bar') return null
          const barSeries = data.series.filter((x, idx) => x.type === 'bar' && idx <= si)
          const barOffset = (barSeries.length - 1) * barW
          const totalBars = data.series.filter(x => x.type === 'bar').length
          return s.values.map((v, vi) => {
            const bh = (v / maxVal) * chartH
            const x = PAD_L + vi * barGroupW + barGroupW / 2 - barW * (totalBars / 2) + barOffset
            const y = PAD_T + chartH - bh
            const isSelected = selectedCell?.si === si && selectedCell?.vi === vi
            const isDragging = dragTooltip?.si === si && dragTooltip?.vi === vi
            return (
              <g key={`${si}-${vi}`}>
                <rect x={x} y={y} width={barW} height={Math.max(bh, 1)}
                  fill={COLORS[si % COLORS.length]}
                  stroke={isSelected ? '#1d4ed8' : 'none'} strokeWidth={isSelected ? 2 : 0}
                  opacity={isDragging ? 0.7 : 1}
                  style={{ cursor: 'ns-resize' }}
                  onMouseDown={e => { e.stopPropagation(); handleValDragStart(e, si, vi, v) }}
                  onClick={e => { e.stopPropagation(); setSelectedCell({ si, vi }); setValueDraft(v.toString()) }} />
                {!isDragging && !isSelected && (
                  <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize={9} fill={COLORS[si % COLORS.length]} className="pointer-events-none">{v}</text>
                )}
                {isDragging && (
                  <g>
                    <rect x={x + barW / 2 - 22} y={y - 26} width={44} height={18} rx={3} fill="#1d4ed8" opacity={0.9} />
                    <text x={x + barW / 2} y={y - 13} textAnchor="middle" fontSize={11} fill="white" fontWeight="600">{dragTooltip.val}</text>
                  </g>
                )}
                {isSelected && (
                  <foreignObject x={x - 10} y={y - 34} width={60} height={26}>
                    <input value={valueDraft} type="number" min="0"
                      onChange={e => setValueDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveCell(si, vi); if (e.key === 'Escape') setSelectedCell(null) }}
                      onBlur={() => saveCell(si, vi)}
                      className="w-full h-full text-center text-xs border-2 border-blue-500 rounded bg-white outline-none"
                      autoFocus onClick={e => e.stopPropagation()} />
                  </foreignObject>
                )}
              </g>
            )
          })
        })}

        {/* Lines */}
        {data.series.map((s, si) => {
          if (s.type !== 'line') return null
          const pts = s.values.map((v, vi) => {
            const cx = PAD_L + vi * barGroupW + barGroupW / 2
            const cy = PAD_T + chartH - (v / maxVal) * chartH
            return `${cx},${cy}`
          }).join(' ')
          return (
            <g key={si}>
              <polyline points={pts} fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth={2} />
              {s.values.map((v, vi) => {
                const cx = PAD_L + vi * barGroupW + barGroupW / 2
                const cy = PAD_T + chartH - (v / maxVal) * chartH
                const isSelected = selectedCell?.si === si && selectedCell?.vi === vi
                const isDragging = dragTooltip?.si === si && dragTooltip?.vi === vi
                return (
                  <g key={vi}>
                    <circle cx={cx} cy={cy} r={5} fill={COLORS[si % COLORS.length]}
                      stroke={isSelected ? '#1d4ed8' : 'white'} strokeWidth={2}
                      style={{ cursor: 'ns-resize' }}
                      onMouseDown={e => { e.stopPropagation(); handleValDragStart(e, si, vi, v) }}
                      onClick={e => { e.stopPropagation(); setSelectedCell({ si, vi }); setValueDraft(v.toString()) }} />
                    {!isDragging && !isSelected && (
                      <text x={cx} y={cy - 10} textAnchor="middle" fontSize={9} fill={COLORS[si % COLORS.length]} style={{ pointerEvents: 'none' }}>{v}</text>
                    )}
                    {isDragging && (
                      <g>
                        <rect x={cx - 22} y={cy - 28} width={44} height={18} rx={3} fill="#1d4ed8" opacity={0.9} />
                        <text x={cx} y={cy - 15} textAnchor="middle" fontSize={11} fill="white" fontWeight="600">{dragTooltip.val}</text>
                      </g>
                    )}
                    {isSelected && (
                      <foreignObject x={cx - 30} y={cy - 36} width={60} height={26}>
                        <input value={valueDraft} type="number" min="0"
                          onChange={e => setValueDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveCell(si, vi); if (e.key === 'Escape') setSelectedCell(null) }}
                          onBlur={() => saveCell(si, vi)}
                          className="w-full h-full text-center text-xs border-2 border-blue-500 rounded bg-white outline-none"
                          autoFocus onClick={e => e.stopPropagation()} />
                      </foreignObject>
                    )}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-2 items-center flex-wrap">
        {data.series.map((s, si) => (
          <div key={si} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[si % COLORS.length] }} />
            {editingLegend === si ? (
              <input value={legendDraft} onChange={e => setLegendDraft(e.target.value)}
                onBlur={() => saveLegend(si)}
                onKeyDown={e => { if (e.key === 'Enter') saveLegend(si); if (e.key === 'Escape') setEditingLegend(null) }}
                className="text-xs border border-blue-500 rounded outline-none px-1 w-20" autoFocus />
            ) : (
              <span className="text-xs text-gray-600 cursor-pointer hover:text-blue-600"
                onDoubleClick={() => { setEditingLegend(si); setLegendDraft(s.name) }}>
                {s.name} ({s.type})
              </span>
            )}
          </div>
        ))}
        <button onClick={addColumn}
          className="text-xs px-2 py-0.5 bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer select-none">
          + 列
        </button>
      </div>

      {/* Column action bar — always visible */}
      <div className="flex gap-2 mt-2 items-center">
        <span className="text-xs text-gray-400">
          {(selectedCell ?? selectedCol) !== null ? `列 ${(selectedCell?.vi ?? selectedCol!) + 1}：` : '列操作：'}
        </span>
        {(() => {
          const vi = selectedCell?.vi ?? selectedCol
          const disabled = vi === null || vi === undefined
          return (<>
            <button onMouseDown={e => { e.preventDefault(); !disabled && insertCol(vi!) }}
              disabled={disabled}
              className="text-xs px-2 py-0.5 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">← 左插列</button>
            <button onMouseDown={e => { e.preventDefault(); !disabled && insertCol(vi! + 1) }}
              disabled={disabled}
              className="text-xs px-2 py-0.5 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">右插列 →</button>
            <button
              onMouseDown={e => { e.preventDefault(); !disabled && handleColDragStart(e, vi!) }}
              disabled={disabled}
              className="text-xs px-2 py-0.5 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 cursor-ew-resize disabled:opacity-40 disabled:cursor-not-allowed">⇄ 拖移换位</button>
            <button onMouseDown={e => { e.preventDefault(); !disabled && deleteCol(vi!) }}
              disabled={disabled}
              className="text-xs px-2 py-0.5 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">删除列</button>
          </>)
        })()}
      </div>
    </div>
  )
}
