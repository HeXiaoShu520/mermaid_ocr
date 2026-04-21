'use client'

import { useState, useCallback, useRef } from 'react'
import type { MindmapData, MindmapNode, MindmapShape } from '@/lib/mindmapParser'

interface MindmapEditorProps {
  data: MindmapData
  onUpdate: (data: MindmapData) => void
}

const SHAPE_LABELS: Record<MindmapShape, string> = {
  default: '默认',
  square: '方形 [ ]',
  rounded: '圆角 ( )',
  circle: '圆形 (( ))',
  bang: '感叹 ) (',
  cloud: '云形 {{ }}',
}

const SHAPE_COLORS: Record<MindmapShape, string> = {
  default: '#e2e8f0',
  square: '#bfdbfe',
  rounded: '#bbf7d0',
  circle: '#fde68a',
  bang: '#fecaca',
  cloud: '#e9d5ff',
}

const DEPTH_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16',
]

let _mmCounter = 1000

function cloneNode(n: MindmapNode): MindmapNode {
  return { ...n, children: n.children.map(cloneNode) }
}

function findAndUpdate(
  node: MindmapNode,
  id: string,
  updater: (n: MindmapNode) => MindmapNode | null
): MindmapNode | null {
  if (node.id === id) return updater(node)
  const newChildren: MindmapNode[] = []
  for (const child of node.children) {
    const updated = findAndUpdate(child, id, updater)
    if (updated !== null) newChildren.push(updated)
    else newChildren.push(child)
  }
  return { ...node, children: newChildren }
}

function addChildTo(node: MindmapNode, parentId: string, newChild: MindmapNode): MindmapNode {
  if (node.id === parentId) {
    return { ...node, children: [...node.children, newChild] }
  }
  return { ...node, children: node.children.map(c => addChildTo(c, parentId, newChild)) }
}

// ─── Tree Node Component ───────────────────────────────────────────────────────

interface TreeNodeProps {
  node: MindmapNode
  selectedId: string | null
  onSelect: (id: string) => void
  onLabelChange: (id: string, label: string) => void
  onAddChild: (parentId: string) => void
  onDelete: (id: string) => void
  isRoot?: boolean
}

