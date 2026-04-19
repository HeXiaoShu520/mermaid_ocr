'use client'

import { useCallback, useRef, useState } from 'react'
import { useSeqEditorStore, type SeqParticipant as SeqP } from '@/lib/seqEditorStore'

interface Props {
  participant: SeqP
  lifelineHeight: number
  viewScale: number
}

export default function SeqParticipantNode({ participant, lifelineHeight, viewScale }: Props) {
  const {
    selectedParticipantId, selectParticipant,
    moveParticipant, reorderParticipants,
    setEditingParticipant, editingParticipantId,
    updateParticipant, setContextMenu,
    connecting, startConnection,
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
    // 计算点击位置的 y 坐标（画布坐标）
    const svg = (e.target as SVGElement).closest('svg')
    if (svg) {
      const rect = svg.getBoundingClientRect()
      const y = (e.clientY - rect.top) / viewScale
      startConnection(participant.id, y)
    } else {
      startConnection(participant.id)
    }
  }, [participant.id, viewScale, startConnection])

  const x = participant.x
  const boxLeft = x - BOX_W / 2
  const boxTop = 12

  return (
    <>
      {/* 生命线 */}
      <line
        x1={x} y1={boxTop + BOX_H}
        x2={x} y2={lifelineHeight}
        stroke="#c7d2fe" strokeWidth={1.5} strokeDasharray="6 4"
        style={{ pointerEvents: 'none' }}
      />

      {/* 生命线可交互区域（用于发起连线） */}
      <line
        x1={x} y1={boxTop + BOX_H + 10}
        x2={x} y2={lifelineHeight}
        stroke="transparent" strokeWidth={20}
        style={{ cursor: connecting ? 'crosshair' : 'pointer', pointerEvents: 'auto' }}
        onMouseDown={handleLifelineMouseDown}
      />

      {/* 顶部参与者框 */}
      <g style={{ pointerEvents: 'auto' }}>
        <rect
          x={boxLeft} y={boxTop}
          width={BOX_W} height={BOX_H}
          rx={6}
          fill={isSelected ? '#e0e7ff' : '#f0f4ff'}
          stroke={isSelected ? '#6366f1' : '#a5b4fc'}
          strokeWidth={isSelected ? 2 : 1.5}
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
        />
        {participant.type === 'actor' && (
          <text x={boxLeft + 8} y={boxTop + BOX_H / 2 + 1} fontSize={14} fill="#6366f1" dominantBaseline="middle">👤</text>
        )}
        {isEditing ? (
          <foreignObject x={boxLeft + 4} y={boxTop + 4} width={BOX_W - 8} height={BOX_H - 8}>
            <input
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={handleSave}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditingParticipant(null) }}
              style={{
                width: '100%', height: '100%', textAlign: 'center',
                fontSize: 12, border: 'none', outline: 'none',
                background: 'transparent', fontFamily: 'inherit',
              }}
              autoFocus
            />
          </foreignObject>
        ) : (
          <text
            x={x} y={boxTop + BOX_H / 2}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={12} fill="#3730a3" fontWeight={500}
            style={{ pointerEvents: 'none' }}
          >
            {participant.label}
          </text>
        )}
      </g>

      {/* ID 标签（顶部框下方） */}
      <text
        x={x} y={boxTop + BOX_H + 14}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fill="#9ca3af" fontFamily="monospace"
        style={{ pointerEvents: 'none' }}
      >
        {participant.id}
      </text>

      {/* 底部参与者框 */}
      <g style={{ pointerEvents: 'none' }}>
        <rect
          x={boxLeft} y={lifelineHeight}
          width={BOX_W} height={BOX_H}
          rx={6}
          fill="#f0f4ff" stroke="#a5b4fc" strokeWidth={1.5}
        />
        <text
          x={x} y={lifelineHeight + BOX_H / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={12} fill="#3730a3"
        >
          {participant.label}
        </text>
      </g>
    </>
  )
}
