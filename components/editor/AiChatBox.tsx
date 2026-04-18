'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAiStore } from '@/lib/aiStore'
import { useGraphEditorStore } from '@/lib/graphEditorStore'
import { serializeToMermaid } from '@/lib/graphSerializer'
import { importFromCode } from '@/lib/graphImporter'
import { X, Send, Minimize2, Maximize2 } from 'lucide-react'

// 从 contentEditable div 提取纯文本（保留引用标签的文字）
function getTextFromEditable(el: HTMLElement): string {
  let text = ''
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || ''
    } else if (node instanceof HTMLElement) {
      if (node.dataset.refLabel) {
        text += `「${node.dataset.refLabel}」`
      } else {
        text += node.textContent || ''
      }
    }
  })
  return text
}

// 创建引用标签的 HTML
function createRefTagHTML(label: string): string {
  return `<span contenteditable="false" data-ref-label="${label}" style="display:inline-flex;align-items:center;gap:2px;background:#e0e7ff;color:#4338ca;padding:2px 6px;border-radius:4px;font-size:12px;margin:0 2px;user-select:all;vertical-align:middle;cursor:default;">📌 ${label}</span>`
}

export default function AiChatBox() {
  const { isOpen, setIsOpen, messages, addMessage, updateLastAssistantMessage, isLoading, setIsLoading, currentContextNodes, removeContextNode, clearContextNodes, clearMessages, pendingInsertText, consumePendingInsertText, apiKey, baseURL, model } = useAiStore()
  const { nodes, edges, direction, subgraphs, curveStyle } = useGraphEditorStore()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLDivElement>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  // 监听 pendingInsertText，插入引用标签到输入框
  useEffect(() => {
    if (pendingInsertText) {
      const text = consumePendingInsertText()
      if (text) {
        const el = inputRef.current
        if (el) {
          // 在末尾插入引用标签
          const tagHTML = createRefTagHTML(text.replace(/[「」]/g, ''))
          el.focus()
          // 移动光标到末尾
          const selection = window.getSelection()
          const range = document.createRange()
          range.selectNodeContents(el)
          range.collapse(false)
          selection?.removeAllRanges()
          selection?.addRange(range)
          // 插入标签
          document.execCommand('insertHTML', false, tagHTML + '\u200B')
          setIsEmpty(false)
        }
      }
    }
  }, [pendingInsertText, consumePendingInsertText])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 解析并自动应用 mermaid 代码块到画布
  const extractAndApplyMermaid = useCallback((text: string) => {
    const match = text.match(/```mermaid\n([\s\S]*?)\n```/)
    if (match && match[1]) {
      const code = match[1].trim()
      try {
        const result = importFromCode(code)
        const { initGraph, setDirection, setCurveStyle } = useGraphEditorStore.getState()
        initGraph(result.nodes, result.edges, result.layout, result.subgraphs)
        if (result.direction) setDirection(result.direction)
        if (result.curveStyle) setCurveStyle(result.curveStyle)
      } catch (err) {
        console.error('[AI] 应用代码到画布失败:', err)
      }
    }
  }, [])

  const handleSend = useCallback(async () => {
    const el = inputRef.current
    if (!el || isLoading) return

    const userMessage = getTextFromEditable(el).trim()
    if (!userMessage) return

    // 清空输入框
    el.innerHTML = ''
    setIsEmpty(true)

    // 添加用户消息
    addMessage({
      role: 'user',
      content: userMessage,
      contextNodes: currentContextNodes.length > 0 ? [...currentContextNodes] : undefined,
    })

    clearContextNodes()
    setIsLoading(true)
    addMessage({ role: 'assistant', content: '' })

    const currentCanvasCode = serializeToMermaid(nodes, edges, direction, subgraphs, curveStyle)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: userMessage },
          ],
          currentCode: currentCanvasCode,
          contextNodes: currentContextNodes.length > 0 ? currentContextNodes : undefined,
          apiKey: apiKey || undefined,
          baseURL: baseURL || undefined,
          model: model || undefined,
        }),
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || '请求失败')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break

              try {
                const parsed = JSON.parse(data)
                if (parsed.error) {
                  throw new Error(parsed.error)
                }
                if (parsed.text) {
                  accumulatedText += parsed.text
                  updateLastAssistantMessage(accumulatedText)
                  extractAndApplyMermaid(accumulatedText)
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          }
        }
      }
    } catch (err: any) {
      updateLastAssistantMessage(`❌ 错误: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, messages, nodes, edges, direction, subgraphs, curveStyle, currentContextNodes, apiKey, baseURL, model, addMessage, updateLastAssistantMessage, setIsLoading, clearContextNodes, extractAndApplyMermaid])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const handleInput = useCallback(() => {
    const el = inputRef.current
    if (el) {
      const text = getTextFromEditable(el).trim()
      setIsEmpty(text.length === 0)
    }
  }, [])

  // 常驻底部，可展开/收起
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: isOpen ? 400 : 48,
        background: 'white',
        borderTop: '1px solid rgba(163,177,198,0.25)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        transition: 'height 0.3s ease',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: isOpen ? '1px solid #e5e7eb' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🤖</span>
          <span style={{ fontSize: 14, fontWeight: 600 }}>AI 助手</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {messages.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm('确定要清空所有对话记录吗？')) clearMessages() }}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 4, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'white' }}
              title="清空对话"
            >
              <X size={16} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen) }}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 4, padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'white' }}
            title={isOpen ? '收起' : '展开'}
          >
            {isOpen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
                <div>向 AI 提问或描述你想要的图表</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>右键节点可引用到对话中</div>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: msg.role === 'user' ? '#667eea' : '#f3f4f6',
                  color: msg.role === 'user' ? 'white' : '#374151',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content || (msg.role === 'assistant' && isLoading ? '思考中...' : '')}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <div
                ref={inputRef}
                contentEditable={!isLoading}
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  fontSize: 13,
                  outline: 'none',
                  minHeight: 40,
                  maxHeight: 120,
                  overflowY: 'auto',
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
                suppressContentEditableWarning
              />
              {isEmpty && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    left: 12,
                    color: '#9ca3af',
                    fontSize: 13,
                    pointerEvents: 'none',
                    lineHeight: 1.6,
                  }}
                >
                  输入消息... (Enter 发送, Shift+Enter 换行)
                </div>
              )}
            </div>
            <button
              onClick={handleSend}
              disabled={isEmpty || isLoading}
              style={{
                background: !isEmpty && !isLoading ? '#667eea' : '#e5e7eb',
                color: !isEmpty && !isLoading ? 'white' : '#9ca3af',
                border: 'none',
                borderRadius: 8,
                padding: '8px 12px',
                cursor: !isEmpty && !isLoading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              title="发送"
            >
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
