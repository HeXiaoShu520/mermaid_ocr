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
  selectedSubgraphId: string | null

  // ─── 视图变换 ───
  viewTransform: { x: number; y: number; scale: number }

  // ─── 交互状态 ───
  connecting: ConnectionState | null
  hoveredNodeId: string | null
  editingNodeId: string | null
  editingEdgeId: string | null
  contextMenu: { x: number; y: number; nodeId?: string; edgeId?: string; subgraphId?: string } | null

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
  renameNode: (oldId: string, newId: string) => void
  moveNode: (id: string, x: number, y: number) => void
  removeNode: (id: string) => void
  addNode: (node: NodeState) => void

  addEdge: (edge: EdgeState) => void
  updateEdge: (id: string, patch: Partial<EdgeState>) => void
  removeEdge: (id: string) => void
  reverseEdge: (id: string) => void

  selectNode: (id: string, multi?: boolean) => void
  selectEdge: (id: string) => void
  selectSubgraph: (id: string | null) => void
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

  moveSubgraph: (subgraphId: string, dx: number, dy: number) => void

  pushHistory: (code: string) => void
  undo: () => string | null
  redo: () => string | null

  // ─── 批量初始化 ───
  initGraph: (nodes: NodeState[], edges: EdgeState[], layout: LayoutMetadata | null, subgraphs?: SubgraphState[]) => void
  resolveSubgraphOverlaps: () => void
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
  selectedSubgraphId: null,
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

  renameNode: (oldId, newId) => {
    if (oldId === newId) return
    const { nodes, edges, subgraphs, selectedNodeIds } = get()
    // 检查新 id 是否已存在
    if (nodes.some(n => n.id === newId)) return
    set({
      nodes: nodes.map(n => n.id === oldId ? { ...n, id: newId } : n),
      edges: edges.map(e => ({
        ...e,
        source: e.source === oldId ? newId : e.source,
        target: e.target === oldId ? newId : e.target,
      })),
      subgraphs: subgraphs.map(sg => ({
        ...sg,
        nodes: sg.nodes?.map((nid: string) => nid === oldId ? newId : nid),
      })),
      selectedNodeIds: selectedNodeIds.has(oldId)
        ? new Set([...selectedNodeIds].map(id => id === oldId ? newId : id))
        : selectedNodeIds,
    })
  },

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
      set({ selectedNodeIds: next, selectedEdgeId: null, selectedSubgraphId: null })
    } else {
      set({ selectedNodeIds: new Set([id]), selectedEdgeId: null, selectedSubgraphId: null })
    }
  },

  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeIds: new Set(), selectedSubgraphId: null }),

  selectSubgraph: (id) => set({ selectedSubgraphId: id, selectedNodeIds: new Set(), selectedEdgeId: null }),

  clearSelection: () => set({ selectedNodeIds: new Set(), selectedEdgeId: null, selectedSubgraphId: null }),

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

  moveSubgraph: (subgraphId, dx, dy) => {
    const { nodes, subgraphs } = get()
    const sg = subgraphs.find(s => s.id === subgraphId)
    if (!sg) return

    // 计算当前子图的边界框
    const sgNodes = nodes.filter(n => n.subgraph === subgraphId)
    if (sgNodes.length === 0) return

    const padding = 20
    const titleHeight = 30
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    sgNodes.forEach(n => {
      minX = Math.min(minX, n.x)
      minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + n.width)
      maxY = Math.max(maxY, n.y + n.height)
    })
    const sgBounds = {
      x: minX - padding + dx,
      y: minY - padding - titleHeight + dy,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2 + titleHeight,
    }

    // 碰撞检测：检查是否与其他子图重叠
    for (const otherSg of subgraphs) {
      if (otherSg.id === subgraphId) continue
      const otherNodes = nodes.filter(n => n.subgraph === otherSg.id)
      if (otherNodes.length === 0) continue

      let oMinX = Infinity, oMinY = Infinity, oMaxX = -Infinity, oMaxY = -Infinity
      otherNodes.forEach(n => {
        oMinX = Math.min(oMinX, n.x)
        oMinY = Math.min(oMinY, n.y)
        oMaxX = Math.max(oMaxX, n.x + n.width)
        oMaxY = Math.max(oMaxY, n.y + n.height)
      })
      const otherBounds = {
        x: oMinX - padding,
        y: oMinY - padding - titleHeight,
        width: oMaxX - oMinX + padding * 2,
        height: oMaxY - oMinY + padding * 2 + titleHeight,
      }

      // AABB 碰撞检测
      const gap = 10 // 子图之间的最小间距
      if (
        sgBounds.x < otherBounds.x + otherBounds.width + gap &&
        sgBounds.x + sgBounds.width > otherBounds.x - gap &&
        sgBounds.y < otherBounds.y + otherBounds.height + gap &&
        sgBounds.y + sgBounds.height > otherBounds.y - gap
      ) {
        // 碰撞了，推开另一个子图
        // 计算推开方向：选择重叠最小的方向
        const overlapLeft = (sgBounds.x + sgBounds.width + gap) - otherBounds.x
        const overlapRight = (otherBounds.x + otherBounds.width + gap) - sgBounds.x
        const overlapTop = (sgBounds.y + sgBounds.height + gap) - otherBounds.y
        const overlapBottom = (otherBounds.y + otherBounds.height + gap) - sgBounds.y

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)
        let pushDx = 0, pushDy = 0

        if (minOverlap === overlapLeft) pushDx = overlapLeft
        else if (minOverlap === overlapRight) pushDx = -overlapRight
        else if (minOverlap === overlapTop) pushDy = overlapTop
        else pushDy = -overlapBottom

        // 移动被碰撞的子图的所有节点
        const updatedNodes = [...nodes]
        otherNodes.forEach(otherNode => {
          const idx = updatedNodes.findIndex(n => n.id === otherNode.id)
          if (idx !== -1) {
            updatedNodes[idx] = { ...updatedNodes[idx], x: updatedNodes[idx].x + pushDx, y: updatedNodes[idx].y + pushDy }
          }
        })

        // 同时移动当前子图的节点
        sgNodes.forEach(sgNode => {
          const idx = updatedNodes.findIndex(n => n.id === sgNode.id)
          if (idx !== -1) {
            updatedNodes[idx] = { ...updatedNodes[idx], x: updatedNodes[idx].x + dx, y: updatedNodes[idx].y + dy }
          }
        })

        set({ nodes: updatedNodes })
        return
      }
    }

    // 无碰撞，直接移动子图内所有节点
    set({
      nodes: nodes.map(n =>
        n.subgraph === subgraphId ? { ...n, x: n.x + dx, y: n.y + dy } : n
      ),
    })
  },

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
      selectedSubgraphId: null,
    })
    // 初始化后解决子图重叠
    if (subgraphs.length > 1) {
      setTimeout(() => get().resolveSubgraphOverlaps(), 0)
    }
  },

  resolveSubgraphOverlaps: () => {
    const { nodes, subgraphs } = get()
    if (subgraphs.length < 2) return

    const padding = 20
    const titleHeight = 30
    const gap = 10
    let updatedNodes = [...nodes]
    let changed = false

    // 计算每个子图的边界框
    const getBounds = (sgId: string) => {
      const sgNodes = updatedNodes.filter(n => n.subgraph === sgId)
      if (sgNodes.length === 0) return null
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      sgNodes.forEach(n => {
        minX = Math.min(minX, n.x)
        minY = Math.min(minY, n.y)
        maxX = Math.max(maxX, n.x + n.width)
        maxY = Math.max(maxY, n.y + n.height)
      })
      return {
        x: minX - padding,
        y: minY - padding - titleHeight,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2 + titleHeight,
      }
    }

    // 多轮迭代解决重叠（最多 10 轮）
    for (let iter = 0; iter < 10; iter++) {
      let iterChanged = false
      for (let i = 0; i < subgraphs.length; i++) {
        for (let j = i + 1; j < subgraphs.length; j++) {
          const boundsA = getBounds(subgraphs[i].id)
          const boundsB = getBounds(subgraphs[j].id)
          if (!boundsA || !boundsB) continue

          // AABB 碰撞检测
          if (
            boundsA.x < boundsB.x + boundsB.width + gap &&
            boundsA.x + boundsA.width > boundsB.x - gap &&
            boundsA.y < boundsB.y + boundsB.height + gap &&
            boundsA.y + boundsA.height > boundsB.y - gap
          ) {
            // 计算推开方向
            const overlapLeft = (boundsA.x + boundsA.width + gap) - boundsB.x
            const overlapRight = (boundsB.x + boundsB.width + gap) - boundsA.x
            const overlapTop = (boundsA.y + boundsA.height + gap) - boundsB.y
            const overlapBottom = (boundsB.y + boundsB.height + gap) - boundsA.y

            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom)
            let pushDx = 0, pushDy = 0

            if (minOverlap === overlapLeft) pushDx = overlapLeft
            else if (minOverlap === overlapRight) pushDx = -overlapRight
            else if (minOverlap === overlapTop) pushDy = overlapTop
            else pushDy = -overlapBottom

            // 推开子图 B 的所有节点
            updatedNodes = updatedNodes.map(n =>
              n.subgraph === subgraphs[j].id
                ? { ...n, x: n.x + pushDx, y: n.y + pushDy }
                : n
            )
            iterChanged = true
            changed = true
          }
        }
      }
      if (!iterChanged) break
    }

    if (changed) {
      set({ nodes: updatedNodes })
    }
  },
}))
