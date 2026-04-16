/**
 * State 层：可视化编辑器的状态管理
 * 完全独立于 Mermaid SVG，使用 dagre 布局
 */

import { create } from 'zustand'
import type { LayoutNode } from './graphLayout'
import type { GraphEdge, Subgraph } from './graphParser'

// ─── Types ───────────────────────────────────────────────────────────────────

export type NodeState = LayoutNode

export type EdgeState = GraphEdge

export type SubgraphState = Subgraph

export interface LayoutMetadata {
  [nodeId: string]: {
    x: number
    y: number
  }
}

export interface ConnectionState {
  sourceId: string
  sourceHandle: 'top' | 'bottom' | 'left' | 'right'
  mousePos: { x: number; y: number }
}

// ─── Store ───────────────────────────────────────────────────────────────────

interface GraphEditorState {
  // ─── 核心数据（SSOT） ───
  nodes: NodeState[]
  edges: EdgeState[]
  subgraphs: SubgraphState[]
  layout: LayoutMetadata | null  // 持久化的布局数据

  // ─── 选中状态 ───
  selectedNodeIds: Set<string>
  selectedEdgeId: string | null

  // ─── 视图变换 ───
  viewTransform: { x: number; y: number; scale: number }

  // ─── 交互状态 ───
  connecting: ConnectionState | null
  hoveredNodeId: string | null
  editingNodeId: string | null
  editingEdgeId: string | null
  contextMenu: { x: number; y: number; nodeId?: string; edgeId?: string } | null

  // ─── 设置 ───
  showGrid: boolean
  direction: 'TB' | 'LR' | 'BT' | 'RL'
  curveStyle: 'basis' | 'linear' | 'step' | 'stepBefore' | 'stepAfter' | 'monotoneX' | 'monotoneY'
  pendingAddShape: string | null

  // ─── 撤销/重做 ───
  history: string[]  // 存储 mermaid 代码快照
  future: string[]

  // ─── Actions ───
  setNodes: (nodes: NodeState[]) => void
  setEdges: (edges: EdgeState[]) => void
  setSubgraphs: (subgraphs: SubgraphState[]) => void
  addSubgraph: (subgraph: SubgraphState) => void
  setLayout: (layout: LayoutMetadata | null) => void

  updateNode: (id: string, patch: Partial<NodeState>) => void
  moveNode: (id: string, x: number, y: number) => void
  removeNode: (id: string) => void
  addNode: (node: NodeState) => void

  addEdge: (edge: EdgeState) => void
  updateEdge: (id: string, patch: Partial<EdgeState>) => void
  removeEdge: (id: string) => void
  reverseEdge: (id: string) => void

  selectNode: (id: string, multi?: boolean) => void
  selectEdge: (id: string) => void
  clearSelection: () => void

  setViewTransform: (t: { x: number; y: number; scale: number }) => void
  zoomTo: (scale: number, cx?: number, cy?: number) => void

  startConnection: (sourceId: string, sourceHandle: 'top' | 'bottom' | 'left' | 'right') => void
  updateConnectionMouse: (x: number, y: number) => void
  endConnection: (targetId: string) => void
  cancelConnection: () => void

  setHoveredNodeId: (id: string | null) => void
  setEditingNode: (id: string | null) => void
  setEditingEdge: (id: string | null) => void
  setContextMenu: (menu: { x: number; y: number; nodeId?: string; edgeId?: string } | null) => void
  setShowGrid: (show: boolean) => void
  setDirection: (direction: 'TB' | 'LR' | 'BT' | 'RL') => void
  setCurveStyle: (style: 'basis' | 'linear' | 'step' | 'stepBefore' | 'stepAfter' | 'monotoneX' | 'monotoneY') => void
  setPendingAddShape: (shape: string | null) => void

  pushHistory: (code: string) => void
  undo: () => string | null
  redo: () => string | null

  // ─── 批量初始化 ───
  initGraph: (nodes: NodeState[], edges: EdgeState[], layout: LayoutMetadata | null, subgraphs?: SubgraphState[]) => void
}

const MAX_HISTORY = 50

