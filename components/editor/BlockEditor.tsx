'use client'

import { useState, useCallback } from 'react'
import type { BlockData, BlockItem, BlockShape } from '@/lib/blockParser'

interface BlockEditorProps {
  data: BlockData
  onUpdate: (data: BlockData) => void
}

let _blockItemCounter = 2000

const SHAPE_OPTIONS: { value: BlockShape; label: string; preview: string }[] = [
  { value: 'rectangle', label: '矩形', preview: '[ ]' },
  { value: 'rounded', label: '圆角', preview: '( )' },
  { value: 'stadium', label: '体育场', preview: '([ ])' },
  { value: 'subroutine', label: '子程序', preview: '[[ ]]' },
  { value: 'cylinder', label: '圆柱', preview: '[( )]' },
  { value: 'circle', label: '圆形', preview: '(( ))' },
  { value: 'diamond', label: '菱形', preview: '{ }' },
  { value: 'hexagon', label: '六边形', preview: '{{ }}' },
  { value: 'parallelogram', label: '平行四边形', preview: '[/ /]' },
  { value: 'trapezoid', label: '梯形', preview: '[\\ \\]' },
  { value: 'double-circle', label: '双圆', preview: '((( )))' },
]

const SHAPE_COLORS: Record<BlockShape, string> = {
  rectangle: '#dbeafe',
  rounded: '#d1fae5',
  stadium: '#fef3c7',
  subroutine: '#ede9fe',
  cylinder: '#fee2e2',
  circle: '#ccfbf1',
  diamond: '#fce7f3',
  hexagon: '#f3e8ff',
  parallelogram: '#e0f2fe',
  trapezoid: '#fef9c3',
  'double-circle': '#dcfce7',
}

const SHAPE_BORDER_COLORS: Record<BlockShape, string> = {
  rectangle: '#93c5fd',
  rounded: '#6ee7b7',
  stadium: '#fcd34d',
  subroutine: '#c4b5fd',
  cylinder: '#fca5a5',
  circle: '#5eead4',
  diamond: '#f9a8d4',
  hexagon: '#d8b4fe',
  parallelogram: '#7dd3fc',
  trapezoid: '#fde047',
  'double-circle': '#86efac',
}

