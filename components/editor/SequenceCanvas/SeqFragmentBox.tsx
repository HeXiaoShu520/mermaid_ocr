'use client'

import { useCallback, useRef, useState } from 'react'
import { useSeqEditorStore, type SeqFragment, SEQ_HEAD_H, SEQ_ROW_H, SEQ_PAD_X } from '@/lib/seqEditorStore'

interface Props {
  fragment: SeqFragment
  participants: { id: string; x: number }[]
}

const FRAG_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  loop: { bg: 'rgba(59,130,246,0.06)', border: '#93c5fd', label: '#2563eb' },
  alt: { bg: 'rgba(245,158,11,0.06)', border: '#fcd34d', label: '#d97706' },
  opt: { bg: 'rgba(16,185,129,0.06)', border: '#6ee7b7', label: '#059669' },
  par: { bg: 'rgba(139,92,246,0.06)', border: '#c4b5fd', label: '#7c3aed' },
  critical: { bg: 'rgba(239,68,68,0.06)', border: '#fca5a5', label: '#dc2626' },
  break: { bg: 'rgba(107,114,128,0.06)', border: '#d1d5db', label: '#4b5563' },
  rect: { bg: 'rgba(107,114,128,0.04)', border: '#e5e7eb', label: '#6b7280' },
}

export default function SeqFragmentBox({ fragment, participants }: Props) {
  const {
    selectedFragmentId, selectFragment,
    updateFragment, setContextMenu, removeFragment,
  } = useSeqEditorStore()

  const isSelected = selectedFragmentId === fragment.id
  const [isResizing, setIsResizing] = useState(false)
  const resizeRef = useRef({ startY: 0, edge: '' as 'top' | 'bottom', startOrder: 0, endOrder: 0 })

  // 计算片段的渲染区域
  const coverPs = participants.filter(p => fragment.coverParticipants.includes(p.id))
  if (coverPs.length === 0) return null

  const minX = Math.min(...coverPs.map(p => p.x)) - 60
  const maxX = Math.max(...coverPs.map(p => p.x)) + 60
  const topY = SEQ_HEAD_H + fragment.startOrder * SEQ_ROW_H + 4
  const bottomY = SEQ_HEAD_H + (fragment.endOrder + 1) * SEQ_ROW_H + SEQ_ROW_H / 2 - 4
  const width = maxX - minX
  const height = bottomY - topY

  const colors = FRAG_COLORS[fragment.type] || FRAG_COLORS.rect

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selectFragment(fragment.id)
  }, [fragment.id, selectFragment])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, fragmentId: fragment.id })
  }, [fragment.id, setContextMenu])

  // ─── Resize（上下边缘拖拽调整覆盖范围） ───
  const handleResizeStart = useCallback((e: React.MouseEvent, edge: 'top' | 'bottom') => {
    e.stopPropagation()
    e.preventDefault()
    setIsResizing(true)
    resizeRef.current = {
      startY: e.clientY,
      edge,
      startOrder: fragment.startOrder,
      endOrder: fragment.endOrder,
    }

    const handleMove = (ev: MouseEvent) => {
      const dy = ev.clientY - resizeRef.current.startY
      const dOrder = Math.round(dy / SEQ_ROW_H)
      if (resizeRef.current.edge === 'top') {
        const newStart = Math.max(0, resizeRef.current.startOrder + dOrder)
        if (newStart <= fragment.endOrder) {
          updateFragment(fragment.id, { startOrder: newStart })
        }
      } else {
        const newEnd = Math.max(fragment.startOrder, resizeRef.current.endOrder + dOrder)
        updateFragment(fragment.id, { endOrder: newEnd })
      }
    }
    const handleUp = () => {
      setIsResizing(false)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
  }, [fragment, updateFragment])

  return (
    <g style={{ pointerEvents: 'auto' }}>
      {/* 背景 */}
      <rect
        x={minX} y={topY}
        width={width} height={height}
        rx={4}
        fill={colors.bg}
        stroke={isSelected ? '#3b82f6' : colors.border}
        strokeWidth={isSelected ? 2 : 1.5}
        style={{ cursor: 'pointer' }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      />

      {/* 类型标签 */}
      <g>
        <rect
          x={minX} y={topY}
          width={Math.max(60, fragment.type.length * 8 + (fragment.label ? fragment.label.length * 7 + 16 : 16))}
          height={20}
          rx={4}
          fill={colors.border}
          style={{ pointerEvents: 'none' }}
        />
        <text
          x={minX + 8} y={topY + 14}
          fontSize={11} fontWeight={600} fill={colors.label}
          style={{ pointerEvents: 'none' }}
        >
          {fragment.type}{fragment.label ? ` [${fragment.label}]` : ''}
        </text>
      </g>

      {/* ID 标签 */}
      <text
        x={minX + width - 6} y={topY + 14}
        textAnchor="end" fontSize={9} fill="#9ca3af" fontFamily="monospace"
        style={{ pointerEvents: 'none' }}
      >
        {fragment.id}
      </text>

      {/* section 分隔线（alt/par） */}
      {fragment.sections?.map((sec, i) => {
        // 简单地在 fragment 中间均分
        const sectionY = topY + (height / (fragment.sections!.length + 1)) * (i + 1)
        return (
          <g key={i}>
            <line
              x1={minX + 4} y1={sectionY}
              x2={minX + width - 4} y2={sectionY}
              stroke={colors.border} strokeWidth={1} strokeDasharray="6 3"
              style={{ pointerEvents: 'none' }}
            />
            <text
              x={minX + 12} y={sectionY + 14}
              fontSize={10} fill={colors.label} fontWeight={500}
              style={{ pointerEvents: 'none' }}
            >
              {fragment.type === 'par' ? 'and' : 'else'} {sec.label}
            </text>
          </g>
        )
      })}

      {/* Resize handles（选中时显示） */}
      {isSelected && (
        <>
          <rect
            x={minX + width / 2 - 20} y={topY - 4}
            width={40} height={8}
            rx={2}
            fill="white" stroke="#3b82f6" strokeWidth={1.5}
            style={{ cursor: 'ns-resize', pointerEvents: 'auto' }}
            onMouseDown={e => handleResizeStart(e, 'top')}
          />
          <rect
            x={minX + width / 2 - 20} y={topY + height - 4}
            width={40} height={8}
            rx={2}
            fill="white" stroke="#3b82f6" strokeWidth={1.5}
            style={{ cursor: 'ns-resize', pointerEvents: 'auto' }}
            onMouseDown={e => handleResizeStart(e, 'bottom')}
          />
        </>
      )}
    </g>
  )
}
