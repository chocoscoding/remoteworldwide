// How a cover letter LOOKS, apart from what it says: the editor's theme, font,
// spacing and letterhead controls, and the few pure functions that turn a saved
// letter into the markup or text a page, a print or a Word file is made from.
//
// Moved out of the cover screen so the server can lay a letter out the same
// way: `/print/letter/[id]` (the PDF) and `/api/extension/document` (the Word
// file) read these, and the editor reads them too. Two copies of "serif means
// font-serif" is how the PDF of a letter stops matching the letter on screen.
//
// Pure: no React, no DOM. The class strings are static literals so Tailwind's
// scanner sees them (app/**/*.ts is in its content globs).

import type { Letterhead, LetterFont } from "@/app/lib/export/cover";
import type { CoverLetterContent, LetterDesign, LetterFontId, LetterheadMode, LetterSpacingId, LetterThemeId } from "@/app/lib/dashboard/types";

export const THEME_OPTIONS: { id: LetterThemeId; label: string }[] = [
  { id: "ats", label: "Clean ATS" },
  { id: "bordered", label: "Bordered" },
  { id: "warm", label: "Warm" },
];

export const LETTER_FONT_OPTIONS: { id: LetterFontId; label: string }[] = [
  { id: "manrope", label: "Manrope" },
  { id: "serif", label: "Serif" },
  { id: "mono", label: "Mono" },
];

export const SPACING_OPTIONS: { id: LetterSpacingId; label: string }[] = [
  { id: "tight", label: "Tight" },
  { id: "normal", label: "Normal" },
  { id: "airy", label: "Airy" },
];

export const LETTERHEAD_OPTIONS: { id: LetterheadMode; label: string }[] = [
  { id: "off", label: "Off" },
  { id: "name", label: "Name only" },
  { id: "full", label: "Full contact" },
];

/** What a letter looks like before anyone has touched a control — and what a saved letter with no design opens in. */
export const DEFAULT_LETTER_DESIGN: LetterDesign = { theme: "ats", font: "manrope", spacing: "normal", letterhead: "off" };

/** Manrope is the site's own face, already on <body> — so it is no class at all. */
export const FONT_CLASS: Record<LetterFontId, string> = {
  manrope: "",
  serif: "font-serif",
  mono: "font-mono",
};

export const SPACING_CLASS: Record<LetterSpacingId, { gap: string; text: string }> = {
  tight: { gap: "gap-3", text: "text-[13px] leading-snug" },
  normal: { gap: "gap-5", text: "text-sm leading-relaxed" },
  airy: { gap: "gap-7", text: "text-[15px] leading-loose" },
};

export const THEME_CANVAS_CLASS: Record<LetterThemeId, string> = {
  ats: "bg-white border border-black/10",
  bordered: "bg-white border-2 border-primary/15",
  warm: "bg-[#fbfbf7] border border-black/10",
};

/** The Word file has no web fonts: each control maps to a face Word ships with (see `coverToDocx`). */
export const wordFontFor = (font: LetterFontId): LetterFont => (font === "serif" ? "serif" : font === "mono" ? "mono" : "sans");

const escapeHtml = (value: string): string => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Paragraphs -> the HTML the editor loads. Escaped: this is the model's text, not markup. */
export function lettersToHtml(greeting: string, paragraphs: string[], signOff: string): string {
  const body = paragraphs
    .filter((p) => p.trim())
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  // The sign-off is one field carrying two lines ("Best,\nJordan"), which is
  // how the service asks for it and how a letter is actually laid out.
  const closing = signOff
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p><strong>${escapeHtml(line)}</strong></p>`)
    .join("");
  return `<p>${escapeHtml(greeting)}</p>${body}${closing}`;
}

/** A written letter as plain text, the way the editor reads before anyone has typed in it. */
export const letterTextOf = (letter: Pick<CoverLetterContent, "greeting" | "paragraphs" | "signOff">): string =>
  [letter.greeting, "", ...letter.paragraphs.flatMap((para) => [para, ""]), letter.signOff].join("\n");

/** The profile fields a letterhead prints. */
export interface LetterheadProfile {
  fullName?: string | null;
  email?: string | null;
  portfolio?: string | null;
  location?: string | null;
}

/**
 * The letterhead a mode prints for this profile, or null for none — "off", or
 * no name to put at the top. The contacts are the editor's, in its order.
 */
export function letterheadFor(mode: LetterheadMode, profile: LetterheadProfile | null | undefined): Letterhead | null {
  const name = profile?.fullName?.trim();
  if (mode === "off" || !profile || !name) return null;
  return {
    name: profile.fullName ?? name,
    contact: mode === "full" ? [profile.email, profile.portfolio, profile.location].filter((c): c is string => !!c) : [],
  };
}
