import { describe, expect, it } from "vitest";
import { BLOCKS, freeSectionId } from "@/editor/blocks";
import { COALESCE_MS, editorReducer, initEditor, setIn, type EditorAction, type EditorState } from "@/editor/state";
import { pageContentSchema, type PageContent } from "@/server/page-schema";
import { templateFor } from "@/server/page-templates";

const run = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, state);
const headline = (c: PageContent) => (c.sections[0] as { headline: string }).headline;

describe("setIn", () => {
  it("copies only the path", () => {
    const src = { a: { b: [1, 2] }, c: { d: 1 } };
    const out = setIn(src, ["a", "b", 1], 9);
    expect(out).toEqual({ a: { b: [1, 9] }, c: { d: 1 } });
    expect(out.c).toBe(src.c);
    expect(src.a.b[1]).toBe(2);
  });
});

describe("editor reducer", () => {
  it("edits one section and keeps the others' identity (no needless re-render)", () => {
    const s0 = initEditor(templateFor("sales"));
    const s1 = run(s0, { type: "setField", sectionId: "hero", path: ["headline"], value: "Nouveau", at: 0 });
    expect(headline(s1.content)).toBe("Nouveau");
    expect(s1.content.sections[1]).toBe(s0.content.sections[1]);
    expect(s1.content.theme).toBe(s0.content.theme);
  });

  it("coalesces typing in one field into a single undo step", () => {
    let s = initEditor(templateFor("landing"));
    for (const [i, v] of ["V", "Vo", "Vot"].entries()) {
      s = editorReducer(s, { type: "setField", sectionId: "hero", path: ["headline"], value: v, at: i * 100 });
    }
    expect(s.past).toHaveLength(1);
    s = editorReducer(s, { type: "setField", sectionId: "hero", path: ["headline"], value: "Votre", at: 300 + COALESCE_MS });
    expect(s.past).toHaveLength(2);
    s = editorReducer(s, { type: "undo" });
    expect(headline(s.content)).toBe("Vot");
    s = editorReducer(s, { type: "undo" });
    expect(headline(s.content)).toBe(headline(templateFor("landing")));
    s = editorReducer(s, { type: "redo" });
    expect(headline(s.content)).toBe("Vot");
  });

  it("a new edit after undo clears the redo stack", () => {
    let s = run(initEditor(templateFor("landing")), { type: "setTheme", changes: { accent: "#000000" }, at: 0 }, { type: "undo" });
    expect(s.future).toHaveLength(1);
    s = editorReducer(s, { type: "setTheme", changes: { font: "serif" }, at: 10 });
    expect(s.future).toHaveLength(0);
  });

  it("adds, duplicates, moves and removes sections with unique ids", () => {
    let s = initEditor(templateFor("landing"));
    s = run(s, { type: "duplicateSection", sectionId: "hero" });
    expect(s.content.sections.map((x) => x.id)).toEqual(["hero", "hero-2", "benefices", "offre"]);
    expect(s.selected).toBe("hero-2");
    s = run(s, { type: "moveSection", sectionId: "hero-2", to: 3 });
    expect(s.content.sections.map((x) => x.id)).toEqual(["hero", "benefices", "offre", "hero-2"]);
    s = run(s, { type: "removeSection", sectionId: "hero-2" });
    expect(s.selected).toBeNull();
    const block = BLOCKS.find((b) => b.type === "faq")!;
    s = run(s, { type: "addSection", section: block.create(freeSectionId(s.content, "faq")), index: 1 });
    expect(s.content.sections.map((x) => x.id)).toEqual(["hero", "faq", "benefices", "offre"]);
    expect(pageContentSchema.safeParse(s.content).success).toBe(true);
    for (let i = 0; i < 4; i++) s = editorReducer(s, { type: "undo" });
    expect(s.content).toEqual(templateFor("landing"));
  });

  it("loading a server version resets history", () => {
    const s = run(initEditor(templateFor("landing")), { type: "setTheme", changes: { font: "serif" }, at: 0 }, { type: "load", content: templateFor("sales") });
    expect(s.past).toEqual([]);
    expect(s.content).toEqual(templateFor("sales"));
  });
});

describe("block library", () => {
  it("every block except the image placeholder is valid as inserted", () => {
    for (const b of BLOCKS) {
      const page = { ...templateFor("other"), sections: [b.create(b.type)] };
      const ok = pageContentSchema.safeParse(page).success;
      // Image and order-form blocks start incomplete on purpose (URL, product) and must be filled in.
      expect(ok, b.type).toBe(b.type !== "image" && b.type !== "checkout");
    }
  });
});
