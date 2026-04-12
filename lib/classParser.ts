import { type Edge, type Node, MarkerType } from '@xyflow/react'
import type { FlowEdgeData, FlowNodeData } from './flowStore'
import { applyDagreLayout } from './layout'

export interface ClassParseResult {
  nodes: Node<FlowNodeData>[]
  edges: Edge<FlowEdgeData>[]
  error: string | null
}

// Class relationship types → arrowType + edgeStyle mapping
// inheritance: --|>  composition: --*  aggregation: --o  dependency: -->  association: --  realization: ..|>
const CLASS_RELATIONS: { pattern: RegExp; arrowType: string; edgeStyle: string; label?: string }[] = [
  { pattern: /^\s*(\w+)\s*\.\.\|>\s*(\w+)/, arrowType: 'arrow', edgeStyle: 'dashed' },   // realization
  { pattern: /^\s*(\w+)\s*--\|>\s*(\w+)/, arrowType: 'arrow', edgeStyle: 'solid' },       // inheritance
  { pattern: /^\s*(\w+)\s*--\*\s*(\w+)/, arrowType: 'circle', edgeStyle: 'solid' },       // composition
  { pattern: /^\s*(\w+)\s*--o\s*(\w+)/, arrowType: 'circle', edgeStyle: 'solid' },        // aggregation
  { pattern: /^\s*(\w+)\s*-->\s*(\w+)/, arrowType: 'arrow', edgeStyle: 'solid' },         // dependency
  { pattern: /^\s*(\w+)\s*\.\.\s*(\w+)/, arrowType: 'none', edgeStyle: 'dashed' },        // dotted
  { pattern: /^\s*(\w+)\s*--\s*(\w+)/, arrowType: 'none', edgeStyle: 'solid' },           // association
]

export function parseMermaidClassDiagram(syntax: string): ClassParseResult {
  const empty: ClassParseResult = { nodes: [], edges: [], error: null }
  try {
    const lines = syntax.split('\n').map(l => l.trim()).filter(Boolean)
    const nodesMap = new Map<string, Node<FlowNodeData>>()
    const edges: Edge<FlowEdgeData>[] = []
    let edgeIdx = 0
    let currentClass: string | null = null
    let memberLines: string[] = []

    const flushClass = () => {
      if (!currentClass) return
      const label = memberLines.length > 0
        ? `${currentClass}\n${memberLines.join('\n')}`
        : currentClass
      nodesMap.set(currentClass, {
        id: currentClass,
        type: 'flowNode',
        position: { x: 0, y: 0 },
        data: { label, shape: 'subroutine' },
      })
      currentClass = null
      memberLines = []
    }

    for (const line of lines) {
      if (/^classDiagram/.test(line)) continue
      if (/^%%/.test(line)) continue

      // class Foo { ... } single line
      const singleClass = line.match(/^class\s+(\w+)\s*\{([^}]*)\}/)
      if (singleClass) {
        const [, name, body] = singleClass
        const members = body.split(/[;\n]/).map(s => s.trim()).filter(Boolean)
        const label = members.length > 0 ? `${name}\n${members.join('\n')}` : name
        nodesMap.set(name, {
          id: name, type: 'flowNode', position: { x: 0, y: 0 },
          data: { label, shape: 'subroutine' },
        })
        continue
      }

      // class Foo {
      const classOpen = line.match(/^class\s+(\w+)\s*\{?\s*$/)
      if (classOpen) {
        flushClass()
        currentClass = classOpen[1]
        memberLines = []
        continue
      }

      // closing brace
      if (line === '}') {
        flushClass()
        continue
      }

      // inside class body
      if (currentClass) {
        if (line !== '{') memberLines.push(line)
        continue
      }

      // bare class name (no body)
      const bareClass = line.match(/^class\s+(\w+)\s*$/)
      if (bareClass) {
        const name = bareClass[1]
        if (!nodesMap.has(name)) {
          nodesMap.set(name, {
            id: name, type: 'flowNode', position: { x: 0, y: 0 },
            data: { label: name, shape: 'subroutine' },
          })
        }
        continue
      }

      // relationship lines
      for (const rel of CLASS_RELATIONS) {
        const m = line.match(rel.pattern)
        if (m) {
          const [, src, tgt] = m
          // ensure both nodes exist
          for (const id of [src, tgt]) {
            if (!nodesMap.has(id)) {
              nodesMap.set(id, {
                id, type: 'flowNode', position: { x: 0, y: 0 },
                data: { label: id, shape: 'subroutine' },
              })
            }
          }
          // extract optional label after ":"
          const labelMatch = line.match(/:\s*"?([^"]+)"?\s*$/)
          const edgeLabel = labelMatch ? labelMatch[1].trim() : undefined
          edges.push({
            id: `edge_${edgeIdx++}`,
            source: src, target: tgt,
            type: 'flowEdge',
            label: edgeLabel,
            markerEnd: rel.arrowType !== 'none' ? { type: MarkerType.ArrowClosed, color: '#9ca3af' } : undefined,
            data: { edgeStyle: rel.edgeStyle as any, arrowType: rel.arrowType as any },
          })
          break
        }
      }
    }

    flushClass()

    if (nodesMap.size === 0) return { ...empty, error: '未找到类定义' }

    const nodes = applyDagreLayout([...nodesMap.values()], edges, 'TD')
    return { nodes, edges, error: null }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : '解析错误' }
  }
}
