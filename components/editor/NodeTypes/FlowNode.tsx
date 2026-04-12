'use client'

import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import { useCallback, useRef, useState, Fragment } from 'react'
import { useFlowStore, type FlowNodeData, type NodeShape } from '@/lib/flowStore'

// Shared resizer styles — larger handles for easier interaction
const RESIZER_HANDLE_STYLE: React.CSSProperties = { width: 8, height: 8, borderRadius: 2 }
const RESIZER_LINE_STYLE: React.CSSProperties = { borderWidth: 2 }

// ─── SVG shape paths (viewBox 0 0 200 100, preserveAspectRatio="none") ────────
// All points are in the 200×100 coordinate space so they stretch with the node.

function SvgHexagon({
  fill,
  stroke,
  sw,
}: {
  fill: string
  stroke: string
  sw: number
}) {
  return (
    <polygon
      points="50,2 150,2 198,50 150,98 50,98 2,50"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
    />
  )
}

function SvgParallelogram({
  fill,
  stroke,
  sw,
}: {
  fill: string
  stroke: string
  sw: number
}) {
  return (
    <polygon
      points="28,2 198,2 172,98 2,98"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
    />
  )
}

function SvgParallelogramAlt({
  fill,
  stroke,
  sw,
}: {
  fill: string
  stroke: string
  sw: number
}) {
  return (
    <polygon
      points="2,2 172,2 198,98 28,98"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
    />
  )
}

function SvgTrapezoid({
  fill,
  stroke,
  sw,
}: {
  fill: string
  stroke: string
  sw: number
}) {
  // Wider at top
  return (
    <polygon
      points="2,2 198,2 175,98 25,98"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
    />
  )
}

function SvgTrapezoidAlt({
  fill,
  stroke,
  sw,
}: {
  fill: string
  stroke: string
  sw: number
}) {
  // Wider at bottom
  return (
    <polygon
      points="25,2 175,2 198,98 2,98"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
    />
  )
}

function SvgAsymmetric({
  fill,
  stroke,
  sw,
}: {
  fill: string
  stroke: string
  sw: number
}) {
  return (
    <polygon
      points="2,2 178,2 198,50 178,98 2,98"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
    />
  )
}

function SvgCylinder({
  fill,
  stroke,
  sw,
}: {
  fill: string
  stroke: string
  sw: number
}) {
  return (
    <>
      <rect x={sw} y={16} width={200 - sw * 2} height={68} fill={fill} stroke="none" />
      <line x1={sw} y1={16} x2={sw} y2={84} stroke={stroke} strokeWidth={sw} />
      <line x1={200 - sw} y1={16} x2={200 - sw} y2={84} stroke={stroke} strokeWidth={sw} />
      <ellipse cx={100} cy={16} rx={100 - sw} ry={14} fill={fill} stroke={stroke} strokeWidth={sw} />
      <ellipse cx={100} cy={84} rx={100 - sw} ry={14} fill={fill} stroke={stroke} strokeWidth={sw} />
    </>
  )
}

function SvgDiamond({
  fill,
  stroke,
  sw,
}: {
  fill: string
  stroke: string
  sw: number
}) {
  // Vertices at cardinal midpoints of 200×100 viewBox — aligns with React Flow handles
  return (
    <polygon
      points="100,2 198,50 100,98 2,50"
      fill={fill}
      stroke={stroke}
      strokeWidth={sw}
    />
  )
}

// ─── Shape → SVG renderer map ─────────────────────────────────────────────────
type SvgShapeRenderer = (props: { fill: string; stroke: string; sw: number }) => React.ReactNode

