'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { PacketData, PacketField } from '@/lib/packetParser'

const BIT_WIDTH = 24
const ROW_HEIGHT = 48
const ROW_GAP = 8  // 行间距
const HEADER_HEIGHT = 24

const FIELD_COLORS = [
  { bg: '#dbeafe', border: '#93c5fd', text: '#1d4ed8' },
  { bg: '#d1fae5', border: '#6ee7b7', text: '#065f46' },
  { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' },
  { bg: '#ede9fe', border: '#c4b5fd', text: '#5b21b6' },
  { bg: '#fee2e2', border: '#fca5a5', text: '#991b1b' },
  { bg: '#ccfbf1', border: '#5eead4', text: '#134e4a' },
  { bg: '#fce7f3', border: '#f9a8d4', text: '#9d174d' },
  { bg: '#e0f2fe', border: '#7dd3fc', text: '#075985' },
]

interface PacketEditorProps {
  data: PacketData
  onUpdate: (data: PacketData) => void
}

export function PacketEditor({ data, onUpdate }: PacketEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [resizeMode, setResizeMode] = useState<'cover' | 'push'>('push')
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [canvasWidth, setCanvasWidth] = useState(800)

  const bitsPerRow = data.bitsPerRow || 32
  const containerRef = useRef<HTMLDivElement>(null)

  const dragRef = useRef<{
    type: 'left' | 'right' | 'move'
    fieldId: string
    startX: number
    startBit: number
    endBit: number
    fields: PacketField[]
  } | null>(null)

  const totalBits = data.fields.length > 0 ? Math.max(...data.fields.map(f => f.endBit)) + 1 : bitsPerRow
  const totalRows = Math.ceil(totalBits / bitsPerRow)

  const commitEdit = useCallback(() => {
    if (!editingId) return
    onUpdate({ ...data, fields: data.fields.map(f => f.id === editingId ? { ...f, label: draft.trim() || f.label } : f) })
    setEditingId(null)
  }, [editingId, draft, data, onUpdate])

  const handleAddField = useCallback(() => {
    const lastEnd = data.fields.length > 0 ? Math.max(...data.fields.map(f => f.endBit)) : -1
    onUpdate({ ...data, fields: [...data.fields, { id: `field-${Date.now()}`, startBit: lastEnd + 1, endBit: lastEnd + 8, label: '新字段' }] })
  }, [data, onUpdate])

  // 判断两个字段是否有交集
  const hasOverlap = (a: PacketField, b: PacketField) => a.startBit <= b.endBit && a.endBit >= b.startBit

  const startDrag = useCallback((e: React.MouseEvent, type: 'left' | 'right' | 'move', fieldId: string) => {
    e.stopPropagation()
    e.preventDefault()
    const field = data.fields.find(f => f.id === fieldId)!
    dragRef.current = { type, fieldId, startX: e.clientX, startBit: field.startBit, endBit: field.endBit, fields: data.fields }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const dx = (ev.clientX - dragRef.current.startX) / transform.scale
      const dBits = Math.round(dx / BIT_WIDTH)
      const { type, fieldId, startBit, endBit, fields } = dragRef.current
      let newFields = fields.map(f => ({ ...f }))
      const idx = newFields.findIndex(f => f.id === fieldId)
      if (idx < 0) return
      const f = newFields[idx]

      if (type === 'move') {
        const width = endBit - startBit
        const newStart = Math.max(0, startBit + dBits)
        const newEnd = newStart + width
        f.startBit = newStart
        f.endBit = newEnd

        // 实时碰撞检测：向右移动时检测后面的字段
        if (dBits > 0 && idx + 1 < newFields.length) {
          const next = newFields[idx + 1]
          if (hasOverlap(f, next)) {
            if (resizeMode === 'push') {
              // 顺延：后面所有字段整体平移
              const delta = (newEnd - next.startBit) + 1
              for (let i = idx + 1; i < newFields.length; i++) {
                newFields[i] = { ...newFields[i], startBit: newFields[i].startBit + delta, endBit: newFields[i].endBit + delta }
              }
            } else {
              // 覆盖：调整下一个字段的起点，完全覆盖则删除
              if (newEnd >= next.endBit) {
                newFields.splice(idx + 1, 1)
              } else {
                newFields[idx + 1] = { ...next, startBit: newEnd + 1 }
              }
            }
          }
        }
        // 向左移动时检测前面的字段
        else if (dBits < 0 && idx - 1 >= 0) {
          const prev = newFields[idx - 1]
          if (hasOverlap(f, prev)) {
            if (resizeMode === 'push') {
              // 顺延：前面所有字段整体平移
              const delta = (prev.endBit - newStart) + 1
              for (let i = idx - 1; i >= 0; i--) {
                newFields[i] = { ...newFields[i], startBit: newFields[i].startBit - delta, endBit: newFields[i].endBit - delta }
              }
            } else {
              // 覆盖：调整前一个字段的终点，完全覆盖则删除
              if (newStart <= prev.startBit) {
                newFields.splice(idx - 1, 1)
              } else {
                newFields[idx - 1] = { ...prev, endBit: newStart - 1 }
              }
            }
          }
        }
      } else if (type === 'right') {
        const newEnd = Math.max(f.startBit, endBit + dBits)
        const oldEnd = f.endBit
        f.endBit = newEnd
        // 只有与相邻字段有交集时才触发顺延/覆盖
        if (idx + 1 < newFields.length) {
          const next = newFields[idx + 1]
          if (hasOverlap(f, next)) {
            if (resizeMode === 'push') {
              const delta = newEnd - oldEnd
              for (let i = idx + 1; i < newFields.length; i++) {
                newFields[i] = { ...newFields[i], startBit: newFields[i].startBit + delta, endBit: newFields[i].endBit + delta }
              }
            } else {
              if (newEnd >= next.endBit) newFields.splice(idx + 1, 1)
              else newFields[idx + 1] = { ...next, startBit: newEnd + 1 }
            }
          }
        }
      } else { // left
        const newStart = Math.min(f.endBit, Math.max(0, startBit + dBits))
        const oldStart = f.startBit
        f.startBit = newStart
        // 只有与相邻字段有交集时才触发顺延/覆盖
        if (idx - 1 >= 0) {
          const prev = newFields[idx - 1]
          if (hasOverlap(f, prev)) {
            if (resizeMode === 'push') {
              const delta = newStart - oldStart
              for (let i = idx - 1; i >= 0; i--) {
                newFields[i] = { ...newFields[i], startBit: newFields[i].startBit + delta, endBit: newFields[i].endBit + delta }
              }
            } else {
              if (newStart <= prev.startBit) newFields.splice(idx - 1, 1)
              else newFields[idx - 1] = { ...prev, endBit: newStart - 1 }
            }
          }
        }
      }
      onUpdate({ ...data, fields: newFields })
    }

    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [data, resizeMode, transform.scale, onUpdate])

  // 画布缩放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform(t => ({ ...t, scale: Math.max(0.3, Math.min(3, t.scale * delta)) }))
  }, [])

  // 中键平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      setIsPanning(true)
      setPanStart({ x: e.clientX - transform.x, y: e.clientY - transform.y })
    }
  }, [transform])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isPanning) return
      setTransform(t => ({ ...t, x: e.clientX - panStart.x, y: e.clientY - panStart.y }))
    }
    const onUp = (e: MouseEvent) => { if (e.button === 1) setIsPanning(false) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [isPanning, panStart])

  const GAP = 2 // 字段间视觉空隙 px

  const renderRow = (rowIdx: number) => {
    const rowStart = rowIdx * bitsPerRow
    const rowEnd = rowStart + bitsPerRow - 1
    const segments: { field: PacketField; colStart: number; colEnd: number; colorIdx: number }[] = []
    data.fields.forEach((field, fi) => {
      if (field.endBit < rowStart || field.startBit > rowEnd) return
      segments.push({ field, colStart: Math.max(field.startBit - rowStart, 0), colEnd: Math.min(field.endBit - rowStart, bitsPerRow - 1), colorIdx: fi % FIELD_COLORS.length })
    })

    return (
      <div key={rowIdx} style={{ marginBottom: ROW_GAP }}>
        <div className="relative" style={{ height: ROW_HEIGHT, border: '1px solid #e5e7eb', borderRadius: 4 }}>
          {segments.map(({ field, colStart, colEnd, colorIdx }) => {
            const color = FIELD_COLORS[colorIdx]
            const isSelected = selectedId === field.id
            const isEditing = editingId === field.id
            const rawW = (colEnd - colStart + 1) * BIT_WIDTH
            const isFirstInRow = field.startBit >= rowStart
            const isLastInRow = field.endBit <= rowEnd
            const displayStart = rowStart + colStart
            const displayEnd = rowStart + colEnd
            // 空隙：左边（非行首）+1px，右边（非行尾）+1px
            const gL = colStart > 0 ? GAP : 0
            const gR = colEnd < bitsPerRow - 1 ? GAP : 0

            return (
              <div key={field.id + '-' + rowIdx}
                className="absolute flex flex-col items-center justify-center text-xs font-semibold select-none"
                style={{
                  left: colStart * BIT_WIDTH + gL,
                  top: 2, bottom: 2,
                  width: rawW - gL - gR,
                  background: isSelected ? '#dbeafe' : color.bg,
                  border: `1.5px solid ${isSelected ? '#3b82f6' : color.border}`,
                  borderRadius: 3,
                  color: isSelected ? '#1d4ed8' : color.text,
                  zIndex: isSelected ? 2 : 1,
                  cursor: 'grab',
                }}
                onClick={e => { e.stopPropagation(); setSelectedId(field.id) }}
                onDoubleClick={() => { setEditingId(field.id); setDraft(field.label) }}
                onMouseDown={e => { if (e.button === 0 && !isEditing) startDrag(e, 'move', field.id) }}
              >
                {isEditing ? (
                  <input autoFocus className="w-full text-center text-xs bg-transparent outline-none px-1"
                    value={draft} onChange={e => setDraft(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); e.stopPropagation() }}
                    onClick={e => e.stopPropagation()} />
                ) : (
                  <span className="truncate px-2 leading-tight">{field.label}</span>
                )}
                {/* bit 位标注 */}
                {!isEditing && rawW >= 28 && (
                  <div className="flex justify-between w-full px-1 pointer-events-none" style={{ fontSize: 9, color: 'rgba(0,0,0,0.28)', lineHeight: 1 }}>
                    <span>{displayStart}</span>
                    {displayEnd !== displayStart && <span>{displayEnd}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const [rightW, setRightW] = useState(256)
  const dividerDrag = useRef<{ startX: number; startW: number } | null>(null)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dividerDrag.current) return
      const dx = dividerDrag.current.startX - e.clientX
      setRightW(Math.max(160, Math.min(480, dividerDrag.current.startW + dx)))
    }
    const onUp = () => { dividerDrag.current = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const selectedField = selectedId ? data.fields.find(f => f.id === selectedId) : null

  return (
    <div className="flex h-full">
      {/* 画布区 */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden bg-gray-50 relative"
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
        onClick={() => setSelectedId(null)}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        {/* 缩放控制条 */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1 shadow-sm">
          <button onClick={() => setTransform(t => ({ ...t, scale: Math.max(0.3, t.scale - 0.1) }))} className="text-gray-500 hover:text-gray-800 text-sm w-5 h-5 flex items-center justify-center">−</button>
          <span className="text-xs text-gray-500 w-10 text-center">{Math.round(transform.scale * 100)}%</span>
          <button onClick={() => setTransform(t => ({ ...t, scale: Math.min(3, t.scale + 0.1) }))} className="text-gray-500 hover:text-gray-800 text-sm w-5 h-5 flex items-center justify-center">+</button>
          <div className="w-px h-4 bg-gray-200" />
          <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="text-xs text-gray-400 hover:text-gray-600">重置</button>
        </div>

        <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0', padding: 24, display: 'inline-block' }}>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-visible" style={{ width: bitsPerRow * BIT_WIDTH }}>
            {/* 列头 */}
            <div className="flex border-b border-gray-200 bg-gray-50 rounded-t-xl">
              {Array.from({ length: bitsPerRow }).map((_, i) => (
                <div key={i} className="flex items-center justify-center font-mono text-gray-400 border-r border-gray-100 last:border-r-0"
                  style={{ width: BIT_WIDTH, height: HEADER_HEIGHT, fontSize: 10 }}>{i}</div>
              ))}
            </div>
            {/* 数据行 */}
            <div style={{ padding: '8px 0' }}>
              {Array.from({ length: totalRows }).map((_, i) => renderRow(i))}
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-400">共 {totalBits} 位 · {data.fields.length} 个字段 · 滚轮缩放 · 中键平移</div>
        </div>
      </div>

      {/* 分隔条 */}
      <div
        style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0 }}
        className="hover:bg-blue-300 transition-colors"
        onMouseDown={e => { dividerDrag.current = { startX: e.clientX, startW: rightW } }}
      />

      {/* 右侧面板 */}
      <div className="border-l bg-gray-50 overflow-y-auto p-3 flex flex-col gap-3" style={{ width: rightW, flexShrink: 0 }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">字段列表</span>
          <button onClick={handleAddField} className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">+ 添加字段</button>
        </div>

        {/* 每行位数 */}
        <label className="text-xs text-gray-500">每行位数
          <div className="flex items-center gap-2 mt-0.5">
            <input type="number" className="flex-1 px-2 py-1 border rounded text-xs" value={bitsPerRow} min={8} max={128} step={8}
              onChange={e => onUpdate({ ...data, bitsPerRow: parseInt(e.target.value) || 32 })}
              onKeyDown={e => e.stopPropagation()} />
          </div>
        </label>

        {/* 拖拽模式 */}
        <div className="flex gap-1 p-1 bg-gray-200 rounded text-xs">
          <button onClick={() => setResizeMode('push')} className={`flex-1 py-1 rounded transition-colors ${resizeMode === 'push' ? 'bg-white text-blue-600 font-medium shadow-sm' : 'text-gray-500'}`}>顺延</button>
          <button onClick={() => setResizeMode('cover')} className={`flex-1 py-1 rounded transition-colors ${resizeMode === 'cover' ? 'bg-white text-blue-600 font-medium shadow-sm' : 'text-gray-500'}`}>覆盖</button>
        </div>

        <div className="flex flex-col gap-1">
          {data.fields.map((field, fi) => {
            const color = FIELD_COLORS[fi % FIELD_COLORS.length]
            return (
              <div key={field.id} className={`p-2 rounded text-xs cursor-pointer border ${selectedId === field.id ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                style={{ borderLeft: `3px solid ${color.border}` }}
                onClick={() => setSelectedId(field.id)}>
                <div className="flex items-center justify-between">
                  <span className="font-medium truncate" style={{ color: color.text }}>{field.label}</span>
                  <button onClick={e => { e.stopPropagation(); onUpdate({ ...data, fields: data.fields.filter(f => f.id !== field.id) }); if (selectedId === field.id) setSelectedId(null) }} className="text-gray-300 hover:text-red-500 ml-1">×</button>
                </div>
                <div className="text-gray-400 mt-0.5">位 {field.startBit} - {field.endBit}</div>
              </div>
            )
          })}
        </div>

        {selectedField && (
          <div className="border-t pt-3 flex flex-col gap-2">
            <div className="text-xs font-semibold text-gray-600">属性</div>
            <label className="text-xs text-gray-500">标签
              <input className="w-full mt-0.5 px-2 py-1 border rounded text-xs" value={selectedField.label}
                onChange={e => onUpdate({ ...data, fields: data.fields.map(f => f.id === selectedField.id ? { ...f, label: e.target.value } : f) })}
                onKeyDown={e => e.stopPropagation()} />
            </label>
            <div className="flex gap-2">
              <label className="text-xs text-gray-500 flex-1">起始位
                <input type="number" className="w-full mt-0.5 px-2 py-1 border rounded text-xs" value={selectedField.startBit} min={0}
                  onChange={e => onUpdate({ ...data, fields: data.fields.map(f => f.id === selectedField.id ? { ...f, startBit: parseInt(e.target.value) || 0 } : f) })}
                  onKeyDown={e => e.stopPropagation()} />
              </label>
              <label className="text-xs text-gray-500 flex-1">结束位
                <input type="number" className="w-full mt-0.5 px-2 py-1 border rounded text-xs" value={selectedField.endBit} min={selectedField.startBit}
                  onChange={e => onUpdate({ ...data, fields: data.fields.map(f => f.id === selectedField.id ? { ...f, endBit: parseInt(e.target.value) || selectedField.startBit } : f) })}
                  onKeyDown={e => e.stopPropagation()} />
              </label>
            </div>
            <div className="text-xs text-gray-400">宽度: {selectedField.endBit - selectedField.startBit + 1} 位</div>
          </div>
        )}
      </div>
    </div>
  )
}
