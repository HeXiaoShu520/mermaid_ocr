import { create } from "zustand";

type State = {
  image: File | null;
  mermaid: string;
  tempMermaid: string;  // 临时编辑区的代码
  loading: boolean;
  error: string | null;
  provider: "openai" | "anthropic";
  model: string;
  setImage: (file: File | null) => void;
  setMermaid: (code: string) => void;
  setTempMermaid: (code: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setProvider: (provider: "openai" | "anthropic") => void;
  setModel: (model: string) => void;

  // 同步操作
  loadToEditor: () => void;   // 主代码 → 临时编辑器
  syncToCode: () => void;     // 临时编辑器 → 主代码
};

export const useStore = create<State>((set, get) => ({
  image: null,
  mermaid: "",
  tempMermaid: "",
  loading: false,
  error: null,
  provider: "anthropic",
  model: "",
  setImage: (image) => set({ image }),
  setMermaid: (mermaid) => set({ mermaid }),
  setTempMermaid: (tempMermaid) => set({ tempMermaid }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),

  loadToEditor: () => {
    const { mermaid } = get();
    set({ tempMermaid: mermaid });
  },

  syncToCode: () => {
    const { tempMermaid } = get();
    set({ mermaid: tempMermaid });
  },
}));
