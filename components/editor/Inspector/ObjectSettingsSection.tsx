'use client'

import { useGraphEditorStore } from '@/lib/graphEditorStore'
import { useSeqEditorStore } from '@/lib/seqEditorStore'

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
  const { nodes, edges, selectedNodeIds, selectedEdgeId, updateNode, renameNode, updateEdge } = useGraphEditorStore()
  const {
    participants, messages, fragments,
    selectedParticipantId, selectedMessageId, selectedFragmentId,
    updateParticipant, updateMessage, updateFragment, swapMessageOrder,
  } = useSeqEditorStore()

  const selectedNodes = nodes.filter(n => selectedNodeIds.has(n.id))
  const selectedEdges = edges.filter(e => e.id === selectedEdgeId)
  const hasNodeSelection = selectedNodes.length > 0
  const hasEdgeSelection = selectedEdges.length > 0
  const firstEdge = hasEdgeSelection ? selectedEdges[0] : undefined

  // 时序图选中
  const selParticipant = participants.find(p => p.id === selectedParticipantId)
  const selMessage = messages.find(m => m.id === selectedMessageId)
  const selFragment = fragments.find(f => f.id === selectedFragmentId)
  const hasSeqSelection = !!(selParticipant || selMessage || selFragment)

  if (!hasNodeSelection && !hasEdgeSelection && !hasSeqSelection) {
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

          {/* 标识和标签编辑 */}
          {selectedNodes.length === 1 && (
            <>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>唯一标识 (ID)</div>
                <input
                  type="text"
                  defaultValue={selectedNodes[0].id}
                  key={selectedNodes[0].id + '-id'}
                  onBlur={(e) => {
                    const newId = e.target.value.trim()
                    if (newId && newId !== selectedNodes[0].id) {
                      renameNode(selectedNodes[0].id, newId)
                    }
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                  }}
                  style={{
                    width: '100%',
                    background: '#f9fafb',
                    border: PANEL_BORDER,
                    borderRadius: 6,
                    padding: '6px 8px',
                    fontSize: 12,
                    color: '#6b7280',
                    outline: 'none',
                    fontFamily: 'monospace',
                  }}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>内容 (Label)</div>
                <input
                  type="text"
                  value={selectedNodes[0].label}
                  onChange={(e) => updateNode(selectedNodes[0].id, { label: e.target.value })}
                  onKeyDown={(e) => e.stopPropagation()}
                  style={{
                    width: '100%',
                    background: '#fff',
                    border: PANEL_BORDER,
                    borderRadius: 6,
                    padding: '6px 8px',
                    fontSize: 12,
                    color: '#374151',
                    outline: 'none',
                  }}
                />
              </div>
            </>
          )}

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

      {/* ─── 时序图：参与者属性 ─── */}
      {selParticipant && (
        <div style={{ background: '#fff', borderRadius: 10, border: PANEL_BORDER, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
            参与者：{selParticipant.type === 'actor' ? '👤 Actor' : '📦 Participant'}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>唯一标识 (ID)</div>
            <input
              type="text"
              defaultValue={selParticipant.id}
              key={selParticipant.id + '-pid'}
              onBlur={(e) => {
                const newId = e.target.value.trim()
                if (newId && newId !== selParticipant.id) {
                  updateParticipant(selParticipant.id, { id: newId } as any)
                }
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              style={{
                width: '100%', background: '#f9fafb', border: PANEL_BORDER,
                borderRadius: 6, padding: '6px 8px', fontSize: 12,
                color: '#6b7280', outline: 'none', fontFamily: 'monospace',
              }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>显示名称</div>
            <input
              type="text"
              value={selParticipant.label}
              onChange={(e) => updateParticipant(selParticipant.id, { label: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
              style={{
                width: '100%', background: '#fff', border: PANEL_BORDER,
                borderRadius: 6, padding: '6px 8px', fontSize: 12,
                color: '#374151', outline: 'none',
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>类型</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <FlatBtn active={selParticipant.type === 'participant'} onClick={() => updateParticipant(selParticipant.id, { type: 'participant' })}>
              📦 方框
            </FlatBtn>
            <FlatBtn active={selParticipant.type === 'actor'} onClick={() => updateParticipant(selParticipant.id, { type: 'actor' })}>
              👤 小人
            </FlatBtn>
          </div>
        </div>
      )}

      {/* ─── 时序图：消息属性 ─── */}
      {selMessage && (
        <div style={{ background: '#fff', borderRadius: 10, border: PANEL_BORDER, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
            消息：{selMessage.from} → {selMessage.to}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>消息内容</div>
            <input
              type="text"
              value={selMessage.label}
              onChange={(e) => updateMessage(selMessage.id, { label: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
              style={{
                width: '100%', background: '#fff', border: PANEL_BORDER,
                borderRadius: 6, padding: '6px 8px', fontSize: 12,
                color: '#374151', outline: 'none',
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>方向</div>
          <div style={{ marginBottom: 12 }}>
            <FlatBtn onClick={() => updateMessage(selMessage.id, { from: selMessage.to, to: selMessage.from })}>
              ⇄ 反向
            </FlatBtn>
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>排序</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <FlatBtn
              onClick={() => swapMessageOrder(selMessage.id, -1)}
              disabled={selMessage.order === 0}
              title="上移"
            >
              ↑ 上移
            </FlatBtn>
            <FlatBtn
              onClick={() => swapMessageOrder(selMessage.id, 1)}
              disabled={selMessage.order === Math.max(...messages.map(m => m.order))}
              title="下移"
            >
              ↓ 下移
            </FlatBtn>
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>线条样式</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            <FlatBtn active={selMessage.style === 'solid'} onClick={() => updateMessage(selMessage.id, { style: 'solid' })}>
              ── 实线
            </FlatBtn>
            <FlatBtn active={selMessage.style === 'dashed'} onClick={() => updateMessage(selMessage.id, { style: 'dashed' })}>
              ╌╌ 虚线
            </FlatBtn>
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>箭头样式</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <FlatBtn active={selMessage.arrow === 'filled'} onClick={() => updateMessage(selMessage.id, { arrow: 'filled' })}>
              ▶ 实心
            </FlatBtn>
            <FlatBtn active={selMessage.arrow === 'open'} onClick={() => updateMessage(selMessage.id, { arrow: 'open' })}>
              ▷ 空心
            </FlatBtn>
            <FlatBtn active={selMessage.arrow === 'none'} onClick={() => updateMessage(selMessage.id, { arrow: 'none' })}>
              ─ 无
            </FlatBtn>
          </div>
        </div>
      )}

      {/* ─── 时序图：片段属性 ─── */}
      {selFragment && (
        <div style={{ background: '#fff', borderRadius: 10, border: PANEL_BORDER, padding: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
            片段：{selFragment.type.toUpperCase()}
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>唯一标识 (ID)</div>
            <input
              type="text"
              defaultValue={selFragment.id}
              key={selFragment.id + '-fid'}
              onBlur={(e) => {
                const newId = e.target.value.trim()
                if (newId && newId !== selFragment.id) {
                  updateFragment(selFragment.id, { id: newId })
                }
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
              }}
              style={{
                width: '100%', background: '#f9fafb', border: PANEL_BORDER,
                borderRadius: 6, padding: '6px 8px', fontSize: 12,
                color: '#6b7280', outline: 'none', fontFamily: 'monospace',
              }}
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 4 }}>条件/标签</div>
            <input
              type="text"
              value={selFragment.label}
              onChange={(e) => updateFragment(selFragment.id, { label: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
              style={{
                width: '100%', background: '#fff', border: PANEL_BORDER,
                borderRadius: 6, padding: '6px 8px', fontSize: 12,
                color: '#374151', outline: 'none',
              }}
            />
          </div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 6 }}>片段类型</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(['loop', 'alt', 'opt', 'par', 'critical', 'break'] as const).map(t => (
              <FlatBtn key={t} active={selFragment.type === t} onClick={() => updateFragment(selFragment.id, { type: t })}>
                {t}
              </FlatBtn>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
