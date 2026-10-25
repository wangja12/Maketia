"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { PageRenderer, type EditHooks } from "@/components/page-renderer";
import { Button } from "@/components/ui/button";
import { pageContentSchema, type PageContent } from "@/server/page-schema";
import { BlockLibrary } from "./block-library";
import { EditorContext, errorKey, type EditorContextValue } from "./context";
import { EditableText } from "./editable-text";
import { Outline } from "./outline";
import { SectionPanel, ThemePanel } from "./panel";
import { SectionFrame } from "./section-frame";
import { editorReducer, initEditor } from "./state";

export type EditorServer = {
  save: (baseVersion: number, content: PageContent) => Promise<
    { ok: true; version: number } | { ok: false; conflict: true; currentVersion: number } | { ok: false; conflict: false; error: string }
  >;
  head: () => Promise<{ currentVersion: number; author: string; agent: boolean } | null>;
  load: () => Promise<{ version: number; content: PageContent } | null>;
};

/** Result of the last save request; what the user sees is derived from it plus local state. */
type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string }
  | { kind: "conflict"; currentVersion: number };

type Status =
  | SaveState
  | { kind: "saved" }
  | { kind: "pending" }
  | { kind: "invalid"; count: number; firstSection: string | null };

const DEVICES = [
  { id: "desktop", label: "Bureau", width: "100%" },
  { id: "tablet", label: "Tablette", width: "768px" },
  { id: "mobile", label: "Mobile", width: "375px" },
] as const;

const AUTOSAVE_MS = 800;
const POLL_MS = 10_000;

// Stable across renders so memoized sections are not re-rendered by a new hooks object.
const EDIT_HOOKS: EditHooks = { Text: EditableText, Section: SectionFrame };

