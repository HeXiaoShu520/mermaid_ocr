import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  contextNodes?: { id: string; label: string }[]
}

interface AiState {
  // 持久化配置
  apiKey: string
  baseURL: string
  model: string

  // 聊天状态
  isOpen: boolean
  isLoading: boolean
  messages: ChatMessage[]
  currentContextNodes: { id: string; label: string }[]
  pendingInsertText: string | null

  // 配置 actions
  setApiKey: (key: string) => void
  setBaseURL: (url: string) => void
  setModel: (model: string) => void

  // 聊天 actions
  setIsOpen: (open: boolean) => void
  setIsLoading: (loading: boolean) => void
  addMessage: (msg: Omit<ChatMessage, 'id'>) => void
  updateLastAssistantMessage: (content: string) => void
  clearMessages: () => void

  // 上下文 actions
  addContextNode: (node: { id: string; label: string }) => void
  removeContextNode: (id: string) => void
  clearContextNodes: () => void
  insertTextToInput: (text: string) => void
  consumePendingInsertText: () => string | null
}

export const useAiStore = create<AiState>()(
  persist(
    (set, get) => ({
      apiKey: '',
      baseURL: '',
      model: '',

      isOpen: false,
      isLoading: false,
      messages: [],
      currentContextNodes: [],
      pendingInsertText: null,

      setApiKey: (apiKey) => set({ apiKey }),
      setBaseURL: (baseURL) => set({ baseURL }),
      setModel: (model) => set({ model }),

      setIsOpen: (isOpen) => set({ isOpen }),
      setIsLoading: (isLoading) => set({ isLoading }),

      addMessage: (msg) => set((s) => ({
        messages: [...s.messages, { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }],
      })),

      updateLastAssistantMessage: (content) => set((s) => {
        const msgs = [...s.messages]
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'assistant') {
            msgs[i] = { ...msgs[i], content }
            break
          }
        }
        return { messages: msgs }
      }),

      clearMessages: () => set({ messages: [] }),

      addContextNode: (node) => set((s) => {
        if (s.currentContextNodes.some((n) => n.id === node.id)) return s
        return { currentContextNodes: [...s.currentContextNodes, node] }
      }),

      removeContextNode: (id) => set((s) => ({
        currentContextNodes: s.currentContextNodes.filter((n) => n.id !== id),
      })),

      clearContextNodes: () => set({ currentContextNodes: [] }),

      insertTextToInput: (text) => set({ pendingInsertText: text }),
      consumePendingInsertText: () => {
        const text = get().pendingInsertText
        set({ pendingInsertText: null })
        return text
      },
    }),
    {
      name: 'mermaid-ai-config',
      partialize: (state) => ({
        apiKey: state.apiKey,
        baseURL: state.baseURL,
        model: state.model,
      }),
    }
  )
)
