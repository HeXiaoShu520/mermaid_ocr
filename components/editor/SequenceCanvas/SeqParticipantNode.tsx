'use client'

import { useCallback, useRef, useState } from 'react'
import { useSeqEditorStore, type SeqParticipant as SeqP, type SeqActivation, SEQ_HEAD_H, SEQ_ROW_H } from '@/lib/seqEditorStore'

interface Props {
  participant: SeqP
  lifelineHeight: number
  viewScale: number
  activations: SeqActivation[]
  messages: { id: string; order: number }[]
}

export default function SeqParticipantNode({ participant, lifelineHeight, viewScale, activations, messages }: Props) {
  // 计算该参与者的激活区间
  const myActivations = activations.filter(a => a.participantId === participant.id)
  const activeBars: { y1: number; y2: number }[] = []
  for (const a of myActivations) {
    const startMsg = messages.find(m => m.id === a.startMsgId)
    const endMsg = messages.find(m => m.id === a.endMsgId)
    if (!startMsg || !endMsg) continue
    const y1 = SEQ_HEAD_H + startMsg.order * SEQ_ROW_H + SEQ_ROW_H / 2 - 4
    const y2 = SEQ_HEAD_H + endMsg.order * SEQ_ROW_H + SEQ_ROW_H / 2 + 4
    activeBars.push({ y1, y2 })
  }
  const {
    selectedParticipantId, selectParticipant,
    moveParticipant, reorderParticipants,
    setEditingParticipant, editingParticipantId,
    updateParticipant, setContextMenu,
    connecting, startConnection,
    pendingActivation, pendingConnect, setPendingConnect,
  } = useSeqEditorStore()

  const isSelected = selectedParticipantId === participant.id
  const isEditing = editingParticipantId === participant.id
  const [isDragging, setIsDragging] = useState(false)
  const [draft, setDraft] = useState('')
  const dragStartRef = useRef({ x: 0, px: 0 })
  const BOX_W = 110
  const BOX_H = 36

  // ─── 拖拽 ───
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || isEditing) return
    e.stopPropagation()
    selectParticipant(participant.id)
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, px: participant.x }

    const handleMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - dragStartRef.current.x) / viewScale
      moveParticipant(participant.id, dragStartRef.current.px + dx)
    }
    const handleUp = () => {
      setIsDragging(false)
      reorderParticipants()
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [participant.id, participant.x, viewScale, isEditing, selectParticipant, moveParticipant, reorderParticipants])

  // ─── 双击编辑 ───
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setDraft(participant.label)
    setEditingParticipant(participant.id)
  }, [participant.id, participant.label, setEditingParticipant])

  const handleSave = useCallback(() => {
    if (draft.trim()) {
      updateParticipant(participant.id, { label: draft.trim() })
    }
    setEditingParticipant(null)
  }, [draft, participant.id, updateParticipant, setEditingParticipant])

  // ─── 右键 ───
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, participantId: participant.id })
  }, [participant.id, setContextMenu])

  // ─── 连线手柄（生命线上的拖拽起点） ───
  const handleLifelineMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    if (!pendingConnect) {
      selectParticipant(participant.id)
      return
    }
    const svg = (e.target as SVGElement).closest('svg')
    if (svg) {
      const rect = svg.getBoundingClientRect()
      const y = (e.clientY - rect.top) / viewScale
      startConnection(participant.id, y)
    } else {
      startConnection(participant.id)
    }
    setPendingConnect(false)
  }, [participant.id, viewScale, startConnection, pendingConnect, selectParticipant, setPendingConnect])

  const x = participant.x
  const boxLeft = x - BOX_W / 2
  const boxTop = 12
  const isActor = participant.type === 'actor'
  const ACTOR_H = 48
  const lifelineStart = isActor ? boxTop + ACTOR_H : boxTop + BOX_H

  return (
    <>
      {/* 生命线 */}
      <line
        x1={x} y1={lifelineStart}
        x2={x} y2={lifelineHeight}
        stroke="#c7d2fe" strokeWidth={1.5} strokeDasharray="6 4"
        style={{ pointerEvents: 'none' }}
      />

      {/* 激活条 */}
      {activeBars.map((bar, i) => (
        <rect
          key={i}
          x={x - 7} y={bar.y1}
          width={14} height={bar.y2 - bar.y1}
          fill="#e0e7ff" stroke="#6366f1" strokeWidth={2}
          style={{ pointerEvents: 'none' }}
        />
      ))}

      {/* 生命线可交互区域（用于发起连线） */}
      <line
        x1={x} y1={boxTop + BOX_H + 10}
        x2={x} y2={lifelineHeight}
        stroke="transparent" strokeWidth={20}
        style={{ cursor: pendingConnect ? 'crosshair' : 'pointer', pointerEvents: pendingActivation ? 'none' : 'auto' }}
        onMouseDown={handleLifelineMouseDown}
      />

      {/* 顶部参与者框 */}
      <g style={{ pointerEvents: 'auto' }}>
        {isActor ? (
          <rect x={boxLeft} y={boxTop} width={BOX_W} height={ACTOR_H}
            fill="transparent" stroke="none"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown} onDoubleClick={handleDoubleClick} onContextMenu={handleContextMenu}
          />
        ) : (
          <rect
            x={boxLeft} y={boxTop} width={BOX_W} height={BOX_H} rx={6}
            fill={isSelected ? '#e0e7ff' : '#f0f4ff'}
            stroke={isSelected ? '#6366f1' : '#a5b4fc'}
            strokeWidth={isSelected ? 2 : 1.5}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleMouseDown} onDoubleClick={handleDoubleClick} onContextMenu={handleContextMenu}
          />
        )}
        {isActor && (
          <>
            <circle cx={x} cy={boxTop + 8} r={7} fill={isSelected ? '#e0e7ff' : '#f0f4ff'} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={isSelected ? 2 : 1.5} style={{ pointerEvents: 'none' }} />
            <line x1={x} y1={boxTop + 15} x2={x} y2={boxTop + 30} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
            <line x1={x - 9} y1={boxTop + 21} x2={x + 9} y2={boxTop + 21} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
            <line x1={x} y1={boxTop + 30} x2={x - 7} y2={boxTop + 42} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
            <line x1={x} y1={boxTop + 30} x2={x + 7} y2={boxTop + 42} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
          </>
        )}
        {isEditing ? (
          <foreignObject x={boxLeft + 4} y={isActor ? boxTop + ACTOR_H : boxTop + 4} width={BOX_W - 8} height={BOX_H - 8}>
            <input value={draft} onChange={e => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditingParticipant(null) }}
              style={{ width: '100%', height: '100%', textAlign: 'center', fontSize: 12, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit' }}
              autoFocus />
          </foreignObject>
        ) : (
          <text x={x} y={isActor ? boxTop + ACTOR_H + 12 : boxTop + BOX_H / 2}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={12} fill="#3730a3" fontWeight={500}
            style={{ pointerEvents: 'none' }}>
            {participant.label}
          </text>
        )}
      </g>

      {/* ID 标签 */}
      <text x={x} y={lifelineStart + 12}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fill="#9ca3af" fontFamily="monospace"
        style={{ pointerEvents: 'none' }}>
        {participant.id}
      </text>

      {/* 底部参与者框 */}
      <g style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        onMouseDown={e => { e.stopPropagation(); selectParticipant(participant.id) }}>
        {isActor ? (
          <>
            <rect x={boxLeft} y={lifelineHeight} width={BOX_W} height={ACTOR_H} fill="transparent" stroke="none" />
            <circle cx={x} cy={lifelineHeight + 8} r={7} fill={isSelected ? '#e0e7ff' : '#f0f4ff'} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={isSelected ? 2 : 1.5} style={{ pointerEvents: 'none' }} />
            <line x1={x} y1={lifelineHeight + 15} x2={x} y2={lifelineHeight + 30} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
            <line x1={x - 9} y1={lifelineHeight + 21} x2={x + 9} y2={lifelineHeight + 21} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
            <line x1={x} y1={lifelineHeight + 30} x2={x - 7} y2={lifelineHeight + 42} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
            <line x1={x} y1={lifelineHeight + 30} x2={x + 7} y2={lifelineHeight + 42} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
            <text x={x} y={lifelineHeight + ACTOR_H + 12} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#3730a3" style={{ pointerEvents: 'none' }}>{participant.label}</text>
          </>
        ) : (
          <>
            <rect x={boxLeft} y={lifelineHeight} width={BOX_W} height={BOX_H} rx={6}
              fill={isSelected ? '#e0e7ff' : '#f0f4ff'} stroke={isSelected ? '#6366f1' : '#a5b4fc'} strokeWidth={isSelected ? 2 : 1.5} />
            <text x={x} y={lifelineHeight + BOX_H / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="#3730a3" style={{ pointerEvents: 'none' }}>{participant.label}</text>
          </>
        )}
      </g>
    </>
  )
}
