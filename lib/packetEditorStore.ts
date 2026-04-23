import { create } from 'zustand'
import type { PacketData } from './packetParser'

interface PacketEditorState {
  data: PacketData | null
  selectedId: string | null
  resizeMode: 'push' | 'cover'
  setData: (data: PacketData | null) => void
  setSelectedId: (id: string | null) => void
  setResizeMode: (mode: 'push' | 'cover') => void
  updateData: (data: PacketData) => void
}

export const usePacketEditorStore = create<PacketEditorState>((set) => ({
  data: null,
  selectedId: null,
  resizeMode: 'push',
  setData: (data) => set({ data }),
  setSelectedId: (id) => set({ selectedId: id }),
  setResizeMode: (mode) => set({ resizeMode: mode }),
  updateData: (data) => set({ data }),
}))
