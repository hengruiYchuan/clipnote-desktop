import { create } from "zustand";

export type ShellMode = "collapsed" | "expanded";
export type ShellSection = "recent" | "favorites" | "notes" | "vault" | "settings";

type ShellState = {
  mode: ShellMode;
  section: ShellSection;
  query: string;
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
  setMode: (mode: ShellMode) => void;
  setSection: (section: ShellSection) => void;
  setQuery: (query: string) => void;
};

export const useShellStore = create<ShellState>((set) => ({
  mode: "collapsed",
  section: "recent",
  query: "",
  expand: () => set((state) => (state.mode === "expanded" ? state : { mode: "expanded" })),
  collapse: () =>
    set((state) => (state.mode === "collapsed" ? state : { mode: "collapsed" })),
  toggle: () =>
    set((state) => ({
      mode: state.mode === "collapsed" ? "expanded" : "collapsed",
    })),
  setMode: (mode) => set((state) => (state.mode === mode ? state : { mode })),
  setSection: (section) => set({ section }),
  setQuery: (query) => set({ query }),
}));