export function Editor({
  initialContent,
  initialVersion,
  title,
  backHref,
  server,
  products,
  review = [],
  skillVersion,
}: {
  initialContent: PageContent;
  initialVersion: number;
  title: string;
  backHref: string;
  server: EditorServer;
  products: EditorContextValue["products"];
  /** Manual review list (wang-design-engineering), ticked for real in the Publication panel. */
  review?: string[];
  skillVersion?: string;
}) {
  const [state, dispatch] = useReducer(editorReducer, initialContent, initEditor);
  const [saved, setSaved] = useState({ content: initialContent, version: initialVersion });
  const [saveState, setStatus] = useState<SaveState>({ kind: "idle" });
  const [remote, setRemote] = useState<{ currentVersion: number; author: string } | null>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [previewMode, setPreviewMode] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const savingRef = useRef(false);
  const latest = useRef({ content: state.content, saved });
  useEffect(() => {
    latest.current = { content: state.content, saved };
  });

  const dirty = state.content !== saved.content;

  // Client-side validation with the same schema as the server: errors show inline, and
  // autosave waits until the page is valid instead of failing on every keystroke.
  const errors = useMemo(() => {
    const map = new Map<string, string>();
    const parsed = pageContentSchema.safeParse(state.content);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [root, index, ...rest] = issue.path;
        if (root === "sections" && typeof index === "number" && state.content.sections[index]) {
          const key = errorKey(state.content.sections[index].id, rest as (string | number)[]);
          if (!map.has(key)) map.set(key, issue.message);
        } else map.set(`page:${issue.path.join(".")}`, issue.message);
      }
    }
    return map;
  }, [state.content]);

  const save = useCallback(
    async (baseOverride?: number) => {
      if (savingRef.current) return;
      const { content, saved: current } = latest.current;
      savingRef.current = true;
      setStatus({ kind: "saving" });
      try {
        const result = await server.save(baseOverride ?? current.version, content);
        if (result.ok) {
          setSaved({ content, version: result.version });
          setRemote(null);
          setStatus({ kind: "idle" });
        } else if (result.conflict) {
          setStatus({ kind: "conflict", currentVersion: result.currentVersion });
        } else {
          setStatus({ kind: "error", message: result.error });
        }
      } catch {
        setStatus({ kind: "error", message: "Connexion perdue. Tes modifications sont conservées ici." });
      } finally {
        savingRef.current = false;
      }
    },
    [server],
  );

  const status: Status = (() => {
    if (saveState.kind === "conflict" || saveState.kind === "saving") return saveState;
    if (!dirty) return { kind: "saved" };
    if (errors.size > 0) {
      const first = [...errors.keys()].find((k) => !k.startsWith("page:"));
      return { kind: "invalid", count: errors.size, firstSection: first ? first.split(":")[0] : null };
    }
    return saveState.kind === "error" ? saveState : { kind: "pending" };
  })();

  // Autosave: debounce, only when valid, never while a conflict waits for a decision.
  useEffect(() => {
    if (!dirty || errors.size > 0 || saveState.kind === "conflict" || saveState.kind === "saving") return;
    const timer = setTimeout(() => void save(), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [state.content, saved, dirty, errors, saveState.kind, save]);

  // Watch for versions saved elsewhere (an MCP agent, another tab). Never applied silently.
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible" || savingRef.current) return;
      const head = await server.head().catch(() => null);
      if (head && head.currentVersion > latest.current.saved.version) setRemote(head);
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [server]);

  const loadLatest = useCallback(async () => {
    const latestVersion = await server.load();
    if (!latestVersion) return;
    dispatch({ type: "load", content: latestVersion.content });
    setSaved({ content: latestVersion.content, version: latestVersion.version });
    setRemote(null);
    setStatus({ kind: "idle" });
  }, [server]);

  // Keyboard shortcuts. Undo/redo are ours, not the browser's, so they also cover panel and structure edits.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && k === "y") {
        e.preventDefault();
        (document.activeElement as HTMLElement | null)?.blur();
        dispatch({ type: "redo" });
      } else if (mod && k === "s") {
        e.preventDefault();
        if (errors.size === 0 && status.kind !== "conflict") void save();
      } else if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
        (document.activeElement as HTMLElement | null)?.blur();
        dispatch({ type: "select", sectionId: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [errors, status.kind, save]);

  // Leaving with unsaved work asks first.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (latest.current.content !== latest.current.saved.content || savingRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const setField = useCallback(
    (sectionId: string, path: (string | number)[], value: unknown) => dispatch({ type: "setField", sectionId, path, value, at: Date.now() }),
    [],
  );
  const context: EditorContextValue = useMemo(
    () => ({ dispatch, setField, selected: state.selected, errors, sectionIds: state.content.sections.map((s) => s.id), products }),
    [setField, state.selected, errors, state.content.sections, products],
  );
  const productMap = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p])), [products]);
  const selectedSection = state.content.sections.find((s) => s.id === state.selected) ?? null;
  const width = DEVICES.find((d) => d.id === device)!.width;
  const pageErrors = [...errors.entries()].filter(([k]) => k.startsWith("page:"));

  return (
    <EditorContext value={context}>
      <div className="flex flex-col gap-3">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href={backHref} className="text-sm text-muted underline-offset-4 hover:underline">← {title}</Link>
          <StatusLine status={status} saved={saved.version} onRetry={() => void save()} onShowError={(id) => dispatch({ type: "select", sectionId: id })} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5">
              <Button variant="ghost" className="h-8 px-2.5" disabled={state.past.length === 0} onClick={() => dispatch({ type: "undo" })} aria-keyshortcuts="Control+Z Meta+Z">Annuler</Button>
              <Button variant="ghost" className="h-8 px-2.5" disabled={state.future.length === 0} onClick={() => dispatch({ type: "redo" })} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y">Rétablir</Button>
            </div>
            <div role="radiogroup" aria-label="Taille de l’aperçu" className="inline-flex gap-0.5 rounded-control bg-surface-sunken p-0.5">
              {DEVICES.map((d) => (
                <button key={d.id} type="button" role="radio" aria-checked={device === d.id} onClick={() => setDevice(d.id)}
                  className="pressable h-7 rounded-[6px] px-2.5 text-sm text-muted aria-checked:bg-surface aria-checked:font-medium aria-checked:text-fg aria-checked:shadow-raised">
                  {d.label}
                </button>
              ))}
            </div>
            <Button variant="secondary" className="h-8" aria-pressed={previewMode} onClick={() => { setPreviewMode((p) => !p); dispatch({ type: "select", sectionId: null }); }}>
              {previewMode ? "Revenir à l’édition" : "Aperçu"}
            </Button>
            {!previewMode && <Button className="h-8" onClick={() => setLibraryOpen(true)}>Ajouter une section</Button>}
          </div>
        </header>

        {remote && status.kind !== "conflict" && (
          <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control border border-border-strong bg-surface px-3 py-2 text-sm">
            <span>La version {remote.currentVersion} a été enregistrée par {remote.author}. Ton écran n’a pas été modifié.</span>
            {dirty ? (
              <span className="text-muted">Ta prochaine sauvegarde te demandera quelle version garder.</span>
            ) : (
              <button type="button" onClick={() => void loadLatest()} className="font-medium text-accent underline-offset-4 hover:underline">Afficher la version {remote.currentVersion}</button>
            )}
          </div>
        )}

        {status.kind === "conflict" && (
          <div role="alert" className="flex flex-col gap-2 rounded-control border border-danger bg-danger-soft px-3 py-2.5 text-sm">
            <p>
              <span className="font-semibold">Conflit :</span> la version {status.currentVersion} a été enregistrée pendant que tu modifiais la page.
              Rien n’a été écrasé.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button className="h-8" onClick={() => void save(status.currentVersion)}>Garder ma version (nouvelle version {status.currentVersion + 1})</Button>
              <Button variant="secondary" className="h-8" onClick={() => void loadLatest()}>Charger la version {status.currentVersion} (abandonner mes changements non enregistrés)</Button>
            </div>
          </div>
        )}

        {pageErrors.length > 0 && (
          <p role="alert" className="rounded-control bg-danger-soft px-3 py-2 text-sm text-danger">{pageErrors[0][1]}</p>
        )}

        <div className={`grid gap-4 ${previewMode ? "" : "lg:grid-cols-[14rem_minmax(0,1fr)_20rem]"}`}>
          {!previewMode && (
            <aside className="order-3 lg:order-1">
              <h2 className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted uppercase">Structure</h2>
              <Outline sections={state.content.sections} />
              {review.length > 0 && (
                <details className="mt-4 px-2 text-xs">
                  <summary className="cursor-pointer font-semibold text-muted">Revue avant publication</summary>
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-muted">
                    {review.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  <p className="mt-2 text-muted">
                    Points à vérifier toi-même : ils sont cochés au moment de publier.{skillVersion ? ` Règles : wang-design-engineering ${skillVersion}.` : ""}
                  </p>
                </details>
              )}
            </aside>
          )}

          <main className="order-1 min-w-0 lg:order-2" aria-label="Page en cours d’édition">
            {/* Focusable so keyboard users can scroll the page with the arrow keys. */}
            <div tabIndex={0} role="group" aria-label="Défilement de la page" className="h-[calc(100dvh-12rem)] min-h-96 overflow-auto rounded-card border border-border bg-surface-sunken">
              <div style={{ width }} className="mx-auto max-w-full bg-white" data-editor-canvas={previewMode ? undefined : ""}>
                <PageRenderer content={state.content} edit={previewMode ? undefined : EDIT_HOOKS} products={productMap} className="min-h-full" />
              </div>
            </div>
          </main>

          {!previewMode && (
            <aside aria-label="Propriétés" className="order-2 lg:order-3 lg:h-[calc(100dvh-12rem)] lg:overflow-auto">
              {selectedSection ? <SectionPanel section={selectedSection} /> : <ThemePanel theme={state.content.theme} />}
            </aside>
          )}
        </div>
      </div>
      <BlockLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} content={state.content} />
    </EditorContext>
  );
}

