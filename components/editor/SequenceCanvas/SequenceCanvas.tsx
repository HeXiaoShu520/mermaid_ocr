'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  useSeqEditorStore,
  SEQ_HEAD_H, SEQ_ROW_H, SEQ_PAD_X, SEQ_COL_W,
} from '@/lib/seqEditorStore'
import SeqParticipantNode from './SeqParticipantNode'
import SeqMessageLine from './SeqMessageLine'
import SeqFragmentBox from './SeqFragmentBox'
import SeqContextMenu from './SeqContextMenu'

// 片段 ID 计数器
let _fragCounter = 0

export default function SequenceCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    participants, messages, fragments, activations,
    viewTransform, setViewTransform,
    connecting, updateConnectionMouse, cancelConnection, endConnection,
    clearSelection, setContextMenu,
    selectedMessageId, selectedParticipantId, selectedFragmentId,
    removeMessage, removeParticipant, removeFragment,
    pendingAddType, setPendingAddType,
    addParticipant, addFragment,
  } = useSeqEditorStore()

  // ─── 框选状态 ───
  const [isBoxSelecting, setIsBoxSelecting] = useState(false)
  const [boxStart, setBoxStart] = useState({ x: 0, y: 0 })
  const [boxEnd, setBoxEnd] = useState({ x: 0, y: 0 })

  // ─── 画布尺寸 ───
  const maxOrder = messages.length > 0 ? Math.max(...messages.map(m => m.order)) : 0
  const svgW = participants.length > 0
    ? Math.max(...participants.map(p => p.x)) + SEQ_COL_W
    : 400
  const svgH = SEQ_HEAD_H + (maxOrder + 2) * SEQ_ROW_H + 60
  const lifelineH = svgH - 50

  // ─── Pan ───
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    // 只在 SVG 背景或容器上触发
    if (target.tagName === 'svg' || target === e.currentTarget || target.classList.contains('seq-bg')) {
      if (connecting) {
        cancelConnection()
        return
      }

      // 片段框选模式
      const isFragmentType = pendingAddType && !['participant', 'actor'].includes(pendingAddType)
      if (isFragmentType && e.button === 0) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const x = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale
          const y = (e.clientY - rect.top - viewTransform.y) / viewTransform.scale
          setIsBoxSelecting(true)
          setBoxStart({ x, y })
          setBoxEnd({ x, y })
          e.preventDefault()
          return
        }
      }

      if (e.button === 0 || e.button === 1) {
        isPanningRef.current = true
        panStartRef.current = { x: e.clientX - viewTransform.x, y: e.clientY - viewTransform.y }
        e.preventDefault()
      }
    }
  }, [viewTransform, connecting, cancelConnection, pendingAddType])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isBoxSelecting) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale
        const y = (e.clientY - rect.top - viewTransform.y) / viewTransform.scale
        setBoxEnd({ x, y })
      }
      return
    }
    if (isPanningRef.current) {
      setViewTransform({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
        scale: viewTransform.scale,
      })
    }
    if (connecting) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale
        const y = (e.clientY - rect.top - viewTransform.y) / viewTransform.scale
        updateConnectionMouse(x, y)
      }
    }
  }, [isBoxSelecting, viewTransform, setViewTransform, connecting, updateConnectionMouse])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // 片段框选完成
    if (isBoxSelecting && pendingAddType) {
      const minY = Math.min(boxStart.y, boxEnd.y)
      const maxY = Math.max(boxStart.y, boxEnd.y)
      const height = maxY - minY

      if (height > 10) {
        // y 坐标映射到消息 order
        const startOrder = Math.max(0, Math.round((minY - SEQ_HEAD_H) / SEQ_ROW_H))
        const endOrder = Math.max(startOrder, Math.round((maxY - SEQ_HEAD_H) / SEQ_ROW_H))

        // 收集片段范围内消息涉及的参与者
        const involvedParticipants = new Set<string>()
        messages.forEach(m => {
          if (m.order >= startOrder && m.order <= endOrder) {
            involvedParticipants.add(m.from)
            involvedParticipants.add(m.to)
          }
        })

        const fragType = pendingAddType as 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break' | 'rect'
        const frag: any = {
          id: `frag-${++_fragCounter}`,
          type: fragType,
          label: fragType === 'loop' ? '条件' : fragType === 'alt' ? '条件' : fragType === 'opt' ? '条件' : fragType === 'par' ? '并行' : fragType === 'critical' ? '关键' : '中断',
          coverParticipants: involvedParticipants.size > 0 ? Array.from(involvedParticipants) : participants.map(p => p.id),
          startOrder,
          endOrder,
        }
        // alt/par 需要 sections
        if (fragType === 'alt') frag.sections = [{ label: '否则' }]
        if (fragType === 'par') frag.sections = [{ label: '并行' }]

        addFragment(frag)
      }

      setIsBoxSelecting(false)
      setPendingAddType(null)
      return
    }

    isPanningRef.current = false
    // 如果正在连线，检查是否在某个参与者的生命线上释放
    if (connecting) {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        const mx = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale
        // 找最近的参与者
        let closest = participants[0]
        let minDist = Infinity
        for (const p of participants) {
          const dist = Math.abs(p.x - mx)
          if (dist < minDist) { minDist = dist; closest = p }
        }
        if (closest && minDist < SEQ_COL_W / 2) {
          endConnection(closest.id)
        } else {
          cancelConnection()
        }
      }
    }
  }, [isBoxSelecting, boxStart, boxEnd, pendingAddType, participants, connecting, viewTransform, endConnection, cancelConnection, addFragment, setPendingAddType])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'svg' || target === e.currentTarget || target.classList.contains('seq-bg')) {
      // 参与者点击放置
      if (pendingAddType === 'participant' || pendingAddType === 'actor') {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const clickX = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale
          // 计算 x：追加到最右侧，或对齐到点击位置
          const rightMost = participants.length > 0
            ? Math.max(...participants.map(p => p.x)) + SEQ_COL_W
            : SEQ_PAD_X
          const x = participants.length === 0 ? SEQ_PAD_X : Math.max(rightMost, Math.round(clickX / SEQ_COL_W) * SEQ_COL_W)
          const id = `P${participants.length + 1}`
          addParticipant({ id, label: id, x, type: pendingAddType })
          setPendingAddType(null)
          return
        }
      }
      clearSelection()
    }
  }, [clearSelection, pendingAddType, participants, viewTransform, addParticipant, setPendingAddType])

  // ─── Zoom ───
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const rect = container.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const { viewTransform: vt } = useSeqEditorStore.getState()
      const newScale = Math.max(0.2, Math.min(3, vt.scale * delta))
      const ratio = newScale / vt.scale
      useSeqEditorStore.getState().setViewTransform({
        x: cx - (cx - vt.x) * ratio,
        y: cy - (cy - vt.y) * ratio,
        scale: newScale,
      })
    }
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // ─── 键盘快捷键 ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isBoxSelecting) { setIsBoxSelecting(false); setPendingAddType(null) }
        else if (pendingAddType) setPendingAddType(null)
        else if (connecting) cancelConnection()
        else clearSelection()
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 避免在输入框中触发
        if ((e.target as HTMLElement).tagName === 'INPUT') return
        if (selectedMessageId) removeMessage(selectedMessageId)
        if (selectedParticipantId) removeParticipant(selectedParticipantId)
        if (selectedFragmentId) removeFragment(selectedFragmentId)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [connecting, cancelConnection, clearSelection, selectedMessageId, selectedParticipantId, selectedFragmentId, removeMessage, removeParticipant, removeFragment, pendingAddType, setPendingAddType, isBoxSelecting])

  // ─── 右键菜单 ───
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.tagName === 'svg' || target === e.currentTarget || target.classList.contains('seq-bg')) {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY })
    }
  }, [setContextMenu])

  // ─── 拖拽放置参与者 ───
  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/seq-element')) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/seq-element')
    if (!type || (type !== 'participant' && type !== 'actor')) return

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    // 计算拖拽位置
    const mx = (e.clientX - rect.left - viewTransform.x) / viewTransform.scale

    // 找到插入位置：在哪两个参与者之间
    let insertIndex = participants.length
    for (let i = 0; i < participants.length; i++) {
      if (mx < participants[i].x) {
        insertIndex = i
        break
      }
    }

    const id = `P${participants.length + 1}`
    const newParticipant = { id, label: id, x: 0, type: type as 'participant' | 'actor' }

    // 插入到指定位置
    const updated = [...participants]
    updated.splice(insertIndex, 0, newParticipant)

    // 重新计算所有参与者的 x 坐标
    const reordered = updated.map((p, i) => ({
      ...p,
      x: SEQ_PAD_X + i * SEQ_COL_W + SEQ_COL_W / 2,
    }))

    useSeqEditorStore.setState({ participants: reordered })
  }, [participants, viewTransform])

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        background: 'white',
        cursor: isPanningRef.current ? 'grabbing' : (connecting || pendingAddType ? 'crosshair' : 'default'),
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        style={{
          transform: `translate(${viewTransform.x}px, ${viewTransform.y}px) scale(${viewTransform.scale})`,
          transformOrigin: '0 0',
          position: 'absolute',
          left: 0,
          top: 0,
        }}
      >
        <svg
          width={svgW}
          height={svgH}
          style={{ overflow: 'visible', display: 'block' }}
        >
          {/* 背景（用于事件捕获） */}
          <rect
            className="seq-bg"
            x={0} y={0} width={svgW} height={svgH}
            fill="transparent"
            style={{ pointerEvents: 'auto' }}
          />

          {/* Fragments（底层） */}
          {fragments.map(f => (
            <SeqFragmentBox
              key={f.id}
              fragment={f}
              participants={participants}
            />
          ))}

          {/* 参与者 + 生命线 */}
          {participants.map(p => (
            <SeqParticipantNode
              key={p.id}
              participant={p}
              lifelineHeight={lifelineH}
              viewScale={viewTransform.scale}
              activations={activations}
            />
          ))}

          {/* 消息 */}
          {[...messages].sort((a, b) => a.order - b.order).map(m => (
            <SeqMessageLine
              key={m.id}
              message={m}
              participants={participants}
            />
          ))}

          {/* 临时连线 */}
          {connecting && (() => {
            const fromP = participants.find(p => p.id === connecting.fromId)
            if (!fromP) return null
            return (
              <line
                x1={fromP.x}
                y1={connecting.fromY || SEQ_HEAD_H + (maxOrder + 1) * SEQ_ROW_H}
                x2={connecting.mousePos.x}
                y2={connecting.mousePos.y}
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="5,5"
                style={{ pointerEvents: 'none' }}
              />
            )
          })()}

          {/* 框选矩形 */}
          {isBoxSelecting && (
            <rect
              x={Math.min(boxStart.x, boxEnd.x)}
              y={Math.min(boxStart.y, boxEnd.y)}
              width={Math.abs(boxEnd.x - boxStart.x)}
              height={Math.abs(boxEnd.y - boxStart.y)}
              fill="rgba(99, 102, 241, 0.1)"
              stroke="#6366f1"
              strokeWidth={1}
              strokeDasharray="4,4"
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>
      </div>

      {/* 空状态 */}
      {participants.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#9ca3af', pointerEvents: 'none', gap: 8,
        }}>
          <div style={{ fontSize: 72, lineHeight: 1 }}>🎭</div>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#6b7280' }}>时序图画布</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>从右侧面板添加参与者，或点击上方「读取代码」</div>
        </div>
      )}

      {/* 右键菜单 */}
      <SeqContextMenu />
    </div>
  )
}
