"use client";

import { createContext, use, type Dispatch } from "react";
import type { EditorAction } from "./state";

export type EditorContextValue = {
  dispatch: Dispatch<EditorAction>;
  /** setField with the timestamp used to group typing into one undo step. */
  setField: (sectionId: string, path: (string | number)[], value: unknown) => void;
  selected: string | null;
  /** Validation messages keyed by "sectionId:path.to.field". */
  errors: Map<string, string>;
  sectionIds: string[];
  /** Products of the workspace, for order forms. */
  products: { id: string; name: string; price: number; currency: string; active: boolean }[];
};

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor() {
  const value = use(EditorContext);
  if (!value) throw new Error("useEditor must be used inside the editor");
  return value;
}

export const errorKey = (sectionId: string, path: (string | number)[]) => `${sectionId}:${path.join(".")}`;
