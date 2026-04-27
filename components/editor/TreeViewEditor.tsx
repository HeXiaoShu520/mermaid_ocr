'use client'

import { useState, useCallback, useRef } from 'react'
import type { TreeViewData, TreeNode } from '@/lib/treeViewParser'

interface TreeViewEditorProps {
  data: TreeViewData
  onUpdate: (data: TreeViewData) => void
}

let _nodeCounter = 1000

function genId() {
  return `tree-${++_nodeCounter}`
}

// 深拷贝树节点
function cloneTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.map(n => ({ ...n, children: cloneTree(n.children) }))
}

// 在树中找到节点并执行操作，返回新树
function mapTree(nodes: TreeNode[], fn: (node: TreeNode, parent: TreeNode | null) => TreeNode | null, parent: TreeNode | null = null): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    const mapped = fn(node, parent)
    if (mapped === null) continue // null = 删除
    result.push({ ...mapped, children: mapTree(mapped.children, fn, node) })
  }
  return result
}

// 找到节点的父节点
function findParent(nodes: TreeNode[], targetId: string, parent: TreeNode | null = null): TreeNode | null {
  for (const node of nodes) {
    if (node.children.some(c => c.id === targetId)) return node
    const found = findParent(node.children, targetId, node)
    if (found) return found
  }
  return null
}

// 找到节点
function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
  return null
}

// 在指定节点后插入兄弟节点
function insertAfter(nodes: TreeNode[], targetId: string, newNode: TreeNode): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    result.push({ ...node, children: insertAfter(node.children, targetId, newNode) })
    if (node.id === targetId) result.push(newNode)
  }
  return result
}

// 移动节点（上移/下移）
function moveNode(nodes: TreeNode[], targetId: string, direction: 'up' | 'down'): TreeNode[] {
  const result = [...nodes]
  const idx = result.findIndex(n => n.id === targetId)
  if (idx >= 0) {
    if (direction === 'up' && idx > 0) {
      ;[result[idx - 1], result[idx]] = [result[idx], result[idx - 1]]
    } else if (direction === 'down' && idx < result.length - 1) {
      ;[result[idx], result[idx + 1]] = [result[idx + 1], result[idx]]
    }
    return result
  }
  return nodes.map(n => ({ ...n, children: moveNode(n.children, targetId, direction) }))
}

// 缩进节点（变为前一个兄弟的子节点）
function indentNode(nodes: TreeNode[], targetId: string): TreeNode[] {
  const idx = nodes.findIndex(n => n.id === targetId)
  if (idx > 0) {
    const target = nodes[idx]
    const prev = nodes[idx - 1]
    const newNodes = nodes.filter((_, i) => i !== idx)
    newNodes[idx - 1] = { ...prev, children: [...prev.children, target] }
    return newNodes
  }
  return nodes.map(n => ({ ...n, children: indentNode(n.children, targetId) }))
}

// 取消缩进节点（移到父节点的兄弟位置）
function outdentNode(root: TreeNode[], targetId: string): TreeNode[] {
  const parent = findParent(root, targetId)
  if (!parent) return root // 已是根节点

  const target = parent.children.find(c => c.id === targetId)!
  const grandParent = findParent(root, parent.id)

  if (!grandParent) {
    // 父节点是根节点，把 target 提升到根
    const parentIdx = root.findIndex(n => n.id === parent.id)
    const newRoot = root.map(n =>
      n.id === parent.id ? { ...n, children: n.children.filter(c => c.id !== targetId) } : n
    )
    newRoot.splice(parentIdx + 1, 0, target)
    return newRoot
  }

  // 把 target 插入到 grandParent.children 中 parent 之后
  return root.map(n => ({
    ...n,
    children: outdentNodeInChildren(n.children, targetId, parent.id, target),
  }))
}

function outdentNodeInChildren(nodes: TreeNode[], targetId: string, parentId: string, target: TreeNode): TreeNode[] {
  const result: TreeNode[] = []
  for (const node of nodes) {
    if (node.id === parentId) {
      result.push({ ...node, children: node.children.filter(c => c.id !== targetId) })
      result.push(target)
    } else {
      result.push({ ...node, children: outdentNodeInChildren(node.children, targetId, parentId, target) })
    }
  }
  return result
}

const DEPTH_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16',
]

// ─── 单个树节点渲染 ────────────────────────────────────────────────────────────
interface TreeNodeItemProps {
  node: TreeNode
  depth: number
  selectedId: string | null
  editingId: string | null
  draft: string
  onSelect: (id: string) => void
  onStartEdit: (id: string, label: string) => void
  onCommitEdit: () => void
  onDraftChange: (v: string) => void
  onAddChild: (parentId: string) => void
  onAddSibling: (id: string) => void
  onDelete: (id: string) => void
  onMove: (id: string, dir: 'up' | 'down') => void
  onIndent: (id: string) => void
  onOutdent: (id: string) => void
  isFirst: boolean
  isLast: boolean
}

