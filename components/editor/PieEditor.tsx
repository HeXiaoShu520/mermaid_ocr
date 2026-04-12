'use client'

import { useState, useRef, useEffect } from 'react'
import type { PieData } from '@/lib/pieParser'

interface PieEditorProps {
  title: string
  data: PieData[]
  onUpdate: (title: string, data: PieData[]) => void
}

const COLORS = [
  '#a8b8d8', '#d4e8a8', '#a8d8a8', '#d8d8a8',
  '#c8a8d8', '#d8a8a8', '#a8d8d8', '#d8c8a8'
]

export function PieEditor({ title, data, onUpdate }: PieEditorProps) {
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(title)
  useEffect(() => { if (!editingTitle) setTitleDraft(title) }, [title, editingTitle])
  // svgEditing: editing value inline in SVG (does NOT call onUpdate until committed)
  const [svgEditing, setSvgEditing] = useState<number | null>(null)
  const [svgValueDraft, setSvgValueDraft] = useState('')
  // legendEditing: editing label+value in legend
  const [legendEditing, setLegendEditing] = useState<number | null>(null)
  const [labelDraft, setLabelDraft] = useState('')
  const [valueDraft, setValueDraft] = useState('')
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const committingRef = useRef(false)

  const total = data.reduce((sum, item) => sum + item.value, 0)

  const handleTitleSave = () => {
    if (titleDraft.trim()) onUpdate(titleDraft.trim(), data)
    setEditingTitle(false)
  }

  const commitSvgEdit = (index: number) => {
    if (committingRef.current) return
    committingRef.current = true
    const value = parseFloat(svgValueDraft)
    if (!isNaN(value) && value > 0 && value <= 1e6) {
      const newData = [...data]
      newData[index] = { ...newData[index], value }
      onUpdate(title, newData)
    }
    setSvgEditing(null)
    setTimeout(() => { committingRef.current = false }, 100)
  }

  const commitLegendEdit = (index: number) => {
    const value = parseFloat(valueDraft)
    if (labelDraft.trim() && !isNaN(value) && value > 0 && value <= 1e6) {
      const newData = [...data]
      newData[index] = { label: labelDraft.trim(), value }
      onUpdate(title, newData)
    }
    setLegendEditing(null)
  }

  const handleDeleteItem = (index: number) => {
    const newData = data.filter((_, i) => i !== index)
    if (newData.length > 0) onUpdate(title, newData)
    setSelectedIndex(null)
  }

  const handleDrop = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    const newData = [...data]
    const [item] = newData.splice(fromIndex, 1)
    newData.splice(toIndex, 0, item)
    onUpdate(title, newData)
  }

  const CX = 160, CY = 160, R = 140
  let currentAngle = -90
  const segments = data.map((item, index) => {
    const angle = (item.value / total) * 360
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180
    const x1 = CX + R * Math.cos(startRad)
    const y1 = CY + R * Math.sin(startRad)
    const x2 = CX + R * Math.cos(endRad)
    const y2 = CY + R * Math.sin(endRad)
    const largeArc = angle > 180 ? 1 : 0
    const path = `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`
    const midRad = ((startAngle + endAngle) / 2 * Math.PI) / 180
    const labelR = R * 0.65
    const lx = CX + labelR * Math.cos(midRad)
    const ly = CY + labelR * Math.sin(midRad)
    const percentage = (item.value / total) * 100
    return { ...item, path, color: COLORS[index % COLORS.length], percentage, index, lx, ly }
  })

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-white">
      <div className="mb-4">
        {editingTitle ? (
          <input value={titleDraft} onChange={e => setTitleDraft(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false) }}
            className="text-2xl font-bold text-center border-b-2 border-blue-500 outline-none px-2" autoFocus />
        ) : (
          <h2 className="text-2xl font-bold text-gray-800 cursor-pointer hover:text-blue-600"
            onDoubleClick={() => { setTitleDraft(title); setEditingTitle(true) }}>
            {title}
          </h2>
        )}
      </div>

      <div className="flex gap-6 items-center">
        <svg width="320" height="320" viewBox="0 0 320 320">
          {segments.map((seg) => (
            <path key={seg.index} d={seg.path} fill={seg.color}
              stroke={svgEditing === seg.index ? '#1d4ed8' : 'black'}
              strokeWidth={svgEditing === seg.index ? 3 : 1.5}
              className="cursor-pointer transition-all"
              style={{ filter: svgEditing === seg.index ? 'brightness(0.85)' : undefined }}
              onDoubleClick={() => { setSvgEditing(seg.index); setSvgValueDraft(seg.value.toString()) }}
            />
          ))}
          {segments.map((seg) => (
            seg.percentage > 5 && svgEditing !== seg.index && (
              <text key={`lbl-${seg.index}`} x={seg.lx} y={seg.ly - 7}
                textAnchor="middle" fontSize="12" fontWeight="500" fill="#333"
                className="pointer-events-none select-none">
                <tspan x={seg.lx} dy="0">{seg.value}</tspan>
                <tspan x={seg.lx} dy="15">{seg.percentage.toFixed(1)}%</tspan>
              </text>
            )
          ))}
          {svgEditing !== null && (() => {
            const seg = segments[svgEditing]
            if (!seg) return null
            return (
              <foreignObject x={seg.lx - 36} y={seg.ly - 14} width={72} height={28}>
                <input value={svgValueDraft} type="number" min="0"
                  onChange={e => setSvgValueDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitSvgEdit(svgEditing)
                    if (e.key === 'Escape') setSvgEditing(null)
                  }}
                  onBlur={() => commitSvgEdit(svgEditing)}
                  className="w-full h-full text-center text-sm border-2 border-blue-500 rounded bg-white outline-none"
                  autoFocus onClick={e => e.stopPropagation()} />
              </foreignObject>
            )
          })()}
        </svg>

        <div className="flex flex-col gap-2 min-w-[140px]">
          {segments.map((seg) => (
            <div key={seg.index}
              className={`flex items-center gap-2 rounded px-1 transition-colors ${dragOver === seg.index ? 'bg-blue-50 border border-blue-300' : ''}`}
              draggable
              onDragStart={e => e.dataTransfer.setData('text/plain', String(seg.index))}
              onDragOver={e => { e.preventDefault(); setDragOver(seg.index) }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { e.preventDefault(); handleDrop(parseInt(e.dataTransfer.getData('text/plain')), seg.index); setDragOver(null) }}
            >
              <div className="w-4 h-4 flex-shrink-0 border border-gray-400" style={{ backgroundColor: seg.color }} />
              {legendEditing === seg.index ? (
                <div className="flex gap-1 items-center">
                  <input value={labelDraft} onChange={e => setLabelDraft(e.target.value)}
                    className="border rounded px-1 py-0.5 text-sm w-24" autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') commitLegendEdit(seg.index); if (e.key === 'Escape') setLegendEditing(null) }} />
                  <input value={valueDraft} onChange={e => setValueDraft(e.target.value)}
                    type="number" min="0" className="border rounded px-1 py-0.5 text-sm w-16"
                    onKeyDown={e => { if (e.key === 'Enter') commitLegendEdit(seg.index); if (e.key === 'Escape') setLegendEditing(null) }} />
                  <button onClick={() => commitLegendEdit(seg.index)} className="px-1.5 py-0.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">✓</button>
                  <button onClick={() => setLegendEditing(null)} className="px-1.5 py-0.5 bg-gray-300 rounded text-xs hover:bg-gray-400">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1 w-full">
                  <span className="text-sm cursor-pointer hover:text-blue-600 flex-1"
                    onClick={() => setSelectedIndex(selectedIndex === seg.index ? null : seg.index)}
                    onDoubleClick={e => { e.stopPropagation(); e.preventDefault(); setLegendEditing(seg.index); setLabelDraft(seg.label); setValueDraft(seg.value.toString()) }}>
                    {seg.label}: {seg.value} ({seg.percentage.toFixed(1)}%)
                  </span>
                  {selectedIndex === seg.index && (
                    <button onClick={() => handleDeleteItem(seg.index)}
                      className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-red-500 text-white rounded text-xs hover:bg-red-600">×</button>
                  )}
                </div>
              )}
            </div>
          ))}
          <button onClick={() => onUpdate(title, [...data, { label: '新项目', value: 10 }])}
            className="mt-2 px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 select-none cursor-pointer">
            + 添加项目
          </button>
        </div>
      </div>
    </div>
  )
}
