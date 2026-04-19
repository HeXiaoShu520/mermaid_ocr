'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useSeqEditorStore } from '@/lib/seqEditorStore'
import { useAiStore } from '@/lib/aiStore'

export default function SeqContextMenu() {
  const {
    contextMenu, setContextMenu,
    removeParticipant, removeMessage, removeFragment,
    participants, messages, fragments,
    selectMessage, updateMessage, swapMessageOrder,
    addFragment,
  } = useSeqEditorStore()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = () => setContextMenu(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [setContextMenu])

  if (!contextMenu) return null

  const { x, y, participantId, messageId, fragmentId } = contextMenu
  const isCanvas = !participantId && !messageId && !fragmentId

  const items: { label: string; onClick: () => void; danger?: boolean; divider?: boolean }[] = []

  if (participantId) {
    const p = participants.find(pp => pp.id === participantId)
    if (p) {
      items.push({
        label: `引用「${p.label}」到 AI`,
        onClick: () => {
          const { setIsOpen, addContextNode, insertTextToInput } = useAiStore.getState()
          addContextNode({ id: p.id, label: p.label })
          insertTextToInput(`「${p.label}」`)
          setIsOpen(true)
          setContextMenu(null)
        },
      })
      items.push({
        label: p.type === 'actor' ? '切换为方框' : '切换为小人',
        onClick: () => {
          const { updateParticipant } = useSeqEditorStore.getState()
          updateParticipant(p.id, { type: p.type === 'actor' ? 'participant' : 'actor' })
          setContextMenu(null)
        },
      })
      items.push({ label: '', onClick: () => {}, divider: true })
      items.push({
        label: '删除参与者',
        danger: true,
        onClick: () => { removeParticipant(participantId); setContextMenu(null) },
      })
    }
  }

  if (messageId) {
    const m = messages.find(mm => mm.id === messageId)
    if (m) {
      items.push({
        label: `引用「${m.label}」到 AI`,
        onClick: () => {
          const { setIsOpen, addContextNode, insertTextToInput } = useAiStore.getState()
          addContextNode({ id: m.id, label: m.label })
          insertTextToInput(`「${m.label}」`)
          setIsOpen(true)
          setContextMenu(null)
        },
      })
      items.push({
        label: m.style === 'solid' ? '改为虚线' : '改为实线',
        onClick: () => {
          updateMessage(messageId, { style: m.style === 'solid' ? 'dashed' : 'solid' })
          setContextMenu(null)
        },
      })
      items.push({
        label: `箭头: ${m.arrow === 'filled' ? '实心→空心' : m.arrow === 'open' ? '空心→无' : '无→实心'}`,
        onClick: () => {
          const next = m.arrow === 'filled' ? 'open' : m.arrow === 'open' ? 'none' : 'filled'
          updateMessage(messageId, { arrow: next as any })
          setContextMenu(null)
        },
      })
      items.push({
        label: '上移',
        onClick: () => { swapMessageOrder(messageId, -1); setContextMenu(null) },
      })
      items.push({
        label: '下移',
        onClick: () => { swapMessageOrder(messageId, 1); setContextMenu(null) },
      })
      items.push({ label: '', onClick: () => {}, divider: true })
      items.push({
        label: '删除消息',
        danger: true,
        onClick: () => { removeMessage(messageId); setContextMenu(null) },
      })
    }
  }

  if (fragmentId) {
    const f = fragments.find(ff => ff.id === fragmentId)
    if (f) {
      items.push({
        label: `引用「${f.type}[${f.label}]」到 AI`,
        onClick: () => {
          const { setIsOpen, addContextNode, insertTextToInput } = useAiStore.getState()
          addContextNode({ id: f.id, label: `${f.type}[${f.label}]` })
          insertTextToInput(`「${f.type}[${f.label}]」`)
          setIsOpen(true)
          setContextMenu(null)
        },
      })
      items.push({ label: '', onClick: () => {}, divider: true })
      items.push({
        label: '删除片段',
        danger: true,
        onClick: () => { removeFragment(fragmentId); setContextMenu(null) },
      })
    }
  }

  if (isCanvas) {
    // 画布空白处右键
    items.push({
      label: '添加参与者',
      onClick: () => {
        const { addParticipant, participants: ps } = useSeqEditorStore.getState()
        const id = `P${ps.length + 1}`
        const newX = ps.length > 0
          ? Math.max(...ps.map(p => p.x)) + 150
          : 80 + 75
        addParticipant({ id, label: id, x: newX, type: 'participant' })
        setContextMenu(null)
      },
    })

    // 添加片段子菜单
    const fragTypes = ['loop', 'alt', 'opt', 'par', 'critical', 'break'] as const
    for (const ft of fragTypes) {
      items.push({
        label: `添加 ${ft} 片段`,
        onClick: () => {
          const { messages: msgs, participants: ps } = useSeqEditorStore.getState()
          const maxOrder = msgs.length > 0 ? Math.max(...msgs.map(m => m.order)) : 0
          addFragment({
            id: `frag-${Date.now()}`,
            type: ft,
            label: ft === 'loop' ? '条件' : ft === 'alt' ? '条件' : '',
            coverParticipants: ps.map(p => p.id),
            startOrder: 0,
            endOrder: Math.max(0, maxOrder),
            sections: ft === 'alt' ? [{ label: '否则' }] : ft === 'par' ? [{ label: '并行' }] : undefined,
          })
          setContextMenu(null)
        },
      })
    }
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        padding: '4px 0',
        minWidth: 160,
      }}
      onClick={e => e.stopPropagation()}
    >
      {items.map((item, i) => {
        if (item.divider) {
          return <div key={i} style={{ height: 1, background: '#e5e7eb', margin: '4px 0' }} />
        }
        return (
          <div
            key={i}
            onClick={item.onClick}
            style={{
              padding: '6px 14px',
              fontSize: 13,
              cursor: 'pointer',
              color: item.danger ? '#ef4444' : '#374151',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {item.label}
          </div>
        )
      })}
    </div>
  )
}
