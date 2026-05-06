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
    moveMessageOrder,
    pendingActivation, setPendingActivation, addActivation,
  } = useSeqEditorStore()

  const isSelected = selectedMessageId === message.id
  const isEditing = editingMessageId === message.id
  const [draft, setDraft] = useState('')
  const [isDragging, setIsDragging] = useState(false)

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
    if (connecting) return
    // 激活条选择模式
    if (pendingActivation) {
      if (!pendingActivation.startMsgId) {
        // 根据鼠标 X 坐标选最近的参与者
        const svg = (e.target as SVGElement).closest('svg')
        let clickedParticipantId = message.to
        if (svg) {
          const rect = svg.getBoundingClientRect()
          const clickX = e.clientX - rect.left
          const distFrom = Math.abs(clickX - x1)
          const distTo = Math.abs(clickX - x2)
          clickedParticipantId = distFrom < distTo ? message.from : message.to
        }
        setPendingActivation({ startMsgId: message.id, participantId: clickedParticipantId })
      } else {
        addActivation({
          id: `act-${Date.now()}`,
          participantId: pendingActivation.participantId ?? message.to,
          startMsgId: pendingActivation.startMsgId!,
          endMsgId: message.id,
        })
        setPendingActivation(null)
      }
      return
    }
    selectMessage(message.id)
  }, [message, selectMessage, connecting, pendingActivation, setPendingActivation, addActivation, x1, x2])

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
      const closestP = participants.reduce((closest, p) => {
        const dist = Math.abs(p.x - ((e.nativeEvent as any).offsetX || x1))
        const closestDist = Math.abs(closest.x - ((e.nativeEvent as any).offsetX || x1))
        return dist < closestDist ? p : closest
      })
      endConnection(closestP.id)
    }
  }, [connecting, participants, endConnection, x1])

  // ─── 拖拽排序 ───
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/seq-message-order', String(message.order))
    e.dataTransfer.setData('application/seq-message-id', message.id)
    setIsDragging(true)
  }, [message.id, message.order])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/seq-message-id')) {
      e.preventDefault()
      e.stopPropagation()
      e.dataTransfer.dropEffect = 'move'
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const draggedId = e.dataTransfer.getData('application/seq-message-id')
    if (!draggedId || draggedId === message.id) return
    moveMessageOrder(draggedId, message.order)
  }, [message.id, message.order, moveMessageOrder])

  const isActStart = pendingActivation?.startMsgId === message.id
  const isActPending = !!pendingActivation && !pendingActivation.startMsgId
  const strokeColor = isActStart ? '#f59e0b' : isSelected ? '#3b82f6' : isDragging ? '#a78bfa' : '#6b7280'
  const strokeW = isActStart || isSelected ? 2 : 1.5
  const dashArray = message.style === 'dashed' ? '6 3' : undefined

  return (
    <g
      draggable
      style={{ cursor: pendingActivation ? 'crosshair' : isDragging ? 'grabbing' : 'grab', pointerEvents: 'auto' }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      onMouseUp={handleMouseUp}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 点击热区 */}
      {isSelf ? (
        <path
          d={`M${x1},${y} L${x1 + 40},${y} Q${x1 + 50},${y} ${x1 + 50},${y + 10} L${x1 + 50},${y + 30} Q${x1 + 50},${y + 40} ${x1 + 40},${y + 40} L${x1},${y + 40}`}
          fill="none" stroke="transparent" strokeWidth={16}
        />
      ) : (
        <line x1={x1} y1={y} x2={x2} y2={y} stroke="transparent" strokeWidth={16} />
      )}

      {/* 消息线 */}
      {isSelf ? (
        <path
          d={`M${x1},${y} L${x1 + 40},${y} Q${x1 + 50},${y} ${x1 + 50},${y + 10} L${x1 + 50},${y + 30} Q${x1 + 50},${y + 40} ${x1 + 40},${y + 40} L${x1},${y + 40}`}
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

      {/* 箭头：filled=->> 实心，none=-) 开放空心，open=-> 无箭头 */}
      {message.arrow !== 'open' && (
        isSelf ? (
          <polygon
            points={`${x1},${y + 40} ${x1 - 5},${y + 35} ${x1 + 5},${y + 35}`}
            fill={message.arrow === 'filled' ? strokeColor : 'none'}
            stroke={strokeColor} strokeWidth={1}
          />
        ) : (
          <polygon
            points={
              message.arrow === 'filled'
                ? `${x2},${y} ${x2 - dir * 10},${y - 5} ${x2 - dir * 10},${y + 5}`
                : `${x2},${y} ${x2 - dir * 10},${y - 5} ${x2 - dir * 7},${y} ${x2 - dir * 10},${y + 5}`
            }
            fill={message.arrow === 'filled' ? strokeColor : 'none'}
            stroke={strokeColor} strokeWidth={1}
          />
        )
      )}

      {/* 标签 */}
      {isEditing ? (
        <foreignObject
          x={isSelf ? x1 + 55 : Math.min(x1, x2) + Math.abs(x2 - x1) / 2 - 60}
          y={isSelf ? y + 10 : y - 24}
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
          y={isSelf ? y + 20 : y - 8}
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