function SvgTriangle({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <polygon points="100,2 198,98 2,98" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgFlipTri({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <polygon points="100,98 198,2 2,2" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgSmallCircle({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <circle cx={100} cy={50} r={20} fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgFramedCircle({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><circle cx={100} cy={50} r={46} fill={fill} stroke={stroke} strokeWidth={sw} /><circle cx={100} cy={50} r={28} fill={fill} stroke={stroke} strokeWidth={sw * 0.6} /></>
}
function SvgFilledCircle({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <circle cx={100} cy={50} r={40} fill={stroke} stroke={stroke} strokeWidth={sw} />
}
function SvgCrossedCircle({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><circle cx={100} cy={50} r={46} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={67} y1={17} x2={133} y2={83} stroke={stroke} strokeWidth={sw} /><line x1={133} y1={17} x2={67} y2={83} stroke={stroke} strokeWidth={sw} /></>
}
function SvgLinRect({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><rect x={sw} y={sw} width={200 - sw * 2} height={100 - sw * 2} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={30} y1={sw} x2={30} y2={100 - sw} stroke={stroke} strokeWidth={sw * 0.6} /></>
}
function SvgDivRect({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><rect x={sw} y={sw} width={200 - sw * 2} height={100 - sw * 2} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={sw} y1={75} x2={200 - sw} y2={75} stroke={stroke} strokeWidth={sw * 0.6} /></>
}
function SvgStRect({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><rect x={12} y={12} width={186} height={86} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} /><rect x={sw} y={sw} width={186} height={86} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} /></>
}
function SvgTagRect({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><rect x={sw} y={sw} width={200 - sw * 2} height={100 - sw * 2} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} /><polygon points="165,2 198,2 198,30" fill="none" stroke={stroke} strokeWidth={sw * 0.6} /></>
}
function SvgNotchRect({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <polygon points="2,2 198,2 198,98 2,98 2,70 20,70 20,30 2,30" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgSlRect({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <polygon points="2,20 198,2 198,98 2,98" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgHourglass({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <polygon points="2,2 198,2 2,98 198,98" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgFlag({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <polygon points="2,2 170,2 198,50 170,98 2,98" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgBowRect({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <path d="M30,2 L170,2 C190,2 190,50 170,50 C190,50 190,98 170,98 L30,98 C10,98 10,50 30,50 C10,50 10,2 30,2" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgNotchPent({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <polygon points="30,2 170,2 198,30 198,98 2,98 2,30" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgDelay({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <path d="M2,2 L150,2 C190,2 190,98 150,98 L2,98 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgHCyl({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><ellipse cx={30} cy={50} rx={20} ry={46} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={30} y1={4} x2={170} y2={4} stroke={stroke} strokeWidth={sw} /><line x1={30} y1={96} x2={170} y2={96} stroke={stroke} strokeWidth={sw} /><ellipse cx={170} cy={50} rx={20} ry={46} fill={fill} stroke={stroke} strokeWidth={sw} /></>
}
function SvgLinCyl({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><ellipse cx={100} cy={18} rx={96} ry={16} fill={fill} stroke={stroke} strokeWidth={sw} /><rect x={4} y={18} width={192} height={64} fill={fill} stroke="none" /><line x1={4} y1={18} x2={4} y2={82} stroke={stroke} strokeWidth={sw} /><line x1={196} y1={18} x2={196} y2={82} stroke={stroke} strokeWidth={sw} /><ellipse cx={100} cy={82} rx={96} ry={16} fill={fill} stroke={stroke} strokeWidth={sw} /><ellipse cx={100} cy={34} rx={96} ry={10} fill="none" stroke={stroke} strokeWidth={sw * 0.5} /></>
}
function SvgCurvTrap({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <path d="M30,2 L170,2 C185,50 185,50 170,98 L30,98 C15,50 15,50 30,2" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgWinPane({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><rect x={sw} y={sw} width={200 - sw * 2} height={100 - sw * 2} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={100} y1={sw} x2={100} y2={100 - sw} stroke={stroke} strokeWidth={sw * 0.6} /><line x1={sw} y1={50} x2={200 - sw} y2={50} stroke={stroke} strokeWidth={sw * 0.6} /></>
}
function SvgClassRect({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  // Class diagram: rectangle with two horizontal lines (like 目)
  return <><rect x={sw} y={sw} width={200 - sw * 2} height={100 - sw * 2} rx={3} fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={sw} y1={33} x2={200 - sw} y2={33} stroke={stroke} strokeWidth={sw * 0.6} /><line x1={sw} y1={66} x2={200 - sw} y2={66} stroke={stroke} strokeWidth={sw * 0.6} /></>
}
function SvgBolt({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <polygon points="115,2 60,50 100,50 85,98 140,50 100,50" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgCloud({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <path d="M50,80 C20,80 15,55 35,48 C25,25 55,10 80,20 C95,5 130,5 145,20 C170,12 195,30 180,50 C198,62 190,80 165,80 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgDoc({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <path d="M2,2 L198,2 L198,82 C160,72 40,92 2,82 Z" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgLinDoc({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><path d="M2,2 L198,2 L198,82 C160,72 40,92 2,82 Z" fill={fill} stroke={stroke} strokeWidth={sw} /><line x1={30} y1={2} x2={30} y2={80} stroke={stroke} strokeWidth={sw * 0.6} /></>
}
function SvgStDoc({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><path d="M12,12 L198,12 L198,92 C160,82 40,102 12,92 Z" fill={fill} stroke={stroke} strokeWidth={sw} /><path d="M2,2 L188,2 L188,82 C150,72 30,92 2,82 Z" fill={fill} stroke={stroke} strokeWidth={sw} /></>
}
function SvgTagDoc({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><path d="M2,2 L198,2 L198,82 C160,72 40,92 2,82 Z" fill={fill} stroke={stroke} strokeWidth={sw} /><polygon points="165,2 198,2 198,30" fill="none" stroke={stroke} strokeWidth={sw * 0.6} /></>
}
function SvgFork({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <rect x={2} y={35} width={196} height={30} rx={2} fill={stroke} stroke={stroke} strokeWidth={sw} />
}
function SvgBrace({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <path d="M180,2 C120,2 120,40 100,50 C120,60 120,98 180,98" fill="none" stroke={stroke} strokeWidth={sw} />
}
function SvgBraceR({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <path d="M20,2 C80,2 80,40 100,50 C80,60 80,98 20,98" fill="none" stroke={stroke} strokeWidth={sw} />
}
function SvgBraces({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <><path d="M50,2 C20,2 20,40 10,50 C20,60 20,98 50,98" fill="none" stroke={stroke} strokeWidth={sw} /><path d="M150,2 C180,2 180,40 190,50 C180,60 180,98 150,98" fill="none" stroke={stroke} strokeWidth={sw} /></>
}
function SvgOdd({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <polygon points="30,2 170,2 198,50 170,98 30,98 2,50" fill={fill} stroke={stroke} strokeWidth={sw} />
}
function SvgBang({ fill, stroke, sw }: { fill: string; stroke: string; sw: number }) {
  return <polygon points="100,2 120,35 160,40 130,65 140,98 100,82 60,98 70,65 40,40 80,35" fill={fill} stroke={stroke} strokeWidth={sw} />
}

const SVG_RENDERERS: Partial<Record<NodeShape, SvgShapeRenderer>> = {
  diamond: SvgDiamond,
  hexagon: SvgHexagon,
  parallelogram: SvgParallelogram,
  'parallelogram-alt': SvgParallelogramAlt,
  trapezoid: SvgTrapezoid,
  'trapezoid-alt': SvgTrapezoidAlt,
  asymmetric: SvgAsymmetric,
  cylinder: SvgCylinder,
  triangle: SvgTriangle,
  'flip-tri': SvgFlipTri,
  'small-circle': SvgSmallCircle,
  'framed-circle': SvgFramedCircle,
  'filled-circle': SvgFilledCircle,
  'crossed-circle': SvgCrossedCircle,
  'lin-rect': SvgLinRect,
  'div-rect': SvgDivRect,
  'class-rect': SvgClassRect,
  'st-rect': SvgStRect,
  'tag-rect': SvgTagRect,
  'notch-rect': SvgNotchRect,
  'sl-rect': SvgSlRect,
  hourglass: SvgHourglass,
  flag: SvgFlag,
  'bow-rect': SvgBowRect,
  'notch-pent': SvgNotchPent,
  delay: SvgDelay,
  'h-cyl': SvgHCyl,
  'lin-cyl': SvgLinCyl,
  'curv-trap': SvgCurvTrap,
  'win-pane': SvgWinPane,
  bolt: SvgBolt,
  cloud: SvgCloud,
  doc: SvgDoc,
  'lin-doc': SvgLinDoc,
  'st-doc': SvgStDoc,
  'tag-doc': SvgTagDoc,
  fork: SvgFork,
  brace: SvgBrace,
  'brace-r': SvgBraceR,
  braces: SvgBraces,
  odd: SvgOdd,
  bang: SvgBang,
}

const IS_SVG_SHAPE = new Set<NodeShape>(Object.keys(SVG_RENDERERS) as NodeShape[])

// ─── Four-directional handles (shown on all shapes) ──────────────────────────
function NodeHandles({ visible }: { visible?: boolean }) {
  const base = {
    zIndex: 30,
    pointerEvents: 'all',
  } as const

  const topStyle = { ...base, top: 2 }
  const bottomStyle = { ...base, bottom: 2 }
  const leftStyle = { ...base, left: 2 }
  const rightStyle = { ...base, right: 2 }

  const cls = "!bg-gray-300/70 hover:!bg-blue-400 !w-2.5 !h-2.5 !border !border-gray-400/50 hover:!border-blue-500 transition-colors"

  const positions = [Position.Top, Position.Bottom, Position.Left, Position.Right]
  const styleMap = {
    [Position.Top]: topStyle,
    [Position.Bottom]: bottomStyle,
    [Position.Left]: leftStyle,
    [Position.Right]: rightStyle,
  }

  return (
    <>
      {positions.map((pos) => (
        <Fragment key={pos}>
          <Handle id={`${pos}-s`} type="source" position={pos} className={cls} style={{ ...styleMap[pos], opacity: visible ? 1 : 0 }} />
          <Handle id={`${pos}-t`} type="target" position={pos} className="!w-0 !h-0 !min-w-0 !min-h-0 !border-0 !bg-transparent" style={styleMap[pos]} />
        </Fragment>
      ))}
    </>
  )
}

// ─── Inline label editor ──────────────────────────────────────────────────────
interface LabelProps {
  value: string
  editing: boolean
  draft: string
  setDraft: (v: string) => void
  onCommit: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  inputRef: React.RefObject<HTMLInputElement>
  color?: string
}

function NodeLabel({
  value,
  editing,
  draft,
  setDraft,
  onCommit,
  onKeyDown,
  inputRef,
  color,
}: LabelProps) {
  if (editing) {
    return (
      <div className="relative w-full nodrag">
        <span className="text-sm font-medium leading-snug invisible whitespace-pre">{draft || ' '}</span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={onCommit}
          onKeyDown={onKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute inset-0 bg-transparent border-none outline-none text-center text-sm font-medium w-full nodrag"
          style={{ color: color || '#1f2937' }}
          autoFocus
          aria-label="节点标签"
        />
      </div>
    )
  }
  return (
    <span
      className="text-center break-words text-sm font-medium leading-snug select-none"
      style={{ color: color || '#1f2937' }}
    >
      {value}
    </span>
  )
}

// ─── Main FlowNode component ──────────────────────────────────────────────────
export function FlowNode({ id, data, selected }: NodeProps) {
  const nodeData = data as FlowNodeData
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(nodeData.label)
  const [isHovered, setIsHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const updateNodeLabel = useFlowStore((s) => s.updateNodeLabel)
  const pushHistory = useFlowStore((s) => s.pushHistory)

  const commitLabel = useCallback(() => {
    const trimmed = draft.trim()
    updateNodeLabel(id, trimmed)
    setEditing(false)
  }, [draft, id, updateNodeLabel])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setDraft(nodeData.label)
    setEditing(true)
  }, [nodeData.label])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Enter') commitLabel()
      if (e.key === 'Escape') setEditing(false)
    },
    [commitLabel]
  )

  const shape = (nodeData.shape ?? 'rectangle') as NodeShape
  const fillColor = nodeData.fillColor || '#ffffff'
  const isSelected = selected && !editing
  const strokeColor = nodeData.strokeColor || (selected ? '#3b82f6' : '#9ca3af')
  const textColor = nodeData.textColor || '#1f2937'
  const strokeWidth = selected ? 3 : 2

  const labelProps: LabelProps = {
    value: nodeData.label,
    editing,
    draft,
    setDraft,
    onCommit: commitLabel,
    onKeyDown: handleKeyDown,
    inputRef,
    color: textColor,
  }

  // ── Subgraph container ─────────────────────────────────────────────────────
  if (nodeData.isSubgraph) {
    const childCount = useFlowStore.getState().nodes.filter(n => n.parentId === id).length
    return (
      <div
        className="relative w-full h-full rounded-xl cursor-pointer transition-all duration-150"
        style={{
          border: selected
            ? `2px solid #3b82f6`
            : isHovered
              ? `2px solid ${strokeColor}`
              : `2px dashed ${strokeColor}`,
          backgroundColor: nodeData.fillColor
            ? nodeData.fillColor
            : selected
              ? 'rgba(59,130,246,0.08)'
              : isHovered
                ? 'rgba(59,130,246,0.06)'
                : 'rgba(59,130,246,0.03)',
          boxShadow: selected
            ? '0 0 0 3px rgba(59,130,246,0.2)'
            : isHovered
              ? '0 2px 8px rgba(0,0,0,0.08)'
              : 'none',
        }}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <NodeResizer minWidth={200} minHeight={120} isVisible={!!selected} handleStyle={RESIZER_HANDLE_STYLE} lineStyle={RESIZER_LINE_STYLE} />
        <div className={`absolute top-2 left-3 flex items-center gap-1.5 text-xs font-semibold ${editing ? '' : 'select-none pointer-events-none'}`}
          style={{ color: selected ? '#3b82f6' : textColor }}>
          <NodeLabel {...labelProps} color={selected ? '#3b82f6' : textColor} />
        </div>
        <NodeHandles visible={!!selected || isHovered} />
      </div>
    )
  }

  // ── SVG-backed shapes ──────────────────────────────────────────────────────
  if (IS_SVG_SHAPE.has(shape)) {
    const Renderer = SVG_RENDERERS[shape]!
    const isCylinder = shape === 'cylinder' || shape === 'lin-cyl'
    const isSquarish = shape === 'small-circle' || shape === 'framed-circle' || shape === 'filled-circle'
      || shape === 'crossed-circle' || shape === 'triangle' || shape === 'flip-tri'
      || shape === 'bolt' || shape === 'bang' || shape === 'win-pane'
    const isFork = shape === 'fork'
    return (
      <div
        className="relative cursor-pointer select-none"
        style={{
          width: '100%',
          height: '100%',
          minWidth: isFork ? 130 : isSquarish ? 80 : 130,
          minHeight: isFork ? 20 : isCylinder ? 80 : isSquarish ? 80 : 54,
        }}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <NodeResizer
          minWidth={isFork ? 100 : 80}
          minHeight={isFork ? 16 : isCylinder ? 60 : isSquarish ? 60 : 54}
          isVisible={isSelected}
          onResizeEnd={() => pushHistory()}
          handleStyle={RESIZER_HANDLE_STYLE}
          lineStyle={RESIZER_LINE_STYLE}
        />
        <svg
          className="absolute inset-0 w-full h-full overflow-visible"
          viewBox={isCylinder ? '0 0 200 100' : '0 0 200 100'}
          preserveAspectRatio="none"
        >
          <Renderer fill={fillColor} stroke={strokeColor} sw={strokeWidth} />
        </svg>
        <div
          className="relative z-10 flex items-center justify-center w-full h-full px-3 py-2"
          style={{ height: '100%', minHeight: isFork ? 20 : isCylinder ? 80 : isSquarish ? 80 : 54 }}
        >
          {!isFork && <NodeLabel {...labelProps} />}
        </div>
        <NodeHandles visible={isSelected || isHovered} />
      </div>
    )
  }

  // ── Text shape (no border, just text) ────────────────────────────────────
  if (shape === 'text') {
    return (
      <div
        className="relative cursor-pointer select-none flex items-center justify-center px-2 py-1"
        style={{ minWidth: 40, minHeight: 24 }}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <NodeResizer minWidth={40} minHeight={24} isVisible={isSelected} onResizeEnd={() => pushHistory()} handleStyle={RESIZER_HANDLE_STYLE} lineStyle={RESIZER_LINE_STYLE} />
        <NodeHandles visible={isSelected || isHovered} />
        <NodeLabel {...labelProps} />
      </div>
    )
  }

  // ── CSS-based shapes (rectangle, rounded, stadium, subroutine, circle, double-circle) ──
  const baseStyle: React.CSSProperties = {
    backgroundColor: fillColor,
    border: `${strokeWidth}px solid ${strokeColor}`,
  }

  let extraStyle: React.CSSProperties = {}
  let extraClass = ''

  switch (shape) {
    case 'rounded':
      extraStyle = { borderRadius: 12 }
      break
    case 'stadium':
      extraStyle = { borderRadius: 9999, paddingLeft: 20, paddingRight: 20 }
      break
    case 'subroutine':
      extraStyle = {
        borderRadius: 3,
        outline: `2px solid ${strokeColor}`,
        outlineOffset: 4,
      }
      break
    case 'circle':
      extraStyle = { borderRadius: '50%' }
      extraClass = '!min-w-[80px] !min-h-[80px] !aspect-square'
      break
    case 'double-circle':
      extraStyle = {
        borderRadius: '50%',
        boxShadow: `0 0 0 3px ${fillColor}, 0 0 0 5px ${strokeColor}`,
      }
      extraClass = '!min-w-[80px] !min-h-[80px] !aspect-square'
      break
    default: // rectangle
      extraStyle = { borderRadius: 4 }
  }

  const isCircleShape = shape === 'circle' || shape === 'double-circle'

  return (
    <div
      className={`relative flex items-center justify-center px-4 py-2.5 cursor-pointer select-none min-w-[100px] ${extraClass}`}
      style={{ ...baseStyle, ...extraStyle, height: '100%' }}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodeResizer
        minWidth={80}
        minHeight={isCircleShape ? 80 : 40}
        isVisible={isSelected}
        onResizeEnd={() => pushHistory()}
        handleStyle={RESIZER_HANDLE_STYLE}
        lineStyle={RESIZER_LINE_STYLE}
      />
      <NodeHandles visible={isSelected || isHovered} />
      <NodeLabel {...labelProps} />
    </div>
  )
}
