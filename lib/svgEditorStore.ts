import { create } from 'zustand'

// ─── Types ───────────────────────────────────────────────────────────────────

export type HandleDir = 'top' | 'bottom' | 'left' | 'right'
export type Direction = 'TB' | 'LR' | 'BT' | 'RL'
export type Theme = 'default' | 'dark' | 'forest' | 'neutral' | 'base'
export type Look = 'classic' | 'handDrawn'
export type CurveStyle = 'basis' | 'linear' | 'step'
export type NodeShape = 'rectangle' | 'rounded' | 'stadium' | 'subroutine' | 'cylinder' | 'circle' | 'double-circle' | 'diamond' | 'hexagon' | 'asymmetric' | 'parallelogram' | 'parallelogram-alt' | 'trapezoid' | 'trapezoid-alt'
export type EdgeStyle = 'solid' | 'dotted' | 'thick'
export type EdgeArrow = 'arrow' | 'open' | 'circle' | 'cross'

// ─── Node & Edge State (SSOT) ────────────────────────────────────────────────

export interface NodeState {
  id: string
  x: number
  y: number
  width: number
  height: number
  label: string
  shape: NodeShape
  subgraphId?: string  // 所属子图
}

export interface EdgeState {
  id: string           // 内部生成的稳定 ID
  fromNodeId: string
  toNodeId: string
  label: string
  style: EdgeStyle     // solid / dotted / thick
  arrow: EdgeArrow     // arrow / open / circle / cross
}

export interface SubgraphState {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  children: string[]   // node ids
}

// ─── Store ───────────────────────────────────────────────────────────────────

const MAX_HISTORY = 80
let _edgeCounter = 0
export function genEdgeId(): string {
  return `e_${Date.now().toString(36)}_${(_edgeCounter++).toString(36)}`
}

interface SvgEditorState {
  // ─── SSOT: 节点、边、子图 ───
  nodes: NodeState[]
  edges: EdgeState[]
  subgraphs: SubgraphState[]

  // ─── 选中 ───
  selectedNodeIds: Set<string>
  selectedEdgeId: string | null

  // ─── 画布视图 ───
  viewTransform: { x: number; y: number; scale: number }

  // ─── 图表设置 ───
  direction: Direction
  theme: Theme
  look: Look
  curveStyle: CurveStyle
  showGrid: boolean

  // ─── 交互模式 ───
  interactionMode: 'select' | 'pan' | 'connect'
  pendingAddShape: string | null

  // ─── 编辑状态 ───
  editingNodeId: string | null
  contextMenu: { x: number; y: number; nodeId?: string; edgeId?: string } | null

  // ─── 连线状态 ───
  connecting: {
    sourceId: string
    sourceHandle: HandleDir
    mousePos: { x: number; y: number }
  } | null
  hoveredNodeId: string | null

  // ─── 撤销/重做（基于 mermaid 代码快照） ───
  codeHistory: string[]
  codeFuture: string[]

  // ─── Node Actions ───
  setNodes: (nodes: NodeState[]) => void
  updateNode: (id: string, patch: Partial<NodeState>) => void
  moveNode: (id: string, x: number, y: number) => void
  removeNode: (id: string) => void
  addNodeState: (node: NodeState) => void

  // ─── Edge Actions ───
  setEdges: (edges: EdgeState[]) => void
  addEdgeState: (edge: Omit<EdgeState, 'id'>) => EdgeState
  updateEdge: (id: string, patch: Partial<EdgeState>) => void
  removeEdge: (id: string) => void
  reverseEdge: (id: string) => void

  // ─── Subgraph Actions ───
  setSubgraphs: (subgraphs: SubgraphState[]) => void

  // ─── Selection Actions ───
  selectNode: (id: string, multi?: boolean) => void
  selectEdge: (id: string) => void
  clearSelection: () => void

  // ─── View Actions ───
  setViewTransform: (t: { x: number; y: number; scale: number }) => void
  zoomTo: (scale: number, cx?: number, cy?: number) => void

  // ─── Settings Actions ───
  setInteractionMode: (mode: 'select' | 'pan' | 'connect') => void
  setPendingAddShape: (shape: string | null) => void
  setEditingNode: (id: string | null) => void
  setContextMenu: (menu: { x: number; y: number; nodeId?: string; edgeId?: string } | null) => void
  setDirection: (d: Direction) => void
  setTheme: (t: Theme) => void
  setLook: (l: Look) => void
  setCurveStyle: (c: CurveStyle) => void
  setShowGrid: (s: boolean) => void

  // ─── History Actions ───
  pushHistory: (code: string) => void
  undo: () => string | null
  redo: () => string | null

  // ─── Connection Actions ───
  startConnection: (sourceId: string, sourceHandle: HandleDir) => void
  updateConnectionMouse: (x: number, y: number) => void
  endConnection: (targetId: string, targetHandle: HandleDir) => void
  cancelConnection: () => void
  setHoveredNodeId: (id: string | null) => void

