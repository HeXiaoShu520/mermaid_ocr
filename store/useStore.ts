import { create } from "zustand";

type State = {
  image: File | null;
  mermaid: string;
  loading: boolean;
  error: string | null;
  provider: "openai" | "anthropic";
  model: string;
  setImage: (file: File | null) => void;
  setMermaid: (code: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setProvider: (provider: "openai" | "anthropic") => void;
  setModel: (model: string) => void;
};

export const useStore = create<State>((set) => ({
  image: null,
  mermaid: "",
  loading: false,
  error: null,
  provider: "anthropic",
  model: "",
  setImage: (image) => set({ image }),
  setMermaid: (mermaid) => set({ mermaid }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setProvider: (provider) => set({ provider }),
  setModel: (model) => set({ model }),
}));
