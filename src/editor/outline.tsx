"use client";

import { useState } from "react";
import type { Section } from "@/server/page-schema";
import { SECTION_LABELS } from "./blocks";
import { useEditor } from "./context";

function summary(s: Section) {
  const text = "headline" in s ? s.headline : "title" in s && s.title ? s.title : s.type === "image" ? s.image.alt : "";
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

/**
 * Section order. Mouse: drag and drop. Keyboard: Alt+↑ / Alt+↓ on a row.
 * The drop line appears instantly; reordering is a frequent, direct manipulation.
 */
export function Outline({ sections }: { sections: Section[] }) {
  const { dispatch, selected, errors } = useEditor();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const finish = () => {
    if (dragId !== null && dropIndex !== null) {
      const from = sections.findIndex((s) => s.id === dragId);
      // Dropping below the dragged row: the row itself leaves a gap above the target.
      dispatch({ type: "moveSection", sectionId: dragId, to: dropIndex > from ? dropIndex - 1 : dropIndex });
    }
    setDragId(null);
    setDropIndex(null);
  };

  return (
    <nav aria-label="Structure de la page">
      <ol className="flex flex-col" onDragEnd={finish}>
        {sections.map((s, i) => {
          const hasError = [...errors.keys()].some((k) => k.startsWith(`${s.id}:`));
          return (
            <li
              key={s.id}
              draggable
              onDragStart={(e) => {
                setDragId(s.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", s.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                setDropIndex(e.clientY < rect.top + rect.height / 2 ? i : i + 1);
              }}
              onDrop={(e) => {
                e.preventDefault();
                finish();
              }}
              className={`relative ${dragId === s.id ? "opacity-50" : ""}`}
            >
              {dropIndex === i && dragId && <span aria-hidden="true" className="absolute -top-px right-0 left-0 h-0.5 rounded-full bg-accent" />}
              <button
                type="button"
                aria-current={selected === s.id ? "true" : undefined}
                aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
                onClick={() => dispatch({ type: "select", sectionId: s.id })}
                onKeyDown={(e) => {
                  if (!e.altKey || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
                  e.preventDefault();
                  dispatch({ type: "moveSection", sectionId: s.id, to: e.key === "ArrowUp" ? i - 1 : i + 1 });
                }}
                className="flex w-full cursor-grab items-start gap-2 rounded-control px-2 py-1.5 text-left active:cursor-grabbing aria-[current=true]:bg-surface-sunken [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-sunken"
              >
                <span aria-hidden="true" className="mt-0.5 text-xs text-muted select-none">⋮⋮</span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">
                    {SECTION_LABELS[s.type]}
                    {hasError && <span className="ml-1.5 text-xs font-normal text-danger">· à corriger</span>}
                  </span>
                  <span className="truncate text-xs text-muted">{summary(s) || s.id}</span>
                </span>
              </button>
            </li>
          );
        })}
        {dropIndex === sections.length && dragId && <li aria-hidden="true" className="h-0.5 rounded-full bg-accent" />}
      </ol>
      <p className="mt-2 px-2 text-xs text-muted">Glissez pour réordonner, ou Alt + ↑/↓.</p>
    </nav>
  );
}
