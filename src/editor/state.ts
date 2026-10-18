import type { PageContent, Section, SectionLayout } from "@/server/page-schema";
import { freeSectionId } from "./blocks";

/*
 * Editor state as a pure reducer: every change produces a new content object and touches
 * only the edited section, so unchanged sections keep their identity and skip re-rendering.
 */

export type Path = (string | number)[];

export type EditorState = {
  content: PageContent;
  past: PageContent[];
  future: PageContent[];
  selected: string | null;
  /** Consecutive edits of the same field within COALESCE_MS form one undo step. */
  lastKey: string | null;
  lastAt: number;
};

export const COALESCE_MS = 1200;
const HISTORY_LIMIT = 100;

export type EditorAction =
  | { type: "setField"; sectionId: string; path: Path; value: unknown; at: number }
  | { type: "setLayout"; sectionId: string; layout: SectionLayout }
  | { type: "setTheme"; changes: Partial<PageContent["theme"]>; at: number }
  | { type: "addSection"; section: Section; index?: number }
  | { type: "removeSection"; sectionId: string }
  | { type: "duplicateSection"; sectionId: string }
  | { type: "moveSection"; sectionId: string; to: number }
  | { type: "select"; sectionId: string | null }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "load"; content: PageContent };

export function initEditor(content: PageContent): EditorState {
  return { content, past: [], future: [], selected: null, lastKey: null, lastAt: 0 };
}

/** Immutable set at a nested path; copies only the objects along the path. */
export function setIn<T>(target: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const source = target as unknown as Record<string | number, unknown>;
  const copy = (Array.isArray(target) ? [...target] : { ...source }) as Record<string | number, unknown>;
  copy[head] = setIn(source?.[head], rest, value);
  return copy as T;
}

function commit(state: EditorState, content: PageContent, key: string | null = null, at = 0): EditorState {
  if (content === state.content) return state;
  const coalesce = key !== null && key === state.lastKey && at - state.lastAt < COALESCE_MS;
  return {
    ...state,
    content,
    past: coalesce ? state.past : [...state.past, state.content].slice(-HISTORY_LIMIT),
    future: [],
    lastKey: key,
    lastAt: at,
  };
}

function mapSection(content: PageContent, sectionId: string, fn: (s: Section) => Section): PageContent {
  const index = content.sections.findIndex((s) => s.id === sectionId);
  if (index === -1) return content;
  const sections = [...content.sections];
  sections[index] = fn(sections[index]);
  return { ...content, sections };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { content } = state;
  switch (action.type) {
    case "setField":
      return commit(
        state,
        mapSection(content, action.sectionId, (s) => setIn(s, action.path, action.value)),
        `${action.sectionId}:${action.path.join(".")}`,
        action.at,
      );
    case "setLayout":
      return commit(state, mapSection(content, action.sectionId, (s) => ({ ...s, layout: { ...s.layout, ...action.layout } })));
    case "setTheme":
      return commit(state, { ...content, theme: { ...content.theme, ...action.changes } }, `theme:${Object.keys(action.changes).join(",")}`, action.at);
    case "addSection": {
      const sections = [...content.sections];
      const index = action.index ?? sections.length;
      sections.splice(Math.max(0, Math.min(index, sections.length)), 0, action.section);
      return { ...commit(state, { ...content, sections }), selected: action.section.id };
    }
    case "removeSection": {
      const sections = content.sections.filter((s) => s.id !== action.sectionId);
      if (sections.length === content.sections.length) return state;
      return { ...commit(state, { ...content, sections }), selected: state.selected === action.sectionId ? null : state.selected };
    }
    case "duplicateSection": {
      const index = content.sections.findIndex((s) => s.id === action.sectionId);
      if (index === -1) return state;
      const source = content.sections[index];
      const copy = { ...structuredClone(source), id: freeSectionId(content, source.type) };
      const sections = [...content.sections];
      sections.splice(index + 1, 0, copy);
      return { ...commit(state, { ...content, sections }), selected: copy.id };
    }
    case "moveSection": {
      const from = content.sections.findIndex((s) => s.id === action.sectionId);
      const to = Math.max(0, Math.min(action.to, content.sections.length - 1));
      if (from === -1 || from === to) return state;
      const sections = [...content.sections];
      const [moved] = sections.splice(from, 1);
      sections.splice(to, 0, moved);
      return commit(state, { ...content, sections });
    }
    case "select":
      return state.selected === action.sectionId ? state : { ...state, selected: action.sectionId };
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return { ...state, content: previous, past: state.past.slice(0, -1), future: [state.content, ...state.future], lastKey: null };
    }
    case "redo": {
      const [next, ...future] = state.future;
      if (!next) return state;
      return { ...state, content: next, past: [...state.past, state.content], future, lastKey: null };
    }
    case "load":
      // A version loaded from the server starts a fresh history: undo must not cross it.
      return { ...initEditor(action.content), selected: action.content.sections.some((s) => s.id === state.selected) ? state.selected : null };
  }
}
