'use client'

import { useGraphEditorStore } from '@/lib/graphEditorStore'

const PANEL_BORDER = '1px solid rgba(163,177,198,0.25)'

function FlatBtn({
  onClick,
  active,
  disabled,
  children,
  title,
}: {
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        background: active ? '#EEF2FF' : '#fff',
        border: PANEL_BORDER,
        borderRadius: 8,
        padding: '5px 10px',
        fontSize: 11,
        fontWeight: 500,
        color: active ? '#4F46E5' : '#6B7280',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function ColorSwatch({
  value,
  defaultVal,
  onChange,
  label,
}: {
  value?: string
  defaultVal: string
  onChange: (color: string) => void
  label: string
}) {
  return (
    <label
      title={label}
      aria-label={label}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: value ?? defaultVal,
          border: PANEL_BORDER,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <input
          type="color"
          defaultValue={value ?? defaultVal}
          onChange={(e) => onChange(e.target.value)}
          style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }}
          aria-label={label}
        />
      </div>
      <span style={{ fontSize: 9, color: '#9ca3af', letterSpacing: '0.04em' }}>{label}</span>
    </label>
  )
}

export function ObjectSettingsSection() {
  const { nodes, edges, selectedNodeIds, selectedEdgeId, updateNode, updateEdge } = useGraphEditorStore()

  const selectedNodes = nodes.filter(n => selectedNodeIds.has(n.id))
  const selectedEdges = edges.filter(e => e.id === selectedEdgeId)
  const hasNodeSelection = selectedNodes.length > 0
  const hasEdgeSelection = selectedEdges.length > 0
  const firstEdge = hasEdgeSelection ? selectedEdges[0] : undefined

  if (!hasNodeSelection && !hasEdgeSelection) {
    return (
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', marginBottom: 10 }}>对象设置</div>
        <div style={{ background: '#fff', borderRadius: 10, border: PANEL_BORDER, padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ fontSize: 24, opacity: 0.3 }}>◻</div>
          <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>选择画布上的节点或边以编辑</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.08em', marginBottom: 10 }}>对象设置</div>
      {hasNodeSelection && (
        <div style={{ background: '#fff', borderRadius: 10, border: PANEL_BORDER, padding: 14, marginBottom: hasEdgeSelection ? 10 : 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
            {selectedNodes.length === 1
              ? `节点：${selectedNodes[0].shape || 'rectangle'}`
              : `已选择 ${selectedNodes.length} 个节点`}
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
            <ColorSwatch
              key={selectedNodes.map(n => n.id).join('-') + '-fill'}
              value={selectedNodes[0].fillColor}
              defaultVal="#ffffff"
              label="填充"
              onChange={(color) => selectedNodes.forEach((n) => updateNode(n.id, { fillColor: color }))}
            />
            <ColorSwatch
              key={selectedNodes.map(n => n.id).join('-') + '-stroke'}
              value={selectedNodes[0].strokeColor}
              defaultVal="#333333"
              label="边框"
              onChange={(color) => selectedNodes.forEach((n) => updateNode(n.id, { strokeColor: color }))}
            />
            <ColorSwatch
              key={selectedNodes.map(n => n.id).join('-') + '-text'}
              value={selectedNodes[0].textColor}
              defaultVal="#000000"
              label="文字"
              onChange={(color) => selectedNodes.forEach((n) => updateNode(n.id, { textColor: color }))}
            />
          </div>
          <FlatBtn
            onClick={() => selectedNodes.forEach((n) => updateNode(n.id, { fillColor: undefined, strokeColor: undefined, textColor: undefined }))}
          >
            重置颜色
          </FlatBtn>
        </div>
      )}
      {hasEdgeSelection && (
        <div style={{ background: '#fff', borderRadius: 10, border: PANEL_BORDER, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 12 }}>已选择 1 条边</div>

          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>线条样式</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {(['solid', 'dotted', 'thick'] as const).map((style) => (
              <FlatBtn
                key={style}
                onClick={() => selectedEdges.forEach((e) => updateEdge(e.id, { style }))}
                active={firstEdge?.style === style}
                title={style}
              >
                {style === 'solid' ? '─' : style === 'dotted' ? '╌' : '━'}
              </FlatBtn>
            ))}
          </div>

          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>箭头类型</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {(['arrow', 'none', 'circle', 'cross', 'double'] as const).map((arrowType) => (
              <FlatBtn
                key={arrowType}
                onClick={() => selectedEdges.forEach((e) => updateEdge(e.id, { arrowType }))}
                active={(firstEdge?.arrowType || 'arrow') === arrowType}
                title={arrowType}
              >
                {arrowType === 'arrow' ? '→' : arrowType === 'none' ? '─' : arrowType === 'circle' ? '○' : arrowType === 'cross' ? '✕' : '⇒'}
              </FlatBtn>
            ))}
          </div>

          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 8 }}>颜色</div>
          <ColorSwatch
            key={selectedEdges.map(e => e.id).join('-')}
            value={firstEdge?.strokeColor}
            defaultVal="#6b7280"
            label="边颜色"
            onChange={(color) => selectedEdges.forEach((e) => updateEdge(e.id, { strokeColor: color }))}
          />
        </div>
      )}
    </div>
  )
}
