"use client";

import { useState } from "react";

const DEVICES = [
  { id: "desktop", label: "Bureau", width: "100%" },
  { id: "tablet", label: "Tablette", width: "768px" },
  { id: "mobile", label: "Mobile", width: "375px" },
] as const;

/**
 * The page renders in an iframe so its own media queries respond to the chosen width.
 * Switching device is instant: animating width would trigger layout every frame.
 */
export function DevicePreview({ src, title }: { src: string; title: string }) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const current = DEVICES.find((d) => d.id === device)!;
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Taille de l’aperçu" className="inline-flex w-fit gap-0.5 rounded-control bg-surface-sunken p-0.5">
        {DEVICES.map((d) => (
          <button
            key={d.id}
            type="button"
            role="radio"
            aria-checked={device === d.id}
            onClick={() => setDevice(d.id)}
            className="pressable h-8 rounded-[6px] px-3 text-sm text-muted aria-checked:bg-surface aria-checked:font-medium aria-checked:text-fg aria-checked:shadow-raised"
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-card border border-border bg-surface-sunken">
        <iframe
          key={src}
          src={src}
          title={title}
          style={{ width: current.width }}
          className="mx-auto block h-[70dvh] max-w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}
