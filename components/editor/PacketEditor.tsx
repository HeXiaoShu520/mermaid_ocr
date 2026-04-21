'use client'

import { useState, useCallback } from 'react'
import type { PacketData, PacketField } from '@/lib/packetParser'

// 每行 32 位
const BITS_PER_ROW = 32
const BIT_WIDTH = 24
const ROW_HEIGHT = 40
const HEADER_HEIGHT = 28

interface PacketEditorProps {
  data: PacketData
  onUpdate: (data: PacketData) => void
}

export function PacketEditor({ data, onUpdate }: PacketEditorProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)

  const totalBits = data.fields.length > 0
    ? Math.max(...data.fields.map(f => f.endBit)) + 1
    : 32
  const totalRows = Math.ceil(totalBits / BITS_PER_ROW)

  const handleFieldDoubleClick = useCallback((field: PacketField) => {
    setEditingField(field.id)
    setDraft(field.label)
  }, [])

  const commitEdit = useCallback(() => {
    if (!editingField) return
    const newFields = data.fields.map(f =>
      f.id === editingField ? { ...f, label: draft.trim() || f.label } : f
    )
    onUpdate({ fields: newFields })
    setEditingField(null)
  }, [editingField, draft, data, onUpdate])

  const handleAddField = useCallback(() => {
    const lastEnd = data.fields.length > 0
      ? Math.max(...data.fields.map(f => f.endBit))
      : -1
    const startBit = lastEnd + 1
    const endBit = startBit + 7 // 默认 8 位
    const newField: PacketField = {
      id: `field-${Date.now()}`,
      startBit,
      endBit,
      label: '新字段',
    }
    onUpdate({ fields: [...data.fields, newField] })
  }, [data, onUpdate])

  const handleRemoveField = useCallback((id: string) => {
    onUpdate({ fields: data.fields.filter(f => f.id !== id) })
    if (selectedFieldId === id) setSelectedFieldId(null)
  }, [data, onUpdate, selectedFieldId])

  const handleUpdateField = useCallback((id: string, patch: Partial<PacketField>) => {
    onUpdate({
      fields: data.fields.map(f => f.id === id ? { ...f, ...patch } : f),
    })
  }, [data, onUpdate])

  // 渲染位标尺
  const renderBitRuler = () => {
    const bits = []
    for (let i = 0; i < BITS_PER_ROW; i++) {
      bits.push(
        <div
          key={i}
          className="flex items-center justify-center text-[10px] text-gray-400 font-mono select-none"
          style={{ width: BIT_WIDTH, height: HEADER_HEIGHT }}
        >
          {i}
        </div>
      )
    }
    return <div className="flex">{bits}</div>
  }

  // 渲染字段块
  const renderFields = () => {
    const rows: React.ReactNode[][] = Array.from({ length: totalRows }, () => [])

    for (const field of data.fields) {
      const startRow = Math.floor(field.startBit / BITS_PER_ROW)
      const endRow = Math.floor(field.endBit / BITS_PER_ROW)

      for (let row = startRow; row <= endRow; row++) {
        const rowStart = row * BITS_PER_ROW
        const colStart = Math.max(field.startBit - rowStart, 0)
        const colEnd = Math.min(field.endBit - rowStart, BITS_PER_ROW - 1)
        const span = colEnd - colStart + 1
        const isSelected = selectedFieldId === field.id
        const isEditing = editingField === field.id

        rows[row].push(
          <div
            key={field.id + '-' + row}
            className={`absolute flex items-center justify-center border text-xs font-medium cursor-pointer transition-all select-none
              ${isSelected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300 z-10' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
            style={{
              left: colStart * BIT_WIDTH,
              top: 0,
              width: span * BIT_WIDTH,
              height: ROW_HEIGHT,
              borderRadius: 3,
            }}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedFieldId(field.id)
            }}
            onDoubleClick={() => handleFieldDoubleClick(field)}
          >
            {isEditing ? (
              <input
                autoFocus
                className="w-full h-full text-center text-xs bg-transparent outline-none"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit()
                  if (e.key === 'Escape') setEditingField(null)
                  e.stopPropagation()
                }}
              />
            ) : (
              <span className="truncate px-1" title={`${field.label} [${field.startBit}-${field.endBit}]`}>
                {field.label}
              </span>
            )}
          </div>
        )
      }
    }

    return rows.map((rowFields, rowIdx) => (
      <div key={rowIdx} className="relative" style={{ height: ROW_HEIGHT }}>
        {/* 背景网格 */}
        {Array.from({ length: BITS_PER_ROW }).map((_, i) => (
          <div
            key={i}
            className="absolute border-r border-gray-100"
            style={{ left: i * BIT_WIDTH, top: 0, width: BIT_WIDTH, height: ROW_HEIGHT }}
          />
        ))}
        {rowFields}
      </div>
    ))
  }

  return (
    <div className="flex h-full">
      {/* 画布区 */}
      <div
        className="flex-1 overflow-auto p-6"
        onClick={() => setSelectedFieldId(null)}
      >
        <div className="inline-block">
          {/* 位标尺 */}
          {renderBitRuler()}
          {/* 字段行 */}
          <div className="border border-gray-200 rounded" style={{ width: BITS_PER_ROW * BIT_WIDTH }}>
            {renderFields()}
          </div>
          {/* 行号标注 */}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
            <span>共 {totalBits} 位</span>
            <span>·</span>
            <span>{data.fields.length} 个字段</span>
          </div>
        </div>
      </div>

      {/* 右侧属性面板 */}
      <div className="w-64 border-l bg-gray-50 overflow-y-auto p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">字段列表</span>
          <button
            onClick={handleAddField}
            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            + 添加字段
          </button>
        </div>

        <div className="flex flex-col gap-1">
          {data.fields.map(field => (
            <div
              key={field.id}
              className={`p-2 rounded text-xs cursor-pointer transition-colors ${
                selectedFieldId === field.id ? 'bg-blue-100 border border-blue-300' : 'bg-white border border-gray-200 hover:bg-gray-100'
              }`}
              onClick={() => setSelectedFieldId(field.id)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">{field.label}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveField(field.id) }}
                  className="text-red-400 hover:text-red-600 ml-1"
                  title="删除"
                >
                  ×
                </button>
              </div>
              <div className="text-gray-400 mt-0.5">位 {field.startBit} - {field.endBit}</div>
            </div>
          ))}
        </div>

        {/* 选中字段的属性编辑 */}
        {selectedFieldId && (() => {
          const field = data.fields.find(f => f.id === selectedFieldId)
          if (!field) return null
          return (
            <div className="border-t pt-3 flex flex-col gap-2">
              <div className="text-xs font-semibold text-gray-600">属性</div>
              <label className="text-xs text-gray-500">
                标签
                <input
                  className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                  value={field.label}
                  onChange={e => handleUpdateField(field.id, { label: e.target.value })}
                  onKeyDown={e => e.stopPropagation()}
                />
              </label>
              <div className="flex gap-2">
                <label className="text-xs text-gray-500 flex-1">
                  起始位
                  <input
                    type="number"
                    className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                    value={field.startBit}
                    min={0}
                    onChange={e => handleUpdateField(field.id, { startBit: parseInt(e.target.value) || 0 })}
                    onKeyDown={e => e.stopPropagation()}
                  />
                </label>
                <label className="text-xs text-gray-500 flex-1">
                  结束位
                  <input
                    type="number"
                    className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                    value={field.endBit}
                    min={field.startBit}
                    onChange={e => handleUpdateField(field.id, { endBit: parseInt(e.target.value) || field.startBit })}
                    onKeyDown={e => e.stopPropagation()}
                  />
                </label>
              </div>
              <div className="text-xs text-gray-400">
                宽度: {field.endBit - field.startBit + 1} 位
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
