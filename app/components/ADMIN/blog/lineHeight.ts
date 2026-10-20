import type { Quill } from "react-quill-new";

// Line spacing per paragraph, as in a word processor: the toolbar's spacing picker puts
// ql-line-height-<value> on the line (none = 1.15, the default). The editor and the post
// page size each one the same way in globals.css, and render.ts lets the class through.
export const LINE_HEIGHTS = ["1", "1-5", "2"] as const;

/** The toolbar group: Single, 1.15 (the default, so no class), 1.5, Double. */
export const LINE_HEIGHT_TOOL = { lineheight: ["1", false, "1-5", "2"] };

let registered = false;

export function registerLineHeight(QuillClass: typeof Quill) {
  if (registered) return;
  registered = true;
  // parchment is Quill's own dependency, not the site's, so it is typed here by hand.
  const { ClassAttributor, Scope } = QuillClass.import("parchment") as {
    ClassAttributor: new (name: string, keyName: string, options: { scope: number; whitelist: string[] }) => object;
    Scope: { BLOCK: number };
  };
  const register = QuillClass.register.bind(QuillClass) as (defs: Record<string, object>, overwrite: boolean) => void;
  register({ "formats/lineheight": new ClassAttributor("lineheight", "ql-line-height", { scope: Scope.BLOCK, whitelist: [...LINE_HEIGHTS] }) }, true);
}