// 渲染块形状的 SVG 预览
function BlockShapePreview({ shape, label, width, height, selected }: {
  shape: BlockShape
  label: string
  width: number
  height: number
  selected: boolean
}) {
  const fill = selected ? '#dbeafe' : SHAPE_COLORS[shape]
  const stroke = selected ? '#3b82f6' : SHAPE_BORDER_COLORS[shape]
  const sw = selected ? 2.5 : 1.5
  const w = width
  const h = height
  const pad = sw + 2

  let shapeEl: React.ReactNode

  switch (shape) {
    case 'circle':
    case 'double-circle': {
      const r = Math.min(w, h) / 2 - pad
      shapeEl = (
        <>
          <circle cx={w / 2} cy={h / 2} r={r} fill={fill} stroke={stroke} strokeWidth={sw} />
          {shape === 'double-circle' && (
            <circle cx={w / 2} cy={h / 2} r={r - 4} fill="none" stroke={stroke} strokeWidth={sw * 0.7} />
          )}
        </>
      )
      break
    }
    case 'diamond': {
      const mx = w / 2, my = h / 2
      shapeEl = (
        <polygon
          points={`${mx},${pad} ${w - pad},${my} ${mx},${h - pad} ${pad},${my}`}
          fill={fill} stroke={stroke} strokeWidth={sw}
        />
      )
      break
    }
    case 'hexagon': {
      const mx = w / 2, my = h / 2
      const rx = w / 2 - pad, ry = h / 2 - pad
      shapeEl = (
        <polygon
          points={`${mx - rx * 0.5},${pad} ${mx + rx * 0.5},${pad} ${w - pad},${my} ${mx + rx * 0.5},${h - pad} ${mx - rx * 0.5},${h - pad} ${pad},${my}`}
          fill={fill} stroke={stroke} strokeWidth={sw}
        />
      )
      break
    }
    case 'stadium': {
      const r = (h - pad * 2) / 2
      shapeEl = <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} rx={r} fill={fill} stroke={stroke} strokeWidth={sw} />
      break
    }
    case 'rounded': {
      shapeEl = <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} rx={8} fill={fill} stroke={stroke} strokeWidth={sw} />
      break
    }
    case 'cylinder': {
      const ew = w - pad * 2, eh = h - pad * 2, ey = 10
      shapeEl = (
        <>
          <rect x={pad} y={pad + ey} width={ew} height={eh - ey} fill={fill} stroke="none" />
          <line x1={pad} y1={pad + ey} x2={pad} y2={pad + eh} stroke={stroke} strokeWidth={sw} />
          <line x1={pad + ew} y1={pad + ey} x2={pad + ew} y2={pad + eh} stroke={stroke} strokeWidth={sw} />
          <ellipse cx={w / 2} cy={pad + ey} rx={ew / 2} ry={ey} fill={fill} stroke={stroke} strokeWidth={sw} />
          <ellipse cx={w / 2} cy={pad + eh} rx={ew / 2} ry={ey} fill={fill} stroke={stroke} strokeWidth={sw} />
        </>
      )
      break
    }
    case 'subroutine': {
      shapeEl = (
        <>
          <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} />
          <line x1={pad + 8} y1={pad} x2={pad + 8} y2={h - pad} stroke={stroke} strokeWidth={sw * 0.7} />
          <line x1={w - pad - 8} y1={pad} x2={w - pad - 8} y2={h - pad} stroke={stroke} strokeWidth={sw * 0.7} />
        </>
      )
      break
    }
    case 'parallelogram': {
      const off = 10
      shapeEl = (
        <polygon
          points={`${pad + off},${pad} ${w - pad},${pad} ${w - pad - off},${h - pad} ${pad},${h - pad}`}
          fill={fill} stroke={stroke} strokeWidth={sw}
        />
      )
      break
    }
    case 'trapezoid': {
      const off = 12
      shapeEl = (
        <polygon
          points={`${pad},${pad} ${w - pad},${pad} ${w - pad - off},${h - pad} ${pad + off},${h - pad}`}
          fill={fill} stroke={stroke} strokeWidth={sw}
        />
      )
      break
    }
    default: // rectangle
      shapeEl = <rect x={pad} y={pad} width={w - pad * 2} height={h - pad * 2} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} />
  }

  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      {shapeEl}
      <text
        x={w / 2} y={h / 2}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fill={selected ? '#1d4ed8' : '#374151'}
        style={{ userSelect: 'none', pointerEvents: 'none' }}
      >
        {label.length > 10 ? label.slice(0, 9) + '…' : label}
      </text>
    </svg>
  )
}

