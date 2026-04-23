import { create } from 'zustand'
import type { BlockData } from './blockParser'

interface BlockEditorState {
  data: BlockData | null
  selectedId: string | null
  setData: (data: BlockData | null) => void
  setSelectedId: (id: string | null) => void
  updateData: (data: BlockData) => void
}

export const useBlockEditorStore = create<BlockEditorState>((set) => ({
  data: null,
  selectedId: null,
  setData: (data) => set({ data }),
  setSelectedId: (id) => set({ selectedId: id }),
  updateData: (data) => set({ data }),
}))
