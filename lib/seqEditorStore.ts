/**
 * 时序图编辑器状态管理
 * 对齐 graphEditorStore 的架构模式
 */

import { create } from 'zustand'

// ID 生成计数器
let _fragCounter = 0

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

export interface SeqActivation {
  id: string
  participantId: string
  order: number   // 浮点数，插在消息之间（如 1.5 表示在 order=1 的消息之后）
  type: 'activate' | 'deactivate'
}

export interface SeqConnectionState {
  fromId: string
  fromY: number
  mousePos: { x: number; y: number }
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface SeqEditorState {
  // 核心数据
  participants: SeqParticipant[]
  messages: SeqMessage[]
  fragments: SeqFragment[]
  activations: SeqActivation[]

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

  // 待添加元素
  pendingAddType: 'participant' | 'actor' | SeqFragment['type'] | null

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

  // 激活条
  addActivation: (a: SeqActivation) => void
  removeActivation: (id: string) => void

  // 选中
  selectParticipant: (id: string | null) => void
  selectMessage: (id: string | null) => void
  selectFragment: (id: string | null) => void
  clearSelection: () => void

  // 视图
  setViewTransform: (t: { x: number; y: number; scale: number }) => void

  // 连线
  startConnection: (fromId: string, fromY?: number) => void
  updateConnectionMouse: (x: number, y: number) => void
  endConnection: (toId: string) => void
  cancelConnection: () => void

  // 编辑
  setEditingParticipant: (id: string | null) => void
  setEditingMessage: (id: string | null) => void
  setContextMenu: (menu: SeqEditorState['contextMenu']) => void
  setPendingAddType: (type: SeqEditorState['pendingAddType']) => void

  // 初始化
  initSeqGraph: (participants: SeqParticipant[], messages: SeqMessage[], fragments?: SeqFragment[], activations?: SeqActivation[]) => void
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
  activations: [],
  selectedParticipantId: null,
  selectedMessageId: null,
  selectedFragmentId: null,
  viewTransform: { x: 0, y: 0, scale: 1 },
  connecting: null,
  editingParticipantId: null,
  editingMessageId: null,
  contextMenu: null,
  showGrid: false,
  pendingAddType: null,

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

  // ─── Activation Actions ───
  addActivation: (a) => set({ activations: [...get().activations, a] }),
  removeActivation: (id) => set({ activations: get().activations.filter(a => a.id !== id) }),

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
  startConnection: (fromId, fromY = 0) => set({
    connecting: { fromId, fromY, mousePos: { x: 0, y: 0 } },
  }),

  updateConnectionMouse: (x, y) => {
    const { connecting } = get()
    if (!connecting) return
    set({ connecting: { ...connecting, mousePos: { x, y } } })
  },

  endConnection: (toId) => {
    const { connecting, messages, fragments } = get()
    if (!connecting) return

    // 根据点击的 Y 坐标计算插入位置
    const clickY = connecting.fromY
    const insertOrder = Math.max(0, Math.round((clickY - SEQ_HEAD_H) / SEQ_ROW_H))

    // 把 >= insertOrder 的消息都往后挤
    const updatedMessages = messages.map(m =>
      m.order >= insertOrder ? { ...m, order: m.order + 1 } : m
    )

    const newMessage: SeqMessage = {
      id: `msg-${Date.now()}`,
      from: connecting.fromId,
      to: toId,
      label: '消息',
      order: insertOrder,
      style: 'solid',
      arrow: 'filled',
    }

    // 更新片段：挤开 + 自动扩展
    const updatedFragments = fragments.map(f => {
      let newStart = f.startOrder
      let newEnd = f.endOrder

      // 1. 如果插入点在片段范围内或之前，往后挤
      if (f.startOrder >= insertOrder) {
        newStart = f.startOrder + 1
      }
      if (f.endOrder >= insertOrder) {
        newEnd = f.endOrder + 1
      }

      // 2. 如果新消息在片段后面，且涉及片段覆盖的参与者，自动扩展
      if (insertOrder > f.endOrder) {
        const involvedInFragment = f.coverParticipants.includes(newMessage.from) ||
                                   f.coverParticipants.includes(newMessage.to)
        if (involvedInFragment) {
          newEnd = insertOrder
        }
      }

      return { ...f, startOrder: newStart, endOrder: newEnd }
    })

    set({
      messages: [...updatedMessages, newMessage],
      fragments: updatedFragments,
      connecting: null,
      selectedMessageId: newMessage.id,
    })
  },

  cancelConnection: () => set({ connecting: null }),

  // ─── Edit Actions ───
  setEditingParticipant: (id) => set({ editingParticipantId: id }),
  setEditingMessage: (id) => set({ editingMessageId: id }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setPendingAddType: (type) => set({ pendingAddType: type }),

  // ─── Init ───
  initSeqGraph: (participants, messages, fragments = [], activations = []) => {
    set({
      participants,
      messages,
      fragments,
      activations,
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
