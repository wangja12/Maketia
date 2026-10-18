"use client";

import { useLayoutEffect, useRef } from "react";
import type { TextSlotProps } from "@/components/page-renderer";
import { errorKey, useEditor } from "./context";

/**
 * Direct text editing in the canvas. The element is uncontrolled while focused: React never
 * rewrites its text during typing (which would move the caret); it syncs only when the value
 * changes from elsewhere (panel, undo) and the element is not being edited.
 */
export function EditableText({ sectionId, path, value, label, as: Tag, className = "", multiline = false }: TextSlotProps) {
  const ref = useRef<HTMLElement>(null);
  const { dispatch, setField, errors } = useEditor();
  const error = errors.get(errorKey(sectionId, path));

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== value) el.innerText = value;
  }, [value]);

  return (
    <Tag
      ref={ref as never}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      aria-multiline={multiline || undefined}
      aria-invalid={error ? true : undefined}
      title={error}
      spellCheck
      data-editable=""
      className={`editable ${className}`}
      onFocus={() => dispatch({ type: "select", sectionId })}
      onInput={(e) => {
        let next = e.currentTarget.innerText;
        if (!multiline) next = next.replace(/\n+/g, " ");
        setField(sectionId, path, next.replace(/\n+$/, ""));
      }}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      onBlur={(e) => {
        // Normalize what the browser left in the DOM (trailing <br>, nbsp) to the stored value.
        if (e.currentTarget.innerText !== value) e.currentTarget.innerText = value;
      }}
    />
  );
}
