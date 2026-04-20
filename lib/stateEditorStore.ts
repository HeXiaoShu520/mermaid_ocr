/**
 * 状态图编辑器状态管理
 */

import { create } from 'zustand'

// ID 生成计数器
let _stateCounter = 0
let _transitionCounter = 0

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StateNode {
  id: string
  label: string
  x: number
  y: number
  type: 'simple' | 'start' | 'end' | 'choice' | 'fork' | 'join' | 'composite'
  // 复合状态的子状态
  children?: StateNode[]
  childTransitions?: StateTransition[]
  // 注释
  note?: { position: 'left' | 'right'; text: string }
}

export interface StateTransition {
  id: string
  from: string  // 状态 ID 或 '[*]'
  to: string    // 状态 ID 或 '[*]'
  label?: string
}

interface ViewTransform {
  x: number
  y: number
  scale: number
}

interface ContextMenu {
  x: number
  y: number
  stateId?: string
  transitionId?: string
}

interface StateEditorStore {
  // 数据
  states: StateNode[]
  transitions: StateTransition[]

  // 视图
  viewTransform: ViewTransform

  // 选中状态
  selectedStateId: string | null
  selectedTransitionId: string | null

  // 右键菜单
  contextMenu: ContextMenu | null

  // 连线状态
  connecting: { fromId: string; mousePos: { x: number; y: number } } | null

  // 待添加类型（从右侧面板拖拽/点击）
  pendingAddType: 'simple' | 'choice' | 'fork' | 'join' | 'composite' | null

  // Actions
  addState: (state: StateNode) => void
  updateState: (id: string, patch: Partial<StateNode>) => void
  removeState: (id: string) => void
  moveState: (id: string, x: number, y: number) => void

  addTransition: (transition: StateTransition) => void
  updateTransition: (id: string, patch: Partial<StateTransition>) => void
  removeTransition: (id: string) => void

  selectState: (id: string | null) => void
  selectTransition: (id: string | null) => void
  clearSelection: () => void

  setViewTransform: (transform: ViewTransform) => void
  setContextMenu: (menu: ContextMenu | null) => void

  startConnection: (fromId: string) => void
  updateConnectionMouse: (pos: { x: number; y: number }) => void
  endConnection: (toId: string) => void
  cancelConnection: () => void

  setPendingAddType: (type: StateEditorStore['pendingAddType']) => void

  // 重置
  reset: () => void
}

const initialState = {
  states: [],
  transitions: [],
  viewTransform: { x: 0, y: 50, scale: 1 },
  selectedStateId: null,
  selectedTransitionId: null,
  contextMenu: null,
  connecting: null,
  pendingAddType: null,
}

export const useStateEditorStore = create<StateEditorStore>((set, get) => ({
  ...initialState,

  // ─── State Actions ───
  addState: (state) => set({ states: [...get().states, state] }),

  updateState: (id, patch) => set({
    states: get().states.map(s => s.id === id ? { ...s, ...patch } : s),
  }),

  removeState: (id) => {
    const { states, transitions } = get()
    set({
      states: states.filter(s => s.id !== id),
      transitions: transitions.filter(t => t.from !== id && t.to !== id),
      selectedStateId: null,
    })
  },

  moveState: (id, x, y) => set({
    states: get().states.map(s => s.id === id ? { ...s, x, y } : s),
  }),

  // ─── Transition Actions ───
  addTransition: (transition) => set({ transitions: [...get().transitions, transition] }),

  updateTransition: (id, patch) => set({
    transitions: get().transitions.map(t => t.id === id ? { ...t, ...patch } : t),
  }),

  removeTransition: (id) => set({
    transitions: get().transitions.filter(t => t.id !== id),
    selectedTransitionId: null,
  }),

  // ─── Selection Actions ───
  selectState: (id) => set({
    selectedStateId: id,
    selectedTransitionId: null,
  }),

  selectTransition: (id) => set({
    selectedStateId: null,
    selectedTransitionId: id,
  }),

  clearSelection: () => set({
    selectedStateId: null,
    selectedTransitionId: null,
  }),

  // ─── View Actions ───
  setViewTransform: (transform) => set({ viewTransform: transform }),
  setContextMenu: (menu) => set({ contextMenu: menu }),

  // ─── Connection Actions ───
  startConnection: (fromId) => set({
    connecting: { fromId, mousePos: { x: 0, y: 0 } },
  }),

  updateConnectionMouse: (pos) => {
    const { connecting } = get()
    if (connecting) {
      set({ connecting: { ...connecting, mousePos: pos } })
    }
  },

  endConnection: (toId) => {
    const { connecting } = get()
    if (!connecting) return

    const newTransition: StateTransition = {
      id: `trans-${++_transitionCounter}`,
      from: connecting.fromId,
      to: toId,
      label: '',
    }

    set({
      transitions: [...get().transitions, newTransition],
      connecting: null,
      selectedTransitionId: newTransition.id,
    })
  },

  cancelConnection: () => set({ connecting: null }),

  setPendingAddType: (type) => set({ pendingAddType: type }),

  // ─── Reset ───
  reset: () => set(initialState),
}))

// 辅助函数：生成新状态 ID
export function generateStateId(type: StateNode['type']): string {
  if (type === 'start' || type === 'end') return '[*]'
  return `S${++_stateCounter}`
}
