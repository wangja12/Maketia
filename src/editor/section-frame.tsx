"use client";

import type { ReactNode } from "react";
import type { Section } from "@/server/page-schema";
import { SECTION_LABELS } from "./blocks";
import { useEditor } from "./context";

/** Selection outline and quick actions around a section in the canvas. */
export function SectionFrame({ section, children }: { section: Section; children: ReactNode }) {
  const { dispatch, selected, errors, sectionIds } = useEditor();
  const isSelected = selected === section.id;
  const index = sectionIds.indexOf(section.id);
  const hasError = [...errors.keys()].some((k) => k.startsWith(`${section.id}:`));

  return (
    <div
      data-section={section.id}
      data-selected={isSelected || undefined}
      data-error={hasError || undefined}
      className="section-frame relative"
      onClickCapture={() => dispatch({ type: "select", sectionId: section.id })}
    >
      {children}
      {isSelected && (
        <div
          role="toolbar"
          aria-label={`Actions sur la section ${SECTION_LABELS[section.type]}`}
          // Appears with the selection, no transition: selecting happens many times per session.
          className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-control bg-[#1c1b19] p-0.5 font-sans text-xs text-white shadow-overlay"
        >
          <span className="px-2 text-white/70">{SECTION_LABELS[section.type]}</span>
          <ToolButton label="Monter" disabled={index === 0} onClick={() => dispatch({ type: "moveSection", sectionId: section.id, to: index - 1 })}>↑</ToolButton>
          <ToolButton label="Descendre" disabled={index === sectionIds.length - 1} onClick={() => dispatch({ type: "moveSection", sectionId: section.id, to: index + 1 })}>↓</ToolButton>
          <ToolButton label="Dupliquer" onClick={() => dispatch({ type: "duplicateSection", sectionId: section.id })}>Dupliquer</ToolButton>
          <ToolButton label="Supprimer (annulable)" onClick={() => dispatch({ type: "removeSection", sectionId: section.id })}>Supprimer</ToolButton>
        </div>
      )}
    </div>
  );
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="pressable h-7 min-w-7 rounded-[6px] px-2 disabled:opacity-40 [@media(hover:hover)_and_(pointer:fine)]:hover:enabled:bg-white/15"
    >
      {children}
    </button>
  );
}
