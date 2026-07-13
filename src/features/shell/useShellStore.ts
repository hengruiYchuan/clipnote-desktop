import { create } from "zustand";

export type ShellMode = "collapsed" | "expanded";
export type ShellSection = "recent" | "favorites" | "notes";

type ShellState = {
  mode: ShellMode;
  section: ShellSection;
  query: string;
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
  setSection: (section: ShellSection) => void;
  setQuery: (query: string) => void;
};

export const useShellStore = create<ShellState>((set) => ({
  mode: "collapsed",
  section: "recent",
  query: "",
  expand: () => set({ mode: "expanded" }),
  collapse: () => set({ mode: "collapsed" }),
  toggle: () =>
    set((state) => ({
      mode: state.mode === "collapsed" ? "expanded" : "collapsed",
    })),
  setSection: (section) => set({ section }),
  setQuery: (query) => set({ query }),
}));
