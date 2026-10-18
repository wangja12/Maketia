"use client";

import { Dialog } from "@/components/ui/dialog";
import type { PageContent } from "@/server/page-schema";
import { BLOCKS, freeSectionId } from "./blocks";
import { useEditor } from "./context";

export function BlockLibrary({ open, onClose, content }: { open: boolean; onClose: () => void; content: PageContent }) {
  const { dispatch, selected } = useEditor();
  const after = selected ? content.sections.findIndex((s) => s.id === selected) + 1 : content.sections.length;
  return (
    <Dialog open={open} onClose={onClose} title="Ajouter une section" description={selected ? "Elle sera insérée après la section sélectionnée." : "Elle sera ajoutée en fin de page."}>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {BLOCKS.map((b) => (
          <li key={b.type}>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "addSection", section: b.create(freeSectionId(content, b.type)), index: after });
                onClose();
              }}
              className="pressable flex h-full w-full flex-col items-start gap-0.5 rounded-control border border-border p-3 text-left [@media(hover:hover)_and_(pointer:fine)]:hover:border-border-strong [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-sunken"
            >
              <span className="text-sm font-medium">{b.label}</span>
              <span className="text-xs text-muted">{b.description}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
