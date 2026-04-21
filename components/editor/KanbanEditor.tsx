'use client'

import { useState, useCallback, useRef } from 'react'
import type { KanbanData, KanbanColumn, KanbanItem } from '@/lib/kanbanParser'

interface KanbanEditorProps {
  data: KanbanData
  onUpdate: (data: KanbanData) => void
}

const COLUMN_COLORS = [
  '#e0f2fe', '#fef3c7', '#d1fae5', '#ede9fe', '#fee2e2', '#f3e8ff', '#ccfbf1', '#fce7f3',
]

const PRIORITY_COLORS: Record<string, string> = {
  'Very High': '#ef4444',
  'High': '#f97316',
  'Medium': '#eab308',
  'Low': '#22c55e',
  'Very Low': '#94a3b8',
}

let _colCounter = 100
let _itemCounter = 100

export function KanbanEditor({ data, onUpdate }: KanbanEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [dragItem, setDragItem] = useState<{ itemId: string; fromColId: string } | null>(null)
  const [dragOverColId, setDragOverColId] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // ─── Column actions ───
  const addColumn = useCallback(() => {
    const newCol: KanbanColumn = {
      id: `col-${++_colCounter}`,
      label: '新列',
      items: [],
    }
    onUpdate({ columns: [...data.columns, newCol] })
  }, [data, onUpdate])

  const removeColumn = useCallback((colId: string) => {
    onUpdate({ columns: data.columns.filter(c => c.id !== colId) })
  }, [data, onUpdate])

  const updateColumnLabel = useCallback((colId: string, label: string) => {
    onUpdate({
      columns: data.columns.map(c => c.id === colId ? { ...c, label } : c),
    })
  }, [data, onUpdate])

  // ─── Item actions ───
  const addItem = useCallback((colId: string) => {
    const newItem: KanbanItem = {
      id: `item-${++_itemCounter}`,
      label: '新任务',
    }
    onUpdate({
      columns: data.columns.map(c =>
        c.id === colId ? { ...c, items: [...c.items, newItem] } : c
      ),
    })
  }, [data, onUpdate])

  const removeItem = useCallback((colId: string, itemId: string) => {
    onUpdate({
      columns: data.columns.map(c =>
        c.id === colId ? { ...c, items: c.items.filter(i => i.id !== itemId) } : c
      ),
    })
    if (selectedItemId === itemId) setSelectedItemId(null)
  }, [data, onUpdate, selectedItemId])

  const updateItem = useCallback((colId: string, itemId: string, patch: Partial<KanbanItem>) => {
    onUpdate({
      columns: data.columns.map(c =>
        c.id === colId
          ? { ...c, items: c.items.map(i => i.id === itemId ? { ...i, ...patch } : i) }
          : c
      ),
    })
  }, [data, onUpdate])

  // ─── Drag & Drop ───
  const handleDragStart = useCallback((itemId: string, fromColId: string) => {
    setDragItem({ itemId, fromColId })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, colId: string) => {
    e.preventDefault()
    setDragOverColId(colId)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, toColId: string) => {
    e.preventDefault()
    setDragOverColId(null)
    if (!dragItem) return
    if (dragItem.fromColId === toColId) return

    const fromCol = data.columns.find(c => c.id === dragItem.fromColId)
    const item = fromCol?.items.find(i => i.id === dragItem.itemId)
    if (!item) return

    onUpdate({
      columns: data.columns.map(c => {
        if (c.id === dragItem.fromColId) {
          return { ...c, items: c.items.filter(i => i.id !== dragItem.itemId) }
        }
        if (c.id === toColId) {
          return { ...c, items: [...c.items, item] }
        }
        return c
      }),
    })
    setDragItem(null)
  }, [dragItem, data, onUpdate])

  // ─── Inline editing ───
  const startEdit = useCallback((id: string, currentLabel: string) => {
    setEditingId(id)
    setDraft(currentLabel)
  }, [])

  const commitEdit = useCallback((type: 'column' | 'item', colId: string, itemId?: string) => {
    const trimmed = draft.trim()
    if (!trimmed) { setEditingId(null); return }
    if (type === 'column') {
      updateColumnLabel(colId, trimmed)
    } else if (itemId) {
      updateItem(colId, itemId, { label: trimmed })
    }
    setEditingId(null)
  }, [draft, updateColumnLabel, updateItem])

  // 找到选中 item 所在的列
  const findItemColumn = (itemId: string) => {
    for (const col of data.columns) {
      const item = col.items.find(i => i.id === itemId)
      if (item) return { col, item }
    }
    return null
  }

  const selectedInfo = selectedItemId ? findItemColumn(selectedItemId) : null

  return (
    <div className="flex h-full">
      {/* 看板画布 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-x-auto overflow-y-auto p-4"
        onClick={() => setSelectedItemId(null)}
      >
        <div className="flex gap-4 min-h-full items-start">
          {data.columns.map((col, colIdx) => (
            <div
              key={col.id}
              className={`flex-shrink-0 w-64 rounded-xl border-2 transition-colors ${
                dragOverColId === col.id ? 'border-blue-400 bg-blue-50' : 'border-transparent'
              }`}
              style={{ backgroundColor: COLUMN_COLORS[colIdx % COLUMN_COLORS.length] }}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={() => setDragOverColId(null)}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* 列头 */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-black/10">
                {editingId === col.id ? (
                  <input
                    autoFocus
                    className="flex-1 text-sm font-bold bg-transparent outline-none border-b-2 border-blue-400"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onBlur={() => commitEdit('column', col.id)}
                    onKeyDown={e => {
                      e.stopPropagation()
                      if (e.key === 'Enter') commitEdit('column', col.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                  />
                ) : (
                  <span
                    className="text-sm font-bold text-gray-700 cursor-pointer select-none"
                    onDoubleClick={() => startEdit(col.id, col.label)}
                  >
                    {col.label}
                  </span>
                )}
                <div className="flex items-center gap-1 ml-2">
                  <span className="text-xs text-gray-400 bg-white/60 rounded-full px-1.5 py-0.5">
                    {col.items.length}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeColumn(col.id) }}
                    className="text-gray-400 hover:text-red-500 text-sm transition-colors"
                    title="删除列"
                  >
                    ×
                  </button>
                </div>
              </div>

              {/* 卡片列表 */}
              <div className="p-2 flex flex-col gap-2 min-h-[60px]">
                {col.items.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(item.id, col.id)}
                    onDragEnd={() => { setDragItem(null); setDragOverColId(null) }}
                    className={`bg-white rounded-lg shadow-sm border p-2.5 cursor-grab active:cursor-grabbing transition-all hover:shadow-md ${
                      selectedItemId === item.id ? 'ring-2 ring-blue-400 border-blue-300' : 'border-gray-200'
                    }`}
                    onClick={(e) => { e.stopPropagation(); setSelectedItemId(item.id) }}
                    onDoubleClick={() => startEdit(item.id, item.label)}
                  >
                    {editingId === item.id ? (
                      <textarea
                        autoFocus
                        className="w-full text-xs bg-transparent outline-none resize-none border-b border-blue-300"
                        rows={2}
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        onBlur={() => commitEdit('item', col.id, item.id)}
                        onKeyDown={e => {
                          e.stopPropagation()
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit('item', col.id, item.id) }
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                      />
                    ) : (
                      <div className="text-xs text-gray-700 leading-relaxed">{item.label}</div>
                    )}
                    {/* 元数据标签 */}
                    {item.metadata && Object.keys(item.metadata).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.metadata.priority && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                            style={{ backgroundColor: PRIORITY_COLORS[item.metadata.priority] || '#94a3b8' }}
                          >
                            {item.metadata.priority}
                          </span>
                        )}
                        {item.metadata.assigned && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            @{item.metadata.assigned}
                          </span>
                        )}
                        {item.metadata.ticket && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600">
                            {item.metadata.ticket}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* 添加卡片按钮 */}
                <button
                  onClick={(e) => { e.stopPropagation(); addItem(col.id) }}
                  className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded transition-colors"
                >
                  + 添加卡片
                </button>
              </div>
            </div>
          ))}

          {/* 添加列按钮 */}
          <button
            onClick={addColumn}
            className="flex-shrink-0 w-64 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
          >
            + 添加列
          </button>
        </div>
      </div>

      {/* 右侧属性面板 */}
      {selectedInfo && (
        <div className="w-60 border-l bg-gray-50 overflow-y-auto p-3 flex flex-col gap-3">
          <div className="text-xs font-semibold text-gray-600">卡片属性</div>

          <label className="text-xs text-gray-500">
            ID
            <input
              className="w-full mt-0.5 px-2 py-1 border rounded text-xs bg-gray-100"
              value={selectedInfo.item.id}
              disabled
            />
          </label>

          <label className="text-xs text-gray-500">
            标签
            <textarea
              className="w-full mt-0.5 px-2 py-1 border rounded text-xs resize-none"
              rows={3}
              value={selectedInfo.item.label}
              onChange={e => updateItem(selectedInfo.col.id, selectedInfo.item.id, { label: e.target.value })}
              onKeyDown={e => e.stopPropagation()}
            />
          </label>

          <label className="text-xs text-gray-500">
            负责人
            <input
              className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
              value={selectedInfo.item.metadata?.assigned || ''}
              onChange={e => {
                const meta: Record<string, string> = { ...selectedInfo.item.metadata }
                if (e.target.value) meta.assigned = e.target.value
                else delete (meta as Record<string, string | undefined>).assigned
                updateItem(selectedInfo.col.id, selectedInfo.item.id, { metadata: Object.keys(meta).length ? meta : undefined })
              }}
              onKeyDown={e => e.stopPropagation()}
              placeholder="如: knsv"
            />
          </label>

          <label className="text-xs text-gray-500">
            优先级
            <select
              className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
              value={selectedInfo.item.metadata?.priority || ''}
              onChange={e => {
                const meta: Record<string, string> = { ...selectedInfo.item.metadata }
                if (e.target.value) meta.priority = e.target.value
                else delete (meta as Record<string, string | undefined>).priority
                updateItem(selectedInfo.col.id, selectedInfo.item.id, { metadata: Object.keys(meta).length ? meta : undefined })
              }}
            >
              <option value="">无</option>
              <option value="Very High">Very High</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Very Low">Very Low</option>
            </select>
          </label>

          <label className="text-xs text-gray-500">
            工单号
            <input
              className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
              value={selectedInfo.item.metadata?.ticket || ''}
              onChange={e => {
                const meta: Record<string, string> = { ...selectedInfo.item.metadata }
                if (e.target.value) meta.ticket = e.target.value
                else delete (meta as Record<string, string | undefined>).ticket
                updateItem(selectedInfo.col.id, selectedInfo.item.id, { metadata: Object.keys(meta).length ? meta : undefined })
              }}
              onKeyDown={e => e.stopPropagation()}
              placeholder="如: MC-2038"
            />
          </label>

          <label className="text-xs text-gray-500">
            所在列
            <select
              className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
              value={selectedInfo.col.id}
              onChange={e => {
                const toColId = e.target.value
                if (toColId === selectedInfo.col.id) return
                const item = selectedInfo.item
                onUpdate({
                  columns: data.columns.map(c => {
                    if (c.id === selectedInfo.col.id) return { ...c, items: c.items.filter(i => i.id !== item.id) }
                    if (c.id === toColId) return { ...c, items: [...c.items, item] }
                    return c
                  }),
                })
              }}
            >
              {data.columns.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </label>

          <button
            onClick={() => removeItem(selectedInfo.col.id, selectedInfo.item.id)}
            className="mt-2 text-xs px-2 py-1 bg-red-50 text-red-500 border border-red-200 rounded hover:bg-red-100 transition-colors"
          >
            删除卡片
          </button>
        </div>
      )}
    </div>
  )
}
