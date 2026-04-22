'use client'

import { useState, useCallback, useRef, useEffect } from 'react'


import type { KanbanData, KanbanColumn, KanbanItem } from '@/lib/kanbanParser'

interface KanbanEditorProps {
  data: KanbanData
  onUpdate: (data: KanbanData) => void
}

const COLUMN_COLORS = [
  '#e0f2fe', '#fef3c7', '#d1fae5', '#ede9fe', '#fee2e2', '#f3e8ff', '#ccfbf1', '#fce7f3',
]
const PRIORITY_COLORS: Record<string, string> = {
  'Very High': '#ef4444', 'High': '#f97316', 'Medium': '#eab308', 'Low': '#22c55e', 'Very Low': '#94a3b8',
}

let _colCounter = 100
let _itemCounter = 100

export function KanbanEditor({ data, onUpdate }: KanbanEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)

  // 画布平移/缩放
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const canvasRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 })

  const [rightW, setRightW] = useState(240)
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

  // 拖拽状态：列排序 + 卡片排序
  const dragCol = useRef<string | null>(null)
  const dragItem = useRef<{ itemId: string; colId: string } | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null)

  // 滚轮缩放
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setTransform(t => ({ ...t, scale: Math.min(2, Math.max(0.3, t.scale * delta)) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 中键/空格拖拽平移
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y }
    }
  }, [transform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    setTransform(t => ({
      ...t,
      x: panStart.current.tx + e.clientX - panStart.current.x,
      y: panStart.current.ty + e.clientY - panStart.current.y,
    }))
  }, [])

  const handleMouseUp = useCallback(() => { isPanning.current = false }, [])

  // ─── Column actions ───
  const addColumn = useCallback(() => {
    onUpdate({ columns: [...data.columns, { id: `col-${++_colCounter}`, label: '新列', items: [] }] })
  }, [data, onUpdate])

  const removeColumn = useCallback((colId: string) => {
    onUpdate({ columns: data.columns.filter(c => c.id !== colId) })
  }, [data, onUpdate])

  // ─── Item actions ───
  const addItem = useCallback((colId: string) => {
    const newItem: KanbanItem = { id: `item-${++_itemCounter}`, label: '新任务' }
    onUpdate({ columns: data.columns.map(c => c.id === colId ? { ...c, items: [...c.items, newItem] } : c) })
    setSelectedItemId(newItem.id)
  }, [data, onUpdate])

  const removeItem = useCallback((colId: string, itemId: string) => {
    onUpdate({ columns: data.columns.map(c => c.id === colId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c) })
    if (selectedItemId === itemId) setSelectedItemId(null)
  }, [data, onUpdate, selectedItemId])

  const updateItem = useCallback((colId: string, itemId: string, patch: Partial<KanbanItem>) => {
    onUpdate({ columns: data.columns.map(c => c.id === colId ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, ...patch } : i) } : c) })
  }, [data, onUpdate])

  const commitEdit = useCallback((type: 'column' | 'item', colId: string, itemId?: string) => {
    const trimmed = draft.trim()
    if (trimmed) {
      if (type === 'column') {
        onUpdate({ columns: data.columns.map(c => c.id === colId ? { ...c, label: trimmed } : c) })
      } else if (itemId) {
        updateItem(colId, itemId, { label: trimmed })
      }
    }
    setEditingId(null)
  }, [draft, data, onUpdate, updateItem])

  // ─── 列拖拽排序 ───
  const handleColDragStart = useCallback((e: React.DragEvent, colId: string) => {
    dragCol.current = colId
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleColDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault()
    if (dragCol.current && dragCol.current !== colId) {
      setDragOverColId(colId)
    } else if (!dragCol.current) {
      setDragOverColId(colId)
    }
  }, [])

  const handleColDrop = useCallback((e: React.DragEvent, toColId: string) => {
    e.preventDefault()
    setDragOverColId(null)
    if (!dragCol.current || dragCol.current === toColId) { dragCol.current = null; return }
    const cols = [...data.columns]
    const fromIdx = cols.findIndex(c => c.id === dragCol.current)
    const toIdx = cols.findIndex(c => c.id === toColId)
    if (fromIdx < 0 || toIdx < 0) { dragCol.current = null; return }
    const [moved] = cols.splice(fromIdx, 1)
    cols.splice(toIdx, 0, moved)
    onUpdate({ columns: cols })
    dragCol.current = null
  }, [data, onUpdate])

  // ─── 卡片拖拽排序（列内上下 + 跨列） ───
  const handleItemDragStart = useCallback((e: React.DragEvent, itemId: string, colId: string) => {
    e.stopPropagation()
    dragItem.current = { itemId, colId }
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleItemDragOver = useCallback((e: React.DragEvent, itemId: string, colId: string) => {
    e.preventDefault()
    e.stopPropagation()
    dragCol.current = null // 卡片拖拽时不触发列排序
    setDragOverItemId(itemId)
    setDragOverColId(colId)
  }, [])

  const handleItemDrop = useCallback((e: React.DragEvent, toItemId: string, toColId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverItemId(null)
    setDragOverColId(null)
    if (!dragItem.current) return
    const { itemId, colId: fromColId } = dragItem.current
    if (itemId === toItemId) { dragItem.current = null; return }

    const cols = data.columns.map(c => ({ ...c, items: [...c.items] }))
    const fromCol = cols.find(c => c.id === fromColId)!
    const toCol = cols.find(c => c.id === toColId)!
    const item = fromCol.items.find(i => i.id === itemId)!
    fromCol.items = fromCol.items.filter(i => i.id !== itemId)
    const toIdx = toCol.items.findIndex(i => i.id === toItemId)
    toCol.items.splice(toIdx, 0, item)
    onUpdate({ columns: cols })
    dragItem.current = null
  }, [data, onUpdate])

  const handleColDropEmpty = useCallback((e: React.DragEvent, toColId: string) => {
    e.preventDefault()
    setDragOverColId(null)
    setDragOverItemId(null)
    if (!dragItem.current) { handleColDrop(e, toColId); return }
    const { itemId, colId: fromColId } = dragItem.current
    if (fromColId === toColId) { dragItem.current = null; return }
    const fromCol = data.columns.find(c => c.id === fromColId)!
    const item = fromCol.items.find(i => i.id === itemId)!
    onUpdate({
      columns: data.columns.map(c => {
        if (c.id === fromColId) return { ...c, items: c.items.filter(i => i.id !== itemId) }
        if (c.id === toColId) return { ...c, items: [...c.items, item] }
        return c
      }),
    })
    dragItem.current = null
  }, [data, onUpdate, handleColDrop])

  const findItemColumn = (itemId: string) => {
    for (const col of data.columns) {
      const item = col.items.find(i => i.id === itemId)
      if (item) return { col, item }
    }
    return null
  }
  const selectedInfo = selectedItemId ? findItemColumn(selectedItemId) : null

  return (
    <div className="flex h-full overflow-hidden">
      {/* 画布区 */}
      <div
        ref={canvasRef}
        className="flex-1 overflow-hidden relative"
        style={{ cursor: isPanning.current ? 'grabbing' : 'default', background: '#f1f5f9' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={() => setSelectedItemId(null)}
      >
        <div
          style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: '0 0', display: 'flex', gap: 16, padding: 24, alignItems: 'flex-start', width: 'max-content' }}
        >
          {data.columns.map((col, colIdx) => (
            <div
              key={col.id}
              draggable
              onDragStart={e => handleColDragStart(e, col.id)}
              onDragOver={e => handleColDragOver(e, col.id)}
              onDrop={e => handleColDropEmpty(e, col.id)}
              onDragEnd={() => { dragCol.current = null; setDragOverColId(null) }}
              className={`flex-shrink-0 w-64 rounded-xl border-2 transition-colors ${dragOverColId === col.id && !dragItem.current ? 'border-blue-400' : 'border-transparent'}`}
              style={{ backgroundColor: COLUMN_COLORS[colIdx % COLUMN_COLORS.length] }}
              onClick={e => e.stopPropagation()}
            >
              {/* 列头 */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-black/10 cursor-grab active:cursor-grabbing">
                {editingId === col.id ? (
                  <input autoFocus className="flex-1 text-sm font-bold bg-transparent outline-none border-b-2 border-blue-400"
                    value={draft} onChange={e => setDraft(e.target.value)}
                    onBlur={() => commitEdit('column', col.id)}
                    onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') commitEdit('column', col.id); if (e.key === 'Escape') setEditingId(null) }} />
                ) : (
                  <span className="text-sm font-bold text-gray-700 cursor-pointer select-none" onDoubleClick={() => { setEditingId(col.id); setDraft(col.label) }}>
                    {col.label}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs text-gray-400 bg-white/60 rounded-full px-1.5 py-0.5">{col.items.length}</span>
                  <button onClick={e => { e.stopPropagation(); removeColumn(col.id) }} className="text-gray-400 hover:text-red-500 text-sm">×</button>
                </div>
              </div>

              {/* 卡片列表 */}
              <div className="p-2 flex flex-col gap-2 min-h-[60px]">
                {col.items.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={e => handleItemDragStart(e, item.id, col.id)}
                    onDragOver={e => handleItemDragOver(e, item.id, col.id)}
                    onDrop={e => handleItemDrop(e, item.id, col.id)}
                    onDragEnd={() => { dragItem.current = null; setDragOverItemId(null); setDragOverColId(null) }}
                    className={`bg-white rounded-lg shadow-sm border p-2.5 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                      selectedItemId === item.id ? 'ring-2 ring-blue-400 border-blue-300' : dragOverItemId === item.id ? 'border-blue-300 border-dashed' : 'border-gray-200'
                    }`}
                    onClick={e => { e.stopPropagation(); setSelectedItemId(item.id) }}
                    onDoubleClick={() => { setEditingId(item.id); setDraft(item.label) }}
                  >
                    {editingId === item.id ? (
                      <textarea autoFocus className="w-full text-xs bg-transparent outline-none resize-none border-b border-blue-300" rows={2}
                        value={draft} onChange={e => setDraft(e.target.value)}
                        onBlur={() => commitEdit('item', col.id, item.id)}
                        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit('item', col.id, item.id) }; if (e.key === 'Escape') setEditingId(null) }} />
                    ) : (
                      <div className="text-xs text-gray-700 leading-relaxed">{item.label}</div>
                    )}
                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.metadata.priority && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: PRIORITY_COLORS[item.metadata.priority] || '#94a3b8' }}>
                            {item.metadata.priority}
                          </span>
                        )}
                        {item.metadata.assigned && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">@{item.metadata.assigned}</span>}
                        {item.metadata.ticket && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">{item.metadata.ticket}</span>}
                      </div>
                    )}
                  </div>
                ))}
                <button onClick={e => { e.stopPropagation(); addItem(col.id) }} className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded transition-colors">
                  + 添加卡片
                </button>
              </div>
            </div>
          ))}

          <button onClick={addColumn} className="flex-shrink-0 w-64 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors">
            + 添加列
          </button>
        </div>

        {/* 缩放提示 */}
        <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white/80 px-2 py-1 rounded select-none">
          {Math.round(transform.scale * 100)}% · 滚轮缩放 · 中键拖拽
        </div>
      </div>

      {/* 右侧属性面板（常驻） */}
      <div
        style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0 }}
        className="hover:bg-blue-300 transition-colors"
        onMouseDown={e => { dividerDrag.current = { startX: e.clientX, startW: rightW } }}
      />
      <div className="border-l bg-gray-50 overflow-y-auto p-3 flex flex-col gap-3 flex-shrink-0" style={{ width: rightW }}>
        {selectedInfo ? (
          <>
            <div className="text-xs font-semibold text-gray-600">卡片属性</div>
            <label className="text-xs text-gray-500">标签
              <textarea className="w-full mt-0.5 px-2 py-1 border rounded text-xs resize-none" rows={3}
                value={selectedInfo.item.label}
                onChange={e => updateItem(selectedInfo.col.id, selectedInfo.item.id, { label: e.target.value })}
                onKeyDown={e => e.stopPropagation()} />
            </label>
            <label className="text-xs text-gray-500">负责人
              <input className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                value={selectedInfo.item.metadata?.assigned || ''}
                onChange={e => {
                  const meta: Record<string, string> = { ...selectedInfo.item.metadata }
                  if (e.target.value) meta.assigned = e.target.value; else delete meta.assigned
                  updateItem(selectedInfo.col.id, selectedInfo.item.id, { metadata: Object.keys(meta).length ? meta : undefined })
                }}
                onKeyDown={e => e.stopPropagation()} placeholder="如: knsv" />
            </label>
            <label className="text-xs text-gray-500">优先级
              <select className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                value={selectedInfo.item.metadata?.priority || ''}
                onChange={e => {
                  const meta: Record<string, string> = { ...selectedInfo.item.metadata }
                  if (e.target.value) meta.priority = e.target.value; else delete meta.priority
                  updateItem(selectedInfo.col.id, selectedInfo.item.id, { metadata: Object.keys(meta).length ? meta : undefined })
                }}>
                <option value="">无</option>
                {['Very High','High','Medium','Low','Very Low'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-500">工单号
              <input className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                value={selectedInfo.item.metadata?.ticket || ''}
                onChange={e => {
                  const meta: Record<string, string> = { ...selectedInfo.item.metadata }
                  if (e.target.value) meta.ticket = e.target.value; else delete meta.ticket
                  updateItem(selectedInfo.col.id, selectedInfo.item.id, { metadata: Object.keys(meta).length ? meta : undefined })
                }}
                onKeyDown={e => e.stopPropagation()} placeholder="如: MC-2038" />
            </label>
            <label className="text-xs text-gray-500">所在列
              <select className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                value={selectedInfo.col.id}
                onChange={e => {
                  const toColId = e.target.value
                  if (toColId === selectedInfo.col.id) return
                  const item = selectedInfo.item
                  onUpdate({ columns: data.columns.map(c => {
                    if (c.id === selectedInfo.col.id) return { ...c, items: c.items.filter(i => i.id !== item.id) }
                    if (c.id === toColId) return { ...c, items: [...c.items, item] }
                    return c
                  })})
                }}>
                {data.columns.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </label>
            <button onClick={() => removeItem(selectedInfo.col.id, selectedInfo.item.id)}
              className="text-xs px-2 py-1 bg-red-50 text-red-500 border border-red-200 rounded hover:bg-red-100">
              删除卡片
            </button>
          </>
        ) : (
          <div className="text-xs text-gray-400 text-center py-8">
            点击卡片查看属性<br />双击卡片编辑标签<br /><br />
            <span className="text-gray-300">拖拽列头排序列<br />拖拽卡片排序/移列</span>
          </div>
        )}
      </div>
    </div>
  )
}