/** Real save state, updated without animation: it changes every few seconds while typing. */
function StatusLine({ status, saved, onRetry, onShowError }: { status: Status; saved: number; onRetry: () => void; onShowError: (id: string) => void }) {
  let content: React.ReactNode;
  switch (status.kind) {
    case "saved":
      content = <span className="text-muted">Enregistré · v{saved}</span>;
      break;
    case "pending":
      content = <span className="text-muted">Modifications non enregistrées…</span>;
      break;
    case "saving":
      content = <span className="text-muted">Enregistrement…</span>;
      break;
    case "invalid":
      content = (
        <span className="text-danger">
          Non enregistré : {status.count} {status.count > 1 ? "champs à corriger" : "champ à corriger"}.{" "}
          {status.firstSection && (
            <button type="button" className="font-medium underline underline-offset-4" onClick={() => onShowError(status.firstSection!)}>Voir</button>
          )}
        </span>
      );
      break;
    case "error":
      content = (
        <span className="text-danger">
          Échec de l’enregistrement : {status.message}{" "}
          <button type="button" className="font-medium underline underline-offset-4" onClick={onRetry}>Réessayer</button>
        </span>
      );
      break;
    case "conflict":
      content = <span className="text-danger">Conflit de versions</span>;
      break;
  }
  return (
    <p role="status" aria-live="polite" className="text-sm">
      {content}
    </p>
  );
}


