'use client'

import { useState, useEffect, useRef } from 'react'

interface SvgNodeEditorProps {
  nodeId: string
  initialLabel: string
  position: { x: number; y: number }
  onSave: (nodeId: string, newLabel: string) => void
  onCancel: () => void
}

export default function SvgNodeEditor({ nodeId, initialLabel, position, onSave, onCancel }: SvgNodeEditorProps) {
  const [label, setLabel] = useState(initialLabel)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = () => {
    if (label.trim()) {
      onSave(nodeId, label.trim())
    } else {
      onCancel()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div
      className="absolute z-50"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        className="px-3 py-2 border-2 border-blue-500 rounded shadow-lg bg-white text-sm min-w-[120px]"
        style={{ outline: 'none' }}
      />
    </div>
  )
}