function TreeNode({ node, selectedId, onSelect, onLabelChange, onAddChild, onDelete, isRoot }: TreeNodeProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node.label)
  const [collapsed, setCollapsed] = useState(false)
  const isSelected = selectedId === node.id
  const color = DEPTH_COLORS[node.depth % DEPTH_COLORS.length]
  const bgColor = SHAPE_COLORS[node.shape]

  const commitEdit = () => {
    setEditing(false)
    if (draft.trim()) onLabelChange(node.id, draft.trim())
    else setDraft(node.label)
  }

  return (
    <div style={{ marginLeft: isRoot ? 0 : 20 }}>
      <div
        className={`flex items-center gap-1 rounded px-2 py-1 cursor-pointer group transition-colors ${
          isSelected ? 'ring-2 ring-blue-400' : 'hover:bg-gray-100'
        }`}
        style={{ background: isSelected ? bgColor : undefined }}
        onClick={() => onSelect(node.id)}
        onDoubleClick={() => { setEditing(true); setDraft(node.label) }}
      >
        {/* 折叠按钮 */}
        {node.children.length > 0 && (
          <button
            className="text-gray-400 hover:text-gray-600 w-4 text-xs flex-shrink-0"
            onClick={e => { e.stopPropagation(); setCollapsed(!collapsed) }}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        )}
        {node.children.length === 0 && <span className="w-4 flex-shrink-0" />}

        {/* 颜色条 */}
        <div className="w-2 h-4 rounded-sm flex-shrink-0" style={{ background: color }} />

        {/* 形状标记 */}
        <span className="text-[10px] text-gray-400 flex-shrink-0 w-5">
          {node.shape === 'square' ? '□' :
           node.shape === 'rounded' ? '○' :
           node.shape === 'circle' ? '◎' :
           node.shape === 'bang' ? '!' :
           node.shape === 'cloud' ? '☁' : '·'}
        </span>

        {/* 标签 */}
        {editing ? (
          <input
            autoFocus
            className="flex-1 text-sm bg-white border border-blue-300 rounded px-1 outline-none"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter') commitEdit()
              if (e.key === 'Escape') { setEditing(false); setDraft(node.label) }
              e.stopPropagation()
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm truncate" title={node.label}>{node.label}</span>
        )}

        {/* 操作按钮（hover 显示） */}
        <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
          <button
            className="text-[10px] text-blue-500 hover:text-blue-700 px-1"
            title="添加子节点"
            onClick={e => { e.stopPropagation(); onAddChild(node.id) }}
          >+</button>
          {!isRoot && (
            <button
              className="text-[10px] text-red-400 hover:text-red-600 px-1"
              title="删除节点"
              onClick={e => { e.stopPropagation(); onDelete(node.id) }}
            >×</button>
          )}
        </div>
      </div>

      {/* 子节点 */}
      {!collapsed && node.children.length > 0 && (
        <div className="border-l border-gray-200 ml-3">
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onLabelChange={onLabelChange}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Canvas Preview ────────────────────────────────────────────────────────────

const NODE_W = 100
const NODE_H = 36
const H_GAP = 60
const V_GAP = 14

interface LayoutNode {
  node: MindmapNode
  x: number
  y: number
  width: number
  height: number
}

function layoutTree(root: MindmapNode): { nodes: LayoutNode[]; width: number; height: number } {
  const result: LayoutNode[] = []

  function subtreeHeight(n: MindmapNode): number {
    if (n.children.length === 0) return NODE_H
    const childrenH = n.children.reduce((sum, c) => sum + subtreeHeight(c) + V_GAP, -V_GAP)
    return Math.max(NODE_H, childrenH)
  }

  function place(n: MindmapNode, x: number, y: number) {
    const sh = subtreeHeight(n)
    const ny = y + sh / 2 - NODE_H / 2
    result.push({ node: n, x, y: ny, width: NODE_W, height: NODE_H })

    if (n.children.length > 0) {
      let cy = y
      for (const child of n.children) {
        const csh = subtreeHeight(child)
        place(child, x + NODE_W + H_GAP, cy)
        cy += csh + V_GAP
      }
    }
  }

  place(root, 20, 20)

  const maxX = Math.max(...result.map(n => n.x + n.width)) + 20
  const maxY = Math.max(...result.map(n => n.y + n.height)) + 20
  return { nodes: result, width: maxX, height: maxY }
}

function CanvasPreview({ root, selectedId, onSelect }: {
  root: MindmapNode
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { nodes, width, height } = layoutTree(root)
  const nodeMap = new Map(nodes.map(n => [n.node.id, n]))

  const renderEdges = () => {
    const edges: React.ReactNode[] = []
    for (const ln of nodes) {
      for (const child of ln.node.children) {
        const cl = nodeMap.get(child.id)
        if (!cl) continue
        const x1 = ln.x + ln.width
        const y1 = ln.y + ln.height / 2
        const x2 = cl.x
        const y2 = cl.y + cl.height / 2
        const mx = (x1 + x2) / 2
        edges.push(
          <path
            key={`${ln.node.id}-${child.id}`}
            d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
            fill="none"
            stroke={DEPTH_COLORS[child.depth % DEPTH_COLORS.length]}
            strokeWidth={1.5}
            opacity={0.6}
          />
        )
      }
    }
    return edges
  }

  const renderNodes = () => nodes.map(ln => {
    const color = DEPTH_COLORS[ln.node.depth % DEPTH_COLORS.length]
    const bg = SHAPE_COLORS[ln.node.shape]
    const isSelected = selectedId === ln.node.id
    const rx = ln.node.shape === 'circle' ? ln.height / 2 :
               ln.node.shape === 'rounded' ? 12 :
               ln.node.shape === 'square' ? 2 : 6

    return (
      <g key={ln.node.id} onClick={() => onSelect(ln.node.id)} style={{ cursor: 'pointer' }}>
        <rect
          x={ln.x} y={ln.y} width={ln.width} height={ln.height}
          rx={rx} ry={rx}
          fill={bg}
          stroke={isSelected ? '#3b82f6' : color}
          strokeWidth={isSelected ? 2 : 1}
        />
        <text
          x={ln.x + ln.width / 2} y={ln.y + ln.height / 2}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={11} fill="#1f2937"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {ln.node.label.length > 10 ? ln.node.label.slice(0, 9) + '…' : ln.node.label}
        </text>
      </g>
    )
  })

  return (
    <svg width={width} height={height} style={{ minWidth: width }}>
      {renderEdges()}
      {renderNodes()}
    </svg>
  )
}

// ─── Main Editor ───────────────────────────────────────────────────────────────

export function MindmapEditor({ data, onUpdate }: MindmapEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'tree' | 'canvas'>('tree')

  const root = data.root

  const selectedNode = root ? (() => {
    const find = (n: MindmapNode): MindmapNode | null => {
      if (n.id === selectedId) return n
      for (const c of n.children) { const r = find(c); if (r) return r }
      return null
    }
    return find(root)
  })() : null

  const updateRoot = useCallback((newRoot: MindmapNode | null) => {
    onUpdate({ root: newRoot })
  }, [onUpdate])

  const handleLabelChange = useCallback((id: string, label: string) => {
    if (!root) return
    const newRoot = findAndUpdate(root, id, n => ({ ...n, label }))
    updateRoot(newRoot)
  }, [root, updateRoot])

  const handleShapeChange = useCallback((id: string, shape: MindmapShape) => {
    if (!root) return
    const newRoot = findAndUpdate(root, id, n => ({ ...n, shape }))
    updateRoot(newRoot)
  }, [root, updateRoot])

  const handleAddChild = useCallback((parentId: string) => {
    if (!root) return
    const newChild: MindmapNode = {
      id: `mm-${++_mmCounter}`,
      label: '新节点',
      shape: 'default',
      children: [],
      depth: 0,
    }
    // 计算 depth
    const findDepth = (n: MindmapNode): number => {
      if (n.id === parentId) return n.depth + 1
      for (const c of n.children) { const d = findDepth(c); if (d >= 0) return d }
      return -1
    }
    newChild.depth = findDepth(root)
    const newRoot = addChildTo(root, parentId, newChild)
    updateRoot(newRoot)
    setSelectedId(newChild.id)
  }, [root, updateRoot])

  const handleDelete = useCallback((id: string) => {
    if (!root) return
    const newRoot = findAndUpdate(root, id, () => null)
    updateRoot(newRoot)
    if (selectedId === id) setSelectedId(null)
  }, [root, updateRoot, selectedId])

  const handleAddRoot = useCallback(() => {
    const newRoot: MindmapNode = {
      id: `mm-${++_mmCounter}`,
      label: '根节点',
      shape: 'default',
      children: [],
      depth: 0,
    }
    updateRoot(newRoot)
    setSelectedId(newRoot.id)
  }, [updateRoot])

  if (!root) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
        <div style={{ fontSize: 64 }}>🧠</div>
        <div className="text-sm text-gray-500">点击"读取代码"加载思维导图</div>
        <button
          onClick={handleAddRoot}
          className="px-4 py-2 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600"
        >
          + 新建思维导图
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* 左侧树形视图 */}
      <div className="w-72 border-r bg-white flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-gray-50">
          <span className="text-xs font-semibold text-gray-600 flex-1">节点树</span>
          <button
            onClick={() => root && handleAddChild(root.id)}
            className="text-xs px-2 py-1 bg-indigo-500 text-white rounded hover:bg-indigo-600"
          >+ 添加子节点</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <TreeNode
            node={root}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onLabelChange={handleLabelChange}
            onAddChild={handleAddChild}
            onDelete={handleDelete}
            isRoot
          />
        </div>
      </div>

      {/* 中间画布预览 */}
      <div className="flex-1 overflow-auto bg-gray-50 p-4">
        <CanvasPreview root={root} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* 右侧属性面板 */}
      <div className="w-52 border-l bg-gray-50 p-3 flex flex-col gap-3 overflow-y-auto">
        <div className="text-xs font-semibold text-gray-600">节点属性</div>
        {selectedNode ? (
          <>
            <label className="text-xs text-gray-500">
              标签
              <input
                className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                value={selectedNode.label}
                onChange={e => handleLabelChange(selectedNode.id, e.target.value)}
                onKeyDown={e => e.stopPropagation()}
              />
            </label>
            <label className="text-xs text-gray-500">
              形状
              <select
                className="w-full mt-0.5 px-2 py-1 border rounded text-xs bg-white"
                value={selectedNode.shape}
                onChange={e => handleShapeChange(selectedNode.id, e.target.value as MindmapShape)}
              >
                {(Object.keys(SHAPE_LABELS) as MindmapShape[]).map(s => (
                  <option key={s} value={s}>{SHAPE_LABELS[s]}</option>
                ))}
              </select>
            </label>
            <div className="text-xs text-gray-400">层级：{selectedNode.depth}</div>
            <div className="text-xs text-gray-400">子节点：{selectedNode.children.length}</div>
            <button
              onClick={() => handleAddChild(selectedNode.id)}
              className="text-xs px-2 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-100"
            >+ 添加子节点</button>
            {selectedNode.id !== root?.id && (
              <button
                onClick={() => handleDelete(selectedNode.id)}
                className="text-xs px-2 py-1.5 bg-red-50 border border-red-200 text-red-600 rounded hover:bg-red-100"
              >删除节点</button>
            )}
          </>
        ) : (
          <div className="text-xs text-gray-400">点击节点查看属性</div>
        )}
      </div>
    </div>
  )
}