export const useGraphEditorStore = create<GraphEditorState>((set, get) => ({
  // ─── Initial State ───
  nodes: [],
  edges: [],
  subgraphs: [],
  layout: null,
  selectedNodeIds: new Set(),
  selectedEdgeId: null,
  viewTransform: { x: 0, y: 0, scale: 1 },
  connecting: null,
  hoveredNodeId: null,
  editingNodeId: null,
  editingEdgeId: null,
  contextMenu: null,
  showGrid: true,
  direction: 'TB',
  curveStyle: 'basis',
  pendingAddShape: null,
  history: [],
  future: [],

  // ─── Node Actions ───
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  setSubgraphs: (subgraphs) => set({ subgraphs }),
  addSubgraph: (subgraph) => set({ subgraphs: [...get().subgraphs, subgraph] }),
  setLayout: (layout) => set({ layout }),

  updateNode: (id, patch) => set({
    nodes: get().nodes.map(n => n.id === id ? { ...n, ...patch } : n),
  }),

  moveNode: (id, x, y) => set({
    nodes: get().nodes.map(n => n.id === id ? { ...n, x, y } : n),
  }),

  removeNode: (id) => {
    const { nodes, edges } = get()
    set({
      nodes: nodes.filter(n => n.id !== id),
      edges: edges.filter(e => e.source !== id && e.target !== id),
      selectedNodeIds: new Set(),
    })
  },

  addNode: (node) => set({ nodes: [...get().nodes, node] }),

  // ─── Edge Actions ───
  addEdge: (edge) => set({ edges: [...get().edges, edge] }),

  updateEdge: (id, patch) => set({
    edges: get().edges.map(e => e.id === id ? { ...e, ...patch } : e),
  }),

  removeEdge: (id) => set({
    edges: get().edges.filter(e => e.id !== id),
    selectedEdgeId: null,
  }),

  reverseEdge: (id) => set({
    edges: get().edges.map(e =>
      e.id === id ? { ...e, source: e.target, target: e.source } : e
    ),
  }),

  // ─── Selection Actions ───
  selectNode: (id, multi) => {
    const { selectedNodeIds } = get()
    if (multi) {
      const next = new Set(selectedNodeIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      set({ selectedNodeIds: next, selectedEdgeId: null })
    } else {
      set({ selectedNodeIds: new Set([id]), selectedEdgeId: null })
    }
  },

  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeIds: new Set() }),

  clearSelection: () => set({ selectedNodeIds: new Set(), selectedEdgeId: null }),

  // ─── View Actions ───
  setViewTransform: (t) => set({ viewTransform: t }),

  zoomTo: (scale, cx, cy) => {
    const { viewTransform: vt } = get()
    const s = Math.max(0.1, Math.min(4, scale))
    if (cx !== undefined && cy !== undefined) {
      const ratio = s / vt.scale
      set({ viewTransform: { x: cx - (cx - vt.x) * ratio, y: cy - (cy - vt.y) * ratio, scale: s } })
    } else {
      set({ viewTransform: { ...vt, scale: s } })
    }
  },

  // ─── Connection Actions ───
  startConnection: (sourceId, sourceHandle) => {
    set({
      connecting: { sourceId, sourceHandle, mousePos: { x: 0, y: 0 } },
    })
  },

  updateConnectionMouse: (x, y) => {
    const { connecting } = get()
    if (!connecting) return
    set({ connecting: { ...connecting, mousePos: { x, y } } })
  },

  endConnection: (targetId) => {
    const { connecting, edges } = get()
    if (!connecting) return

    const newEdge: EdgeState = {
      id: `${connecting.sourceId}-${targetId}-${Date.now()}`,
      source: connecting.sourceId,
      target: targetId,
    }

    set({
      edges: [...edges, newEdge],
      connecting: null,
    })
  },

  cancelConnection: () => {
    set({ connecting: null })
  },

  // ─── UI Actions ───
  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),
  setEditingNode: (id) => set({ editingNodeId: id }),
  setEditingEdge: (id) => set({ editingEdgeId: id }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setShowGrid: (show) => set({ showGrid: show }),
  setDirection: (direction) => set({ direction }),
  setCurveStyle: (curveStyle) => set({ curveStyle }),
  setPendingAddShape: (shape) => set({ pendingAddShape: shape }),

  // ─── History Actions ───
  pushHistory: (code) => {
    const { history } = get()
    set({
      history: [...history.slice(-(MAX_HISTORY - 1)), code],
      future: [],
    })
  },

  undo: () => {
    const { history, future } = get()
    if (history.length === 0) return null
    const prev = history[history.length - 1]
    set({
      history: history.slice(0, -1),
      future: [prev, ...future.slice(0, MAX_HISTORY - 1)],
    })
    return prev
  },

  redo: () => {
    const { history, future } = get()
    if (future.length === 0) return null
    const next = future[0]
    set({
      history: [...history.slice(-(MAX_HISTORY - 1)), next],
      future: future.slice(1),
    })
    return next
  },

  // ─── Bulk Init ───
  initGraph: (nodes, edges, layout, subgraphs = []) => {
    set({
      nodes,
      edges,
      subgraphs,
      layout,
      selectedNodeIds: new Set(),
      selectedEdgeId: null,
    })
  },
}))