export function BlockEditor({ data, onUpdate }: BlockEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const selectedBlock = data.blocks.find(b => b.id === selectedId) ?? null

  const updateBlock = useCallback((id: string, patch: Partial<BlockItem>) => {
    onUpdate({ ...data, blocks: data.blocks.map(b => b.id === id ? { ...b, ...patch } : b) })
  }, [data, onUpdate])

  const addBlock = useCallback((shape: BlockShape = 'rectangle') => {
    const id = `blk${++_blockItemCounter}`
    const newBlock: BlockItem = { id, label: '新块', shape }
    onUpdate({ ...data, blocks: [...data.blocks, newBlock] })
    setSelectedId(id)
    setTimeout(() => { setEditingId(id); setDraft('新块') }, 50)
  }, [data, onUpdate])

  const addSpace = useCallback(() => {
    const id = `space-${++_blockItemCounter}`
    onUpdate({ ...data, blocks: [...data.blocks, { id, label: '', shape: 'rectangle', isSpace: true }] })
  }, [data, onUpdate])

  const deleteBlock = useCallback((id: string) => {
    onUpdate({ ...data, blocks: data.blocks.filter(b => b.id !== id) })
    if (selectedId === id) setSelectedId(null)
  }, [data, onUpdate, selectedId])

  const commitEdit = useCallback(() => {
    if (!editingId) return
    const trimmed = draft.trim()
    if (trimmed) updateBlock(editingId, { label: trimmed })
    setEditingId(null)
  }, [editingId, draft, updateBlock])

  const moveBlock = useCallback((id: string, dir: 'left' | 'right') => {
    const idx = data.blocks.findIndex(b => b.id === id)
    if (idx < 0) return
    const newBlocks = [...data.blocks]
    if (dir === 'left' && idx > 0) {
      ;[newBlocks[idx - 1], newBlocks[idx]] = [newBlocks[idx], newBlocks[idx - 1]]
    } else if (dir === 'right' && idx < newBlocks.length - 1) {
      ;[newBlocks[idx], newBlocks[idx + 1]] = [newBlocks[idx + 1], newBlocks[idx]]
    }
    onUpdate({ ...data, blocks: newBlocks })
  }, [data, onUpdate])

  // 计算网格布局
  const cols = data.columns
  const CELL_W = 120
  const CELL_H = 60
  const GAP = 8
  const PADDING = 16

  // 计算每个块的位置（按列数换行）
  let col = 0
  let row = 0
  const positions: { x: number; y: number; w: number; h: number }[] = []

  for (const block of data.blocks) {
    const span = Math.min(block.colspan ?? 1, cols)
    if (col + span > cols) {
      col = 0
      row++
    }
    positions.push({
      x: PADDING + col * (CELL_W + GAP),
      y: PADDING + row * (CELL_H + GAP),
      w: span * CELL_W + (span - 1) * GAP,
      h: CELL_H,
    })
    col += span
    if (col >= cols) { col = 0; row++ }
  }

  const totalRows = row + (col > 0 ? 1 : 0)
  const canvasW = PADDING * 2 + cols * CELL_W + (cols - 1) * GAP
  const canvasH = PADDING * 2 + totalRows * CELL_H + (totalRows - 1) * GAP

  return (
    <div className="flex h-full">
      {/* 画布区 */}
      <div
        className="flex-1 overflow-auto p-4 bg-gray-50"
        onClick={() => { setSelectedId(null); setEditingId(null) }}
      >
        <div
          className="relative bg-white rounded-lg border border-gray-200 shadow-sm inline-block"
          style={{ width: canvasW, height: Math.max(canvasH, 120) }}
        >
          {data.blocks.map((block, idx) => {
            const pos = positions[idx]
            if (!pos) return null
            const isSelected = selectedId === block.id
            const isEditing = editingId === block.id

            if (block.isSpace) {
              return (
                <div
                  key={block.id}
                  className="absolute flex items-center justify-center border-2 border-dashed border-gray-200 rounded text-gray-300 text-xs cursor-pointer hover:border-gray-300 transition-colors"
                  style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
                  onClick={(e) => { e.stopPropagation(); setSelectedId(block.id) }}
                >
                  空白
                </div>
              )
            }

            return (
              <div
                key={block.id}
                className="absolute cursor-pointer"
                style={{ left: pos.x, top: pos.y, width: pos.w, height: pos.h }}
                onClick={(e) => { e.stopPropagation(); setSelectedId(block.id) }}
                onDoubleClick={() => { setEditingId(block.id); setDraft(block.label) }}
              >
                {isEditing ? (
                  <div className="w-full h-full flex items-center justify-center border-2 border-blue-400 rounded bg-blue-50">
                    <input
                      autoFocus
                      className="w-full text-center text-xs bg-transparent outline-none px-2"
                      value={draft}
                      onChange={e => setDraft(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={e => {
                        e.stopPropagation()
                        if (e.key === 'Enter') commitEdit()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  </div>
                ) : (
                  <BlockShapePreview
                    shape={block.shape}
                    label={block.label}
                    width={pos.w}
                    height={pos.h}
                    selected={isSelected}
                  />
                )}
              </div>
            )
          })}
        </div>

        {/* 列数控制 */}
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
          <span>列数:</span>
          <button
            onClick={() => onUpdate({ ...data, columns: Math.max(1, data.columns - 1) })}
            className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
          >-</button>
          <span className="font-mono w-4 text-center">{data.columns}</span>
          <button
            onClick={() => onUpdate({ ...data, columns: Math.min(12, data.columns + 1) })}
            className="w-6 h-6 rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
          >+</button>
          <span className="ml-2 text-gray-400">共 {data.blocks.filter(b => !b.isSpace).length} 个块</span>
        </div>
      </div>

      {/* 右侧属性面板 */}
      <div className="w-64 border-l bg-gray-50 overflow-y-auto p-3 flex flex-col gap-3">
        {/* 添加块 */}
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">添加块</div>
          <div className="grid grid-cols-2 gap-1">
            {SHAPE_OPTIONS.slice(0, 6).map(opt => (
              <button
                key={opt.value}
                onClick={() => addBlock(opt.value)}
                className="text-xs px-2 py-1.5 bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <span className="font-mono text-gray-400 mr-1">{opt.preview}</span>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {SHAPE_OPTIONS.slice(6).map(opt => (
              <button
                key={opt.value}
                onClick={() => addBlock(opt.value)}
                className="text-xs px-2 py-1.5 bg-white border border-gray-200 rounded hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <span className="font-mono text-gray-400 mr-1">{opt.preview}</span>
                {opt.label}
              </button>
            ))}
            <button
              onClick={addSpace}
              className="text-xs px-2 py-1.5 bg-white border border-dashed border-gray-300 rounded hover:bg-gray-100 transition-colors text-gray-400"
            >
              空白块
            </button>
          </div>
        </div>

        {/* 选中块属性 */}
        {selectedBlock && !selectedBlock.isSpace && (
          <div className="border-t pt-3 flex flex-col gap-2">
            <div className="text-xs font-semibold text-gray-600">块属性</div>

            <label className="text-xs text-gray-500">
              ID
              <input
                className="w-full mt-0.5 px-2 py-1 border rounded text-xs bg-gray-100"
                value={selectedBlock.id}
                disabled
              />
            </label>

            <label className="text-xs text-gray-500">
              标签
              <input
                className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                value={selectedBlock.label}
                onChange={e => updateBlock(selectedBlock.id, { label: e.target.value })}
                onKeyDown={e => e.stopPropagation()}
              />
            </label>

            <label className="text-xs text-gray-500">
              形状
              <select
                className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                value={selectedBlock.shape}
                onChange={e => updateBlock(selectedBlock.id, { shape: e.target.value as BlockShape })}
              >
                {SHAPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </label>

            <label className="text-xs text-gray-500">
              跨列数
              <input
                type="number"
                className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                value={selectedBlock.colspan ?? 1}
                min={1}
                max={data.columns}
                onChange={e => updateBlock(selectedBlock.id, { colspan: parseInt(e.target.value) || 1 })}
                onKeyDown={e => e.stopPropagation()}
              />
            </label>

            <div className="flex gap-1">
              <button
                onClick={() => moveBlock(selectedBlock.id, 'left')}
                className="flex-1 text-xs px-2 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
              >← 左移</button>
              <button
                onClick={() => moveBlock(selectedBlock.id, 'right')}
                className="flex-1 text-xs px-2 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
              >右移 →</button>
            </div>

            <button
              onClick={() => deleteBlock(selectedBlock.id)}
              className="text-xs px-2 py-1.5 bg-red-50 text-red-500 border border-red-200 rounded hover:bg-red-100 transition-colors"
            >
              删除块
            </button>
          </div>
        )}

        {selectedBlock?.isSpace && (
          <div className="border-t pt-3 flex flex-col gap-2">
            <div className="text-xs font-semibold text-gray-600">空白块</div>
            <label className="text-xs text-gray-500">
              跨列数
              <input
                type="number"
                className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                value={selectedBlock.colspan ?? 1}
                min={1}
                max={data.columns}
                onChange={e => updateBlock(selectedBlock.id, { colspan: parseInt(e.target.value) || 1 })}
                onKeyDown={e => e.stopPropagation()}
              />
            </label>
            <button
              onClick={() => deleteBlock(selectedBlock.id)}
              className="text-xs px-2 py-1.5 bg-red-50 text-red-500 border border-red-200 rounded hover:bg-red-100 transition-colors"
            >
              删除空白块
            </button>
          </div>
        )}

        {!selectedBlock && (
          <div className="text-xs text-gray-400 text-center py-4">
            点击块查看属性<br />双击块编辑标签
          </div>
        )}
      </div>
    </div>
  )
}
