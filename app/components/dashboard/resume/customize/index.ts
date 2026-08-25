/**
 * The 14 Customize panels, as ONE ordered data list — this is what chunk A3b
 * maps over to build BOTH the Customize left-nav and the right-rail, in the
 * same order, so left-list-click -> right-rail-scroll/highlight is correct
 * by construction rather than bolted on afterward (see the historical spec's
 * note on the old screen's half-implemented version of that wiring).
 *
 * Contract for `Component`: it renders ONLY its controls — no outer card
 * shell, no repeated title. `label` on this same entry is meant to serve
 * double duty as both the left-nav item text AND the right-rail card's
 * header, so a panel component printing its own title would duplicate it.
 */

import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlignVerticalSpaceAround,
  CaseSensitive,
  Columns3,
  FileText,
  Heading,
  ImageIcon,
  LayoutTemplate,
  Link2,
  ListChecks,
  Palette,
  PanelBottom,
  PanelTop,
  Rows3,
  Type,
} from "lucide-react";

import UndoRedoBar from "./UndoRedoBar";
import SectionOrderList from "./SectionOrderList";
import DocumentPanel from "./DocumentPanel";
import TemplatesPanel from "./TemplatesPanel";
import LayoutPanel from "./LayoutPanel";
import FontSizePanel from "./FontSizePanel";
import SpacingPanel from "./SpacingPanel";
import EntriesPanel from "./EntriesPanel";
import HeadingsPanel from "./HeadingsPanel";
import FontPanel from "./FontPanel";
import ColorsPanel from "./ColorsPanel";
import HeaderPanel from "./HeaderPanel";
import PhotoPanel from "./PhotoPanel";
import LinksPanel from "./LinksPanel";
import FooterPanel from "./FooterPanel";
import SectionsPanel from "./SectionsPanel";

export interface CustomizePanelDef {
  id: string;
  label: string;
  /** Not requested by the brief's minimal shape, but the old screen's left-nav
   *  rendered one of these per row (`CUSTOMIZE_SETTINGS_ITEMS` in Client.tsx) —
   *  carried here so A3b can reproduce that nav without re-deriving the list. */
  icon: LucideIcon;
  Component: FC;
}

export const CUSTOMIZE_PANELS: CustomizePanelDef[] = [
  { id: "document", label: "Document", icon: FileText, Component: DocumentPanel },
  { id: "templates", label: "Templates", icon: LayoutTemplate, Component: TemplatesPanel },
  { id: "layout", label: "Layout", icon: Columns3, Component: LayoutPanel },
  { id: "font-size", label: "Font size", icon: CaseSensitive, Component: FontSizePanel },
  { id: "spacing", label: "Spacing", icon: AlignVerticalSpaceAround, Component: SpacingPanel },
  { id: "entries", label: "Entries", icon: ListChecks, Component: EntriesPanel },
  { id: "headings", label: "Headings", icon: Heading, Component: HeadingsPanel },
  { id: "font", label: "Font", icon: Type, Component: FontPanel },
  { id: "colors", label: "Colors", icon: Palette, Component: ColorsPanel },
  { id: "header", label: "Header", icon: PanelTop, Component: HeaderPanel },
  { id: "photo", label: "Photo", icon: ImageIcon, Component: PhotoPanel },
  { id: "links", label: "Links", icon: Link2, Component: LinksPanel },
  { id: "footer", label: "Footer", icon: PanelBottom, Component: FooterPanel },
  { id: "sections", label: "Sections", icon: Rows3, Component: SectionsPanel },
];

export {
  UndoRedoBar,
  SectionOrderList,
  DocumentPanel,
  TemplatesPanel,
  LayoutPanel,
  FontSizePanel,
  SpacingPanel,
  EntriesPanel,
  HeadingsPanel,
  FontPanel,
  ColorsPanel,
  HeaderPanel,
  PhotoPanel,
  LinksPanel,
  FooterPanel,
  SectionsPanel,
};
