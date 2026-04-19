/**
 * 时序图编辑器状态管理
 * 对齐 graphEditorStore 的架构模式
 */

import { create } from 'zustand'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SeqParticipant {
  id: string
  label: string
  x: number       // 水平位置（像素）
  type: 'participant' | 'actor'
}

export interface SeqMessage {
  id: string
  from: string
  to: string
  label: string
  order: number   // 纵向排序序号
  style: 'solid' | 'dashed'
  arrow: 'filled' | 'open' | 'none'
}

export interface SeqFragmentSection {
  label: string
  afterMessageId?: string  // 在哪条消息之后开始新 section
}

export interface SeqFragment {
  id: string
  type: 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break' | 'rect'
  label: string
  coverParticipants: string[]  // 覆盖的参与者 ID
  startOrder: number           // 起始消息 order
  endOrder: number             // 结束消息 order
  sections?: SeqFragmentSection[]  // alt/par 的分支
}

export interface SeqConnectionState {
  fromId: string
  mousePos: { x: number; y: number }
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface SeqEditorState {
  // 核心数据
  participants: SeqParticipant[]
  messages: SeqMessage[]
  fragments: SeqFragment[]

  // 选中状态
  selectedParticipantId: string | null
  selectedMessageId: string | null
  selectedFragmentId: string | null

  // 视图变换
  viewTransform: { x: number; y: number; scale: number }

  // 交互状态
  connecting: SeqConnectionState | null
  editingParticipantId: string | null
  editingMessageId: string | null
  contextMenu: {
    x: number; y: number
    participantId?: string
    messageId?: string
    fragmentId?: string
  } | null

  // 设置
  showGrid: boolean

  // ─── Actions ───

  // 参与者
  addParticipant: (p: SeqParticipant) => void
  updateParticipant: (id: string, patch: Partial<SeqParticipant>) => void
  moveParticipant: (id: string, x: number) => void
  removeParticipant: (id: string) => void
  reorderParticipants: () => void  // 根据 x 坐标重排

  // 消息
  addMessage: (m: SeqMessage) => void
  updateMessage: (id: string, patch: Partial<SeqMessage>) => void
  moveMessageOrder: (id: string, newOrder: number) => void
  removeMessage: (id: string) => void
  swapMessageOrder: (id: string, dir: -1 | 1) => void

  // 片段
  addFragment: (f: SeqFragment) => void
  updateFragment: (id: string, patch: Partial<SeqFragment>) => void
  removeFragment: (id: string) => void

  // 选中
  selectParticipant: (id: string | null) => void
  selectMessage: (id: string | null) => void
  selectFragment: (id: string | null) => void
  clearSelection: () => void

  // 视图
  setViewTransform: (t: { x: number; y: number; scale: number }) => void

  // 连线
  startConnection: (fromId: string) => void
  updateConnectionMouse: (x: number, y: number) => void
  endConnection: (toId: string) => void
  cancelConnection: () => void

  // 编辑
  setEditingParticipant: (id: string | null) => void
  setEditingMessage: (id: string | null) => void
  setContextMenu: (menu: SeqEditorState['contextMenu']) => void

  // 初始化
  initSeqGraph: (participants: SeqParticipant[], messages: SeqMessage[], fragments?: SeqFragment[]) => void
}

// ─── 常量 ───

export const SEQ_COL_W = 150    // 参与者列宽
export const SEQ_ROW_H = 50     // 消息行高
export const SEQ_HEAD_H = 60    // 头部高度
export const SEQ_BOX_W = 110    // 参与者框宽
export const SEQ_BOX_H = 36     // 参与者框高
export const SEQ_PAD_X = 80     // 左侧留白

export const useSeqEditorStore = create<SeqEditorState>((set, get) => ({
  // ─── Initial State ───
  participants: [],
  messages: [],
  fragments: [],
  selectedParticipantId: null,
  selectedMessageId: null,
  selectedFragmentId: null,
  viewTransform: { x: 0, y: 0, scale: 1 },
  connecting: null,
  editingParticipantId: null,
  editingMessageId: null,
  contextMenu: null,
  showGrid: false,

  // ─── Participant Actions ───
  addParticipant: (p) => set({ participants: [...get().participants, p] }),

  updateParticipant: (id, patch) => set({
    participants: get().participants.map(p => p.id === id ? { ...p, ...patch } : p),
  }),

  moveParticipant: (id, x) => set({
    participants: get().participants.map(p => p.id === id ? { ...p, x } : p),
  }),

  removeParticipant: (id) => {
    const { participants, messages, fragments } = get()
    set({
      participants: participants.filter(p => p.id !== id),
      messages: messages.filter(m => m.from !== id && m.to !== id),
      fragments: fragments.map(f => ({
        ...f,
        coverParticipants: f.coverParticipants.filter(pid => pid !== id),
      })).filter(f => f.coverParticipants.length > 0),
      selectedParticipantId: null,
    })
  },

  reorderParticipants: () => {
    const { participants } = get()
    const sorted = [...participants].sort((a, b) => a.x - b.x)
    // 重新分配均匀的 x 坐标
    const reordered = sorted.map((p, i) => ({
      ...p,
      x: SEQ_PAD_X + i * SEQ_COL_W + SEQ_COL_W / 2,
    }))
    set({ participants: reordered })
  },

  // ─── Message Actions ───
  addMessage: (m) => set({ messages: [...get().messages, m] }),

  updateMessage: (id, patch) => set({
    messages: get().messages.map(m => m.id === id ? { ...m, ...patch } : m),
  }),

  moveMessageOrder: (id, newOrder) => {
    const { messages } = get()
    const msg = messages.find(m => m.id === id)
    if (!msg) return
    const oldOrder = msg.order
    if (oldOrder === newOrder) return

    const updated = messages.map(m => {
      if (m.id === id) return { ...m, order: newOrder }
      if (oldOrder < newOrder) {
        // 向下移动：中间的消息 order - 1
        if (m.order > oldOrder && m.order <= newOrder) return { ...m, order: m.order - 1 }
      } else {
        // 向上移动：中间的消息 order + 1
        if (m.order >= newOrder && m.order < oldOrder) return { ...m, order: m.order + 1 }
      }
      return m
    })
    set({ messages: updated })
  },

  removeMessage: (id) => {
    const { messages } = get()
    const msg = messages.find(m => m.id === id)
    if (!msg) return
    const removedOrder = msg.order
    set({
      messages: messages
        .filter(m => m.id !== id)
        .map(m => m.order > removedOrder ? { ...m, order: m.order - 1 } : m),
      selectedMessageId: null,
    })
  },

  swapMessageOrder: (id, dir) => {
    const { messages } = get()
    const sorted = [...messages].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(m => m.id === id)
    if (idx < 0) return
    const targetIdx = idx + dir
    if (targetIdx < 0 || targetIdx >= sorted.length) return
    const a = sorted[idx]
    const b = sorted[targetIdx]
    set({
      messages: messages.map(m => {
        if (m.id === a.id) return { ...m, order: b.order }
        if (m.id === b.id) return { ...m, order: a.order }
        return m
      }),
    })
  },

  // ─── Fragment Actions ───
  addFragment: (f) => set({ fragments: [...get().fragments, f] }),

  updateFragment: (id, patch) => set({
    fragments: get().fragments.map(f => f.id === id ? { ...f, ...patch } : f),
  }),

  removeFragment: (id) => set({
    fragments: get().fragments.filter(f => f.id !== id),
    selectedFragmentId: null,
  }),

  // ─── Selection Actions ───
  selectParticipant: (id) => set({
    selectedParticipantId: id,
    selectedMessageId: null,
    selectedFragmentId: null,
  }),

  selectMessage: (id) => set({
    selectedParticipantId: null,
    selectedMessageId: id,
    selectedFragmentId: null,
  }),

  selectFragment: (id) => set({
    selectedParticipantId: null,
    selectedMessageId: null,
    selectedFragmentId: id,
  }),

  clearSelection: () => set({
    selectedParticipantId: null,
    selectedMessageId: null,
    selectedFragmentId: null,
  }),

  // ─── View Actions ───
  setViewTransform: (t) => set({ viewTransform: t }),

  // ─── Connection Actions ───
  startConnection: (fromId) => set({
    connecting: { fromId, mousePos: { x: 0, y: 0 } },
  }),

  updateConnectionMouse: (x, y) => {
    const { connecting } = get()
    if (!connecting) return
    set({ connecting: { ...connecting, mousePos: { x, y } } })
  },

  endConnection: (toId) => {
    const { connecting, messages } = get()
    if (!connecting) return

    const maxOrder = messages.length > 0
      ? Math.max(...messages.map(m => m.order))
      : -1

    const newMessage: SeqMessage = {
      id: `msg-${Date.now()}`,
      from: connecting.fromId,
      to: toId,
      label: '消息',
      order: maxOrder + 1,
      style: 'solid',
      arrow: 'filled',
    }

    set({
      messages: [...messages, newMessage],
      connecting: null,
      selectedMessageId: newMessage.id,
    })
  },

  cancelConnection: () => set({ connecting: null }),

  // ─── Edit Actions ───
  setEditingParticipant: (id) => set({ editingParticipantId: id }),
  setEditingMessage: (id) => set({ editingMessageId: id }),
  setContextMenu: (menu) => set({ contextMenu: menu }),

  // ─── Init ───
  initSeqGraph: (participants, messages, fragments = []) => {
    set({
      participants,
      messages,
      fragments,
      selectedParticipantId: null,
      selectedMessageId: null,
      selectedFragmentId: null,
      connecting: null,
      editingParticipantId: null,
      editingMessageId: null,
      contextMenu: null,
    })
  },
}))
