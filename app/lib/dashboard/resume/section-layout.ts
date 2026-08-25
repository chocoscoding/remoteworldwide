// Turns the flat ordered section array into renderable bands.
//
// FILENAME NOTE: the spec calls this `layout.ts`, but anything named
// `layout.ts` under `app/` is claimed by the App Router as a route layout —
// Next generates a type validator for it and demands a default-exported React
// component. Hence `section-layout.ts`. Do not rename it back.
//
// Sections are ONE flat ordered array with `column` as a field, not two arrays.
// That choice buys three things: dnd-kit's single-container pattern is ~10
// lines where multi-container is ~70; switching one -> two -> one columns is
// lossless because nothing is ever merged away; and "mix" is expressible as
// runs over a flat array but has no representation at all over two arrays.

import type { ColumnsMode, SectionConfig } from "./design-types";

export type Band =
  | { kind: "full"; items: SectionConfig[] }
  | { kind: "split"; main: SectionConfig[]; side: SectionConfig[] };

export function buildLayout(sections: SectionConfig[], columns: ColumnsMode): Band[] {
  const vis = sections.filter((s) => s.visible);
  if (columns === "one") return [{ kind: "full", items: vis }];
  if (columns === "two")
    return [
      {
        kind: "split",
        main: vis.filter((s) => s.column === "main"),
        side: vis.filter((s) => s.column === "side"),
      },
    ];
  // "mix": a full-width head, then a two-column band from the first side
  // section onward.
  const split = vis.findIndex((s) => s.column === "side");
  if (split === -1) return [{ kind: "full", items: vis }];
  const head = vis.slice(0, split);
  const tail = vis.slice(split);
  return [
    ...(head.length ? [{ kind: "full" as const, items: head }] : []),
    {
      kind: "split",
      main: tail.filter((s) => s.column === "main"),
      side: tail.filter((s) => s.column === "side"),
    },
  ];
}
