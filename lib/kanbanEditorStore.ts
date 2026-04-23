import { create } from 'zustand'
import type { KanbanData } from './kanbanParser'

interface KanbanEditorState {
  data: KanbanData | null
  selectedItemId: string | null
  setData: (data: KanbanData | null) => void
  setSelectedItemId: (id: string | null) => void
  updateData: (data: KanbanData) => void
}

export const useKanbanEditorStore = create<KanbanEditorState>((set) => ({
  data: null,
  selectedItemId: null,
  setData: (data) => set({ data }),
  setSelectedItemId: (id) => set({ selectedItemId: id }),
  updateData: (data) => set({ data }),
}))
