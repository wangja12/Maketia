"use client";

import { useId, type ReactNode } from "react";
import type { PageContent, Section } from "@/server/page-schema";
import { contrastRatio, onAccent } from "@/server/page-validation";
import { SECTION_LABELS } from "./blocks";
import { errorKey, useEditor } from "./context";
import { SECTION_FIELDS, type FieldDef } from "./fields";
import type { Path } from "./state";

const control =
  "w-full rounded-control border border-border-strong bg-surface px-2.5 text-[16px] shadow-raised transition-[border-color] duration-150 placeholder:text-muted aria-invalid:border-danger sm:text-sm";

/** Reads a nested value from a section by path. */
function get(section: Section, path: Path): unknown {
  return path.reduce<unknown>((v, k) => (v as Record<string | number, unknown> | undefined)?.[k], section);
}

function useField(section: Section, path: Path) {
  const { setField, errors } = useEditor();
  return {
    value: get(section, path),
    error: errors.get(errorKey(section.id, path)),
    set: (value: unknown) => setField(section.id, path, value),
  };
}

function Field({ label, error, children, id }: { label: string; error?: string; children: ReactNode; id: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium">{label}</label>
      {children}
      {error && <p id={`${id}-err`} className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function TextInput({ section, path, label, multiline = false, placeholder }: { section: Section; path: Path; label: string; multiline?: boolean; placeholder?: string }) {
  const id = useId();
  const f = useField(section, path);
  const common = {
    id,
    value: (f.value as string | undefined) ?? "",
    placeholder,
    "aria-invalid": f.error ? true : undefined,
    "aria-describedby": f.error ? `${id}-err` : undefined,
  };
  return (
    <Field label={label} error={f.error} id={id}>
      {multiline ? (
        <textarea {...common} rows={3} onChange={(e) => f.set(e.target.value)} className={`${control} resize-y py-1.5`} />
      ) : (
        <input {...common} onChange={(e) => f.set(e.target.value)} className={`${control} h-9 sm:h-8`} />
      )}
    </Field>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium" id={`seg-${label}`}>{label}</span>
      <div role="radiogroup" aria-labelledby={`seg-${label}`} className="inline-flex w-fit gap-0.5 rounded-control bg-surface-sunken p-0.5">
        {options.map(([v, l]) => (
          <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
            className="pressable h-7 rounded-[6px] px-2.5 text-xs text-muted aria-checked:bg-surface aria-checked:font-medium aria-checked:text-fg aria-checked:shadow-raised">
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function SmallButton({ children, onClick, disabled, label }: { children: ReactNode; onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="pressable h-7 min-w-7 rounded-[6px] px-2 text-xs text-muted disabled:opacity-40 [@media(hover:hover)_and_(pointer:fine)]:hover:enabled:bg-surface-sunken [@media(hover:hover)_and_(pointer:fine)]:hover:enabled:text-fg">
      {children}
    </button>
  );
}

/** Array editing helpers: every change replaces the whole array (one undo step). */
function ListControls({ list, index, set, itemLabel, min }: { list: unknown[]; index: number; set: (v: unknown[]) => void; itemLabel: string; min: number }) {
  const move = (to: number) => {
    const next = [...list];
    const [x] = next.splice(index, 1);
    next.splice(to, 0, x);
    set(next);
  };
  return (
    <div className="flex shrink-0">
      <SmallButton label={`Monter ${itemLabel} ${index + 1}`} disabled={index === 0} onClick={() => move(index - 1)}>↑</SmallButton>
      <SmallButton label={`Descendre ${itemLabel} ${index + 1}`} disabled={index === list.length - 1} onClick={() => move(index + 1)}>↓</SmallButton>
      <SmallButton label={`Retirer ${itemLabel} ${index + 1}`} disabled={list.length <= min} onClick={() => set(list.filter((_, i) => i !== index))}>✕</SmallButton>
    </div>
  );
}

function FieldEditor({ section, def }: { section: Section; def: FieldDef }) {
  const { setField } = useEditor();
  const value = get(section, [def.key]);
  const setRoot = (v: unknown) => setField(section.id, [def.key], v);

  switch (def.kind) {
    case "text":
    case "textarea":
      return <TextInput section={section} path={[def.key]} label={def.label + (def.optional ? " (facultatif)" : "")} multiline={def.kind === "textarea"} />;
    case "number":
      return <NumberInput section={section} path={[def.key]} label={def.label} />;
    case "currency":
      return <TextInput section={section} path={[def.key]} label={def.label} placeholder="XOF" />;
    case "product":
      return <ProductSelect section={section} path={[def.key]} label={def.label} />;
    case "confirm":
      return (
        <label className="flex items-start gap-2 rounded-control bg-surface-sunken p-2 text-xs">
          <input type="checkbox" checked={value === true} onChange={(e) => setRoot(e.target.checked ? true : false)} className="mt-0.5 accent-[var(--accent)]" />
          <span>{def.label} Sans cette confirmation, la section ne peut pas être enregistrée.</span>
        </label>
      );
    case "cta":
    case "image": {
      const present = value !== undefined;
      const blank = def.kind === "cta" ? { label: "Je commence", href: "#" } : { url: "https://", alt: "Décrivez l’image" };
      return (
        <fieldset className="flex flex-col gap-2 rounded-control border border-border p-2.5">
          <legend className="px-1 text-xs font-medium">{def.label}</legend>
          {def.optional && (
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={present} onChange={(e) => setRoot(e.target.checked ? blank : undefined)} className="accent-[var(--accent)]" />
              Afficher
            </label>
          )}
          {present && def.kind === "cta" && (
            <>
              <TextInput section={section} path={[def.key, "label"]} label="Libellé" />
              <TextInput section={section} path={[def.key, "href"]} label="Lien (https://…, /chemin ou #section)" />
            </>
          )}
          {present && def.kind === "image" && (
            <>
              <TextInput section={section} path={[def.key, "url"]} label="Adresse de l’image (https://)" />
              <TextInput section={section} path={[def.key, "alt"]} label="Texte alternatif (ce que montre l’image)" />
              <p className="text-xs text-muted">L’import de fichiers arrivera avec le stockage d’images.</p>
            </>
          )}
        </fieldset>
      );
    }
    case "strings": {
      const list = (value as string[]) ?? [];
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium">{def.label}</legend>
          {list.map((_, i) => (
            <div key={i} className="flex items-end gap-1">
              <div className="min-w-0 flex-1"><TextInput section={section} path={[def.key, i]} label={`${def.itemLabel} ${i + 1}`} /></div>
              <ListControls list={list} index={i} set={setRoot} itemLabel={def.itemLabel} min={def.min} />
            </div>
          ))}
          <SmallButton disabled={list.length >= def.max} onClick={() => setRoot([...list, `${def.itemLabel} ${list.length + 1}`])}>
            + Ajouter ({list.length}/{def.max})
          </SmallButton>
        </fieldset>
      );
    }
    case "items": {
      const list = (value as Record<string, string>[]) ?? [];
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-xs font-medium">{def.label}</legend>
          {list.map((_, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-control border border-border p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">{def.itemLabel} {i + 1}</span>
                <ListControls list={list} index={i} set={setRoot} itemLabel={def.itemLabel} min={1} />
              </div>
              {def.fields.map((sf) => (
                <TextInput key={sf.key} section={section} path={[def.key, i, sf.key]} label={sf.label + (sf.optional ? " (facultatif)" : "")} multiline={sf.kind === "textarea"} />
              ))}
            </div>
          ))}
          <SmallButton disabled={list.length >= def.max} onClick={() => setRoot([...list, { ...def.blank }])}>
            + Ajouter ({list.length}/{def.max})
          </SmallButton>
        </fieldset>
      );
    }
  }
}

function ProductSelect({ section, path, label }: { section: Section; path: Path; label: string }) {
  const id = useId();
  const f = useField(section, path);
  const { products } = useEditor();
  return (
    <Field label={label} error={f.error} id={id}>
      <select id={id} value={(f.value as string) || ""} onChange={(e) => f.set(e.target.value)}
        aria-invalid={f.error ? true : undefined} className={`${control} h-9 sm:h-8`}>
        <option value="">Choisir un produit…</option>
        {products.map((p) => (
          <option key={p.id} value={p.id} disabled={!p.active}>
            {p.name} · {p.price} {p.currency}{p.active ? "" : " (désactivé)"}
          </option>
        ))}
      </select>
      {products.length === 0 && <p className="text-xs text-muted">Aucun produit : créez-en un dans Paiements.</p>}
      <p className="text-xs text-muted">Le prix affiché et encaissé est toujours celui du produit.</p>
    </Field>
  );
}

function NumberInput({ section, path, label }: { section: Section; path: Path; label: string }) {
  const id = useId();
  const f = useField(section, path);
  return (
    <Field label={label} error={f.error} id={id}>
      <input id={id} type="number" inputMode="decimal" min={0} step="any" value={String(f.value ?? 0)}
        onChange={(e) => f.set(e.target.value === "" ? 0 : Number(e.target.value))} className={`${control} h-9 sm:h-8`} />
    </Field>
  );
}

export function SectionPanel({ section }: { section: Section }) {
  const { dispatch } = useEditor();
  const layout = section.layout ?? {};
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{SECTION_LABELS[section.type]}</h2>
        <button type="button" onClick={() => dispatch({ type: "select", sectionId: null })} className="text-xs text-muted underline-offset-4 hover:underline">
          Thème de la page
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        <Segmented label="Alignement" value={layout.align ?? "left"} options={[["left", "Gauche"], ["center", "Centré"]]}
          onChange={(align) => dispatch({ type: "setLayout", sectionId: section.id, layout: { align } })} />
        <Segmented label="Espacement" value={layout.spacing ?? "normal"} options={[["compact", "Serré"], ["normal", "Normal"], ["airy", "Aéré"]]}
          onChange={(spacing) => dispatch({ type: "setLayout", sectionId: section.id, layout: { spacing } })} />
      </div>
      {SECTION_FIELDS[section.type].map((def) => (
        <FieldEditor key={`${section.id}-${def.key}`} section={section} def={def} />
      ))}
    </div>
  );
}

export function ThemePanel({ theme }: { theme: PageContent["theme"] }) {
  const { dispatch } = useEditor();
  const set = (changes: Partial<PageContent["theme"]>) => dispatch({ type: "setTheme", changes, at: Date.now() });
  const valid = /^#[0-9a-fA-F]{6}$/.test(theme.accent);
  const ratio = valid ? contrastRatio(theme.accent, onAccent(theme.accent)) : 0;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold">Thème de la page</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="theme-accent" className="text-xs font-medium">Couleur d’accent</label>
        <div className="flex gap-2">
          <input type="color" aria-label="Choisir la couleur d’accent" value={valid ? theme.accent : "#000000"} onChange={(e) => set({ accent: e.target.value })}
            className="h-9 w-12 shrink-0 cursor-pointer rounded-control border border-border-strong bg-surface p-0.5 sm:h-8" />
          <input id="theme-accent" value={theme.accent} onChange={(e) => set({ accent: e.target.value })} maxLength={7}
            aria-invalid={!valid || ratio < 4.5 ? true : undefined} aria-describedby="theme-accent-help"
            className={`${control} h-9 font-mono sm:h-8`} />
        </div>
        <p id="theme-accent-help" className={`text-xs ${!valid || ratio < 4.5 ? "text-danger" : "text-muted"}`}>
          {!valid ? "Format attendu : #RRGGBB." : `Contraste des boutons : ${ratio.toFixed(1)}:1 ${ratio < 4.5 ? "(insuffisant, 4.5:1 minimum : publication bloquée)" : "(conforme)"}`}
        </p>
      </div>
      <Segmented label="Fond" value={theme.background} options={[["light", "Clair"], ["dark", "Sombre"]]} onChange={(background) => set({ background })} />
      <Segmented label="Police" value={theme.font} options={[["sans", "Sans empattement"], ["serif", "Avec empattement"]]} onChange={(font) => set({ font })} />
    </div>
  );
}