function TreeNodeItem({
  node, depth, selectedId, editingId, draft,
  onSelect, onStartEdit, onCommitEdit, onDraftChange,
  onAddChild, onAddSibling, onDelete, onMove, onIndent, onOutdent,
  isFirst, isLast,
}: TreeNodeItemProps) {
  const isSelected = selectedId === node.id
  const isEditing = editingId === node.id
  const hasChildren = node.children.length > 0
  const [collapsed, setCollapsed] = useState(false)
  const color = DEPTH_COLORS[depth % DEPTH_COLORS.length]

  return (
    <div style={{ marginLeft: depth === 0 ? 0 : 20 }}>
      <div
        className={`flex items-center gap-1 rounded px-2 py-1 cursor-pointer group transition-colors ${
          isSelected ? 'ring-2 ring-blue-400 bg-blue-50' : 'hover:bg-gray-100'
        }`}
        onClick={(e) => { e.stopPropagation(); onSelect(node.id) }}
        onDoubleClick={() => onStartEdit(node.id, node.label)}
      >
        {/* 折叠按钮 */}
        {hasChildren ? (
          <button
            className="text-gray-400 hover:text-gray-600 w-4 text-xs flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed) }}
          >
            {collapsed ? '▶' : '▼'}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* 颜色条 */}
        <div className="w-2 h-4 rounded-sm flex-shrink-0" style={{ background: color }} />

        {/* 标签 */}
        {isEditing ? (
          <input
            autoFocus
            className="flex-1 text-sm bg-white border border-blue-300 rounded px-1 outline-none"
            value={draft}
            onChange={e => onDraftChange(e.target.value)}
            onBlur={onCommitEdit}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Enter') onCommitEdit()
              if (e.key === 'Escape') onCommitEdit()
              if (e.key === 'Tab') { e.preventDefault(); onCommitEdit(); onAddChild(node.id) }
            }}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 text-sm truncate text-gray-700" title={node.label}>{node.label}</span>
        )}

        {/* 操作按钮（hover 显示） */}
        {!isEditing && (
          <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
            <button
              className="text-[10px] text-blue-500 hover:text-blue-700 px-1"
              title="添加子节点"
              onClick={(e) => { e.stopPropagation(); onAddChild(node.id) }}
            >+</button>
            <button
              className="text-[10px] text-red-400 hover:text-red-600 px-1"
              title="删除"
              onClick={(e) => { e.stopPropagation(); onDelete(node.id) }}
            >×</button>
          </div>
        )}
      </div>

      {/* 子节点 */}
      {!collapsed && hasChildren && (
        <div className="border-l border-gray-200 ml-3">
          {node.children.map((child, idx) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              editingId={editingId}
              draft={draft}
              onSelect={onSelect}
              onStartEdit={onStartEdit}
              onCommitEdit={onCommitEdit}
              onDraftChange={onDraftChange}
              onAddChild={onAddChild}
              onAddSibling={onAddSibling}
              onDelete={onDelete}
              onMove={onMove}
              onIndent={onIndent}
              onOutdent={onOutdent}
              isFirst={idx === 0}
              isLast={idx === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 主编辑器 ──────────────────────────────────────────────────────────────────
export function TreeViewEditor({ data, onUpdate }: TreeViewEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const startEdit = useCallback((id: string, label: string) => {
    setEditingId(id)
    setDraft(label)
  }, [])

  const commitEdit = useCallback(() => {
    if (!editingId) return
    const trimmed = draft.trim()
    if (!trimmed) { setEditingId(null); return }
    const newRoot = mapTree(data.root, node =>
      node.id === editingId ? { ...node, label: trimmed } : node
    )
    onUpdate({ root: newRoot })
    setEditingId(null)
  }, [editingId, draft, data, onUpdate])

  const addChild = useCallback((parentId: string) => {
    const newNode: TreeNode = { id: genId(), label: '新节点', children: [], level: 0 }
    const newRoot = mapTree(data.root, node =>
      node.id === parentId ? { ...node, children: [...node.children, newNode] } : node
    )
    onUpdate({ root: newRoot })
    setSelectedId(newNode.id)
    setTimeout(() => startEdit(newNode.id, newNode.label), 50)
  }, [data, onUpdate, startEdit])

  const addSibling = useCallback((id: string) => {
    const newNode: TreeNode = { id: genId(), label: '新节点', children: [], level: 0 }
    const newRoot = insertAfter(data.root, id, newNode)
    onUpdate({ root: newRoot })
    setSelectedId(newNode.id)
    setTimeout(() => startEdit(newNode.id, newNode.label), 50)
  }, [data, onUpdate, startEdit])

  const addRoot = useCallback(() => {
    const newNode: TreeNode = { id: genId(), label: '新节点', children: [], level: 0 }
    onUpdate({ root: [...data.root, newNode] })
    setSelectedId(newNode.id)
    setTimeout(() => startEdit(newNode.id, newNode.label), 50)
  }, [data, onUpdate, startEdit])

  const deleteNode = useCallback((id: string) => {
    const newRoot = mapTree(data.root, node => node.id === id ? null : node)
    onUpdate({ root: newRoot })
    if (selectedId === id) setSelectedId(null)
  }, [data, onUpdate, selectedId])

  const handleMove = useCallback((id: string, dir: 'up' | 'down') => {
    onUpdate({ root: moveNode(data.root, id, dir) })
  }, [data, onUpdate])

  const handleIndent = useCallback((id: string) => {
    onUpdate({ root: indentNode(data.root, id) })
  }, [data, onUpdate])

  const handleOutdent = useCallback((id: string) => {
    onUpdate({ root: outdentNode(data.root, id) })
  }, [data, onUpdate])

  const selectedNode = selectedId ? findNode(data.root, selectedId) : null
  const selectedParent = selectedId ? findParent(data.root, selectedId) : null

  return (
    <div className="flex h-full">
      {/* 树形画布 */}
      <div
        className="flex-1 overflow-auto p-4"
        onClick={() => { setSelectedId(null); setEditingId(null) }}
      >
        <div className="min-w-[300px]">
          {data.root.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-3">
              <div style={{ fontSize: 48 }}>🌳</div>
              <div className="text-sm">点击右侧"添加根节点"开始</div>
            </div>
          ) : (
            data.root.map((node, idx) => (
              <TreeNodeItem
                key={node.id}
                node={node}
                depth={0}
                selectedId={selectedId}
                editingId={editingId}
                draft={draft}
                onSelect={setSelectedId}
                onStartEdit={startEdit}
                onCommitEdit={commitEdit}
                onDraftChange={setDraft}
                onAddChild={addChild}
                onAddSibling={addSibling}
                onDelete={deleteNode}
                onMove={handleMove}
                onIndent={handleIndent}
                onOutdent={handleOutdent}
                isFirst={idx === 0}
                isLast={idx === data.root.length - 1}
              />
            ))
          )}
        </div>
      </div>

      {/* 右侧属性面板 */}
      <div className="w-56 border-l bg-gray-50 overflow-y-auto p-3 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">树形图</span>
          <button
            onClick={addRoot}
            className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            + 根节点
          </button>
        </div>

        {selectedNode ? (
          <>
            <div className="border-t pt-3 flex flex-col gap-2">
              <div className="text-xs font-semibold text-gray-600">节点属性</div>

              <label className="text-xs text-gray-500">
                标签
                <input
                  className="w-full mt-0.5 px-2 py-1 border rounded text-xs"
                  value={editingId === selectedNode.id ? draft : selectedNode.label}
                  onChange={e => {
                    if (editingId !== selectedNode.id) {
                      setEditingId(selectedNode.id)
                      setDraft(e.target.value)
                    } else {
                      setDraft(e.target.value)
                    }
                  }}
                  onBlur={commitEdit}
                  onKeyDown={e => {
                    e.stopPropagation()
                    if (e.key === 'Enter') commitEdit()
                  }}
                />
              </label>

              <div className="text-xs text-gray-400">
                子节点数: {selectedNode.children.length}
              </div>
            </div>

            <div className="border-t pt-3 flex flex-col gap-1.5">
              <div className="text-xs font-semibold text-gray-600">操作</div>
              <button
                onClick={() => addChild(selectedNode.id)}
                className="text-xs px-2 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded hover:bg-green-100 transition-colors text-left"
              >
                + 添加子节点
              </button>
              <button
                onClick={() => addSibling(selectedNode.id)}
                className="text-xs px-2 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 transition-colors text-left"
              >
                + 添加兄弟节点
              </button>
              <div className="flex gap-1">
                <button
                  onClick={() => handleMove(selectedNode.id, 'up')}
                  className="flex-1 text-xs px-2 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                  title="上移"
                >↑ 上移</button>
                <button
                  onClick={() => handleMove(selectedNode.id, 'down')}
                  className="flex-1 text-xs px-2 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                  title="下移"
                >↓ 下移</button>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleOutdent(selectedNode.id)}
                  className="flex-1 text-xs px-2 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                  title="减少缩进（提升层级）"
                >← 提升</button>
                <button
                  onClick={() => handleIndent(selectedNode.id)}
                  className="flex-1 text-xs px-2 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                  title="增加缩进（降低层级）"
                >→ 降级</button>
              </div>
              <button
                onClick={() => deleteNode(selectedNode.id)}
                className="text-xs px-2 py-1.5 bg-red-50 text-red-500 border border-red-200 rounded hover:bg-red-100 transition-colors text-left"
              >
                删除节点
              </button>
            </div>
          </>
        ) : (
          <div className="text-xs text-gray-400 text-center py-4">
            点击节点查看属性<br />双击节点编辑标签
          </div>
        )}

        <div className="border-t pt-3">
          <div className="text-xs text-gray-400 leading-relaxed">
            提示：<br />
            · 双击节点编辑标签<br />
            · 悬停节点显示操作按钮<br />
            · Tab 键快速添加子节点
          </div>
        </div>
      </div>
    </div>
  )
}
