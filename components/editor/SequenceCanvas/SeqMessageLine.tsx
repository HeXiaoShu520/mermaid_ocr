'use client'

import { useCallback, useState } from 'react'
import { useSeqEditorStore, type SeqMessage, SEQ_HEAD_H, SEQ_ROW_H } from '@/lib/seqEditorStore'

interface Props {
  message: SeqMessage
  participants: { id: string; x: number }[]
}

export default function SeqMessageLine({ message, participants }: Props) {
  const {
    selectedMessageId, selectMessage,
    editingMessageId, setEditingMessage,
    updateMessage, setContextMenu,
    connecting, endConnection,
  } = useSeqEditorStore()

  const isSelected = selectedMessageId === message.id
  const isEditing = editingMessageId === message.id
  const [draft, setDraft] = useState('')

  const fromP = participants.find(p => p.id === message.from)
  const toP = participants.find(p => p.id === message.to)
  if (!fromP || !toP) return null

  const x1 = fromP.x
  const x2 = toP.x
  const y = SEQ_HEAD_H + message.order * SEQ_ROW_H + SEQ_ROW_H / 2
  const isSelf = message.from === message.to
  const dir = x2 > x1 ? 1 : x2 < x1 ? -1 : 1

  // ─── 点击选中 ───
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // 如果正在连线，完成连线到这个消息的目标参与者
    if (connecting) return
    selectMessage(message.id)
  }, [message.id, selectMessage, connecting])

  // ─── 双击编辑 ───
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setDraft(message.label)
    setEditingMessage(message.id)
  }, [message.id, message.label, setEditingMessage])

  const handleSave = useCallback(() => {
    if (draft.trim()) {
      updateMessage(message.id, { label: draft.trim() })
    }
    setEditingMessage(null)
  }, [draft, message.id, updateMessage, setEditingMessage])

  // ─── 右键 ───
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, messageId: message.id })
  }, [message.id, setContextMenu])

  // ─── 连线目标检测 ───
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (connecting) {
      e.stopPropagation()
      // 找到最近的参与者
      const closestP = participants.reduce((closest, p) => {
        const dist = Math.abs(p.x - ((e.nativeEvent as any).offsetX || x1))
        const closestDist = Math.abs(closest.x - ((e.nativeEvent as any).offsetX || x1))
        return dist < closestDist ? p : closest
      })
      endConnection(closestP.id)
    }
  }, [connecting, participants, endConnection, x1])

  const strokeColor = isSelected ? '#3b82f6' : '#6b7280'
  const strokeW = isSelected ? 2 : 1.5
  const dashArray = message.style === 'dashed' ? '6 3' : undefined

  return (
    <g
      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseUp={handleMouseUp}
    >
      {/* 点击热区 */}
      {isSelf ? (
        <path
          d={`M${x1},${y} C${x1 + 50},${y - 20} ${x1 + 50},${y + 20} ${x1},${y + 20}`}
          fill="none" stroke="transparent" strokeWidth={16}
        />
      ) : (
        <line x1={x1} y1={y} x2={x2} y2={y} stroke="transparent" strokeWidth={16} />
      )}

      {/* 消息线 */}
      {isSelf ? (
        <path
          d={`M${x1},${y} C${x1 + 50},${y - 20} ${x1 + 50},${y + 20} ${x1},${y + 20}`}
          fill="none" stroke={strokeColor} strokeWidth={strokeW}
          strokeDasharray={dashArray}
        />
      ) : (
        <line
          x1={x1} y1={y} x2={x2 - dir * 8} y2={y}
          stroke={strokeColor} strokeWidth={strokeW}
          strokeDasharray={dashArray}
        />
      )}

      {/* 箭头 */}
      {message.arrow !== 'none' && !isSelf && (
        <polygon
          points={
            message.arrow === 'filled'
              ? `${x2},${y} ${x2 - dir * 10},${y - 5} ${x2 - dir * 10},${y + 5}`
              : `${x2},${y} ${x2 - dir * 10},${y - 5} ${x2 - dir * 7},${y} ${x2 - dir * 10},${y + 5}`
          }
          fill={message.arrow === 'filled' ? strokeColor : 'none'}
          stroke={strokeColor} strokeWidth={1}
        />
      )}

      {/* 标签 */}
      {isEditing ? (
        <foreignObject
          x={isSelf ? x1 + 20 : Math.min(x1, x2) + Math.abs(x2 - x1) / 2 - 60}
          y={y - 24}
          width={120} height={22}
        >
          <input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditingMessage(null) }}
            style={{
              width: '100%', textAlign: 'center', fontSize: 11,
              border: '1px solid #93c5fd', borderRadius: 3,
              outline: 'none', background: 'white', padding: '1px 4px',
            }}
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        </foreignObject>
      ) : (
        <text
          x={isSelf ? x1 + 55 : (x1 + x2) / 2}
          y={y - 8}
          textAnchor="middle" fontSize={11}
          fill={isSelected ? '#2563eb' : '#374151'}
          style={{ pointerEvents: 'none' }}
        >
          {message.label}
        </text>
      )}
    </g>
  )
}