  // ─── Bulk init from SVG scan ───
  initFromScan: (nodes: NodeState[], edges: EdgeState[], subgraphs: SubgraphState[]) => void
}

export const useSvgEditorStore = create<SvgEditorState>((set, get) => ({
  // ─── Initial State ───
  nodes: [],
  edges: [],
  subgraphs: [],
  selectedNodeIds: new Set(),
  selectedEdgeId: null,
  viewTransform: { x: 0, y: 0, scale: 1 },
  direction: 'TB',
  theme: 'default',
  look: 'classic',
  curveStyle: 'basis',
  showGrid: true,
  interactionMode: 'select',
  pendingAddShape: null,
  editingNodeId: null,
  contextMenu: null,
  connecting: null,
  hoveredNodeId: null,
  codeHistory: [],
  codeFuture: [],

  // ─── Node Actions ───
  setNodes: (nodes) => set({ nodes }),

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
      edges: edges.filter(e => e.fromNodeId !== id && e.toNodeId !== id),
      selectedNodeIds: new Set(),
    })
  },

  addNodeState: (node) => set({ nodes: [...get().nodes, node] }),

  // ─── Edge Actions ───
  setEdges: (edges) => set({ edges }),

  addEdgeState: (edgeData) => {
    const edge: EdgeState = { ...edgeData, id: genEdgeId() }
    set({ edges: [...get().edges, edge] })
    return edge
  },

  updateEdge: (id, patch) => set({
    edges: get().edges.map(e => e.id === id ? { ...e, ...patch } : e),
  }),

  removeEdge: (id) => set({
    edges: get().edges.filter(e => e.id !== id),
    selectedEdgeId: null,
  }),

  reverseEdge: (id) => set({
    edges: get().edges.map(e =>
      e.id === id ? { ...e, fromNodeId: e.toNodeId, toNodeId: e.fromNodeId } : e
    ),
  }),

  // ─── Subgraph Actions ───
  setSubgraphs: (subgraphs) => set({ subgraphs }),

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

  // ─── Settings Actions ───
  setInteractionMode: (mode) => set({ interactionMode: mode }),
  setPendingAddShape: (shape) => set({ pendingAddShape: shape }),
  setEditingNode: (id) => set({ editingNodeId: id }),
  setContextMenu: (menu) => set({ contextMenu: menu }),
  setDirection: (d) => set({ direction: d }),
  setTheme: (t) => set({ theme: t }),
  setLook: (l) => set({ look: l }),
  setCurveStyle: (c) => set({ curveStyle: c }),
  setShowGrid: (s) => set({ showGrid: s }),

  // ─── History Actions ───
  pushHistory: (code) => {
    const { codeHistory } = get()
    set({
      codeHistory: [...codeHistory.slice(-(MAX_HISTORY - 1)), code],
      codeFuture: [],
    })
  },

  undo: () => {
    const { codeHistory, codeFuture } = get()
    if (codeHistory.length === 0) return null
    const prev = codeHistory[codeHistory.length - 1]
    set({
      codeHistory: codeHistory.slice(0, -1),
      codeFuture: [prev, ...codeFuture.slice(0, MAX_HISTORY - 1)],
    })
    return prev
  },

  redo: () => {
    const { codeHistory, codeFuture } = get()
    if (codeFuture.length === 0) return null
    const next = codeFuture[0]
    set({
      codeHistory: [...codeHistory.slice(-(MAX_HISTORY - 1)), next],
      codeFuture: codeFuture.slice(1),
    })
    return next
  },

  // ─── Connection Actions ───
  startConnection: (sourceId, sourceHandle) => {
    set({
      connecting: { sourceId, sourceHandle, mousePos: { x: 0, y: 0 } },
      interactionMode: 'connect',
    })
  },

  updateConnectionMouse: (x, y) => {
    const { connecting } = get()
    if (!connecting) return
    set({ connecting: { ...connecting, mousePos: { x, y } } })
  },

  endConnection: (targetId, targetHandle) => {
    set({ connecting: null, interactionMode: 'select' })
  },

  cancelConnection: () => {
    set({ connecting: null, interactionMode: 'select' })
  },

  setHoveredNodeId: (id) => set({ hoveredNodeId: id }),

  // ─── Bulk init ───
  initFromScan: (nodes, edges, subgraphs) => {
    // 用旧状态做位置恢复
    const oldNodes = get().nodes
    const oldMap = new Map(oldNodes.map(n => [n.id, n]))

    const mergedNodes = nodes.map(n => {
      const old = oldMap.get(n.id)
      if (old) {
        // 保留旧的位置（用户可能拖拽过）
        return { ...n, x: old.x, y: old.y }
      }
      return n
    })

    set({ nodes: mergedNodes, edges, subgraphs })
  },
}))
