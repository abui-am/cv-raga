"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore } from "zustand/vanilla";
import { useStore } from "zustand";
type Panel =
  "preview" | "edit" | "review" | "letter" | "personas" | "assistant";
type ReviewState = {
  panel: Panel;
  setPanel: (panel: Panel) => void;
  reset: () => void;
};
export const createReviewStore = () =>
  createStore<ReviewState>()((set, _get, store) => ({
    panel: "preview",
    setPanel: (panel) => set({ panel }),
    reset: () => set(store.getInitialState()),
  }));
const ReviewContext = createContext<ReturnType<
  typeof createReviewStore
> | null>(null);
export function ReviewProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createReviewStore);
  return (
    <ReviewContext.Provider value={store}>{children}</ReviewContext.Provider>
  );
}
export function useReviewStore<T>(selector: (state: ReviewState) => T) {
  const store = useContext(ReviewContext);
  if (!store) throw new Error("useReviewStore requires ReviewProvider");
  return useStore(store, selector);
}
