// Draws the shareable week card onto a canvas, the way the win card is drawn
// (win-card-render.ts): no html-to-image library, no server, and the preview IS
// the PNG that downloads. The card in the middle is the "This week" tracker
// card from the waitlist collage — lime tiles on white, ink outline, hard
// shadow — on the collage's pale-lime dotted ground, with the win card's ink
// footer carrying the user's invite link.

import { CARD_DIMENSIONS, type WinCardFormat } from "@/app/lib/dashboard/win";
import { weekEyebrow, weekRangeLabel, weekStreakLine, weekTiles } from "@/app/lib/dashboard/week-card";
import type { StreakWeekReport } from "@/app/lib/streak/types";

const LIME = "#e1f073";
/** `bg-secondary/40` over white — the collage's ground. */
const LIME_PALE = "#f3f9c7";
const INK = "#222325";
const INK_70 = "rgba(34,35,37,0.7)";
const INK_60 = "rgba(34,35,37,0.6)";
const WHITE = "#ffffff";

export interface RenderWeekCardOptions {
  report: StreakWeekReport;
  format: WinCardFormat;
  /** The page's real font stack — read from computed style, since next/font hashes the family name. */
  fontFamily: string;
  /** The user's own invite link, display form ("remoteworldwide.net/j/ada") — printed in the footer. */
  referralLink: string;
}

/** Per-format layout. `cardW` is the card's share of the content width; `u` (its unit) follows from it. */
const LAYOUT: Record<WinCardFormat, { pad: number; eyebrow: number; headline: number; footer: number; twoCol: boolean; cardW: number }> = {
  landscape: { pad: 52, eyebrow: 18, headline: 54, footer: 66, twoCol: true, cardW: 0.56 },
  square: { pad: 80, eyebrow: 24, headline: 64, footer: 78, twoCol: false, cardW: 1 },
  story: { pad: 88, eyebrow: 32, headline: 104, footer: 104, twoCol: false, cardW: 1 },
};

/** Card width in units: three tiles that fit "Interviews", their gaps and the padding. */
const CARD_UNITS = 16;
/** Card height in units for the layout `drawCard` uses. */
const CARD_HEIGHT_UNITS = 9.5;

/** Above the headline on every format; the card itself carries the dates. */
const EYEBROW = "WEEKLY STREAK REPORT";

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Letterspaced caps — canvas has no letter-spacing, so it's drawn per glyph. Returns the width drawn. */
function drawTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number): number {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
  return cx - x - tracking;
}

/** Shrinks the font until `text` fits `maxWidth`. Returns the size used (and leaves `ctx.font` set to it). */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxWidth: number): number {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 10 && ctx.measureText(text).width > maxWidth) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/** Word-wraps `text` into at most `maxLines` lines of `maxWidth`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const probe = line ? `${line} ${word}` : word;
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) return lines;
    } else {
      line = probe;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

/** The dotted ground — the collage's 20px dot grid, scaled to the canvas. */
function drawGround(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = LIME_PALE;
  ctx.fillRect(0, 0, width, height);
  const step = Math.round(width / 27);
  const r = Math.max(1.5, width / 520);
  ctx.fillStyle = "rgba(34,35,37,0.10)";
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2; x < width; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** The tracker card itself, `w` wide at (x, y). Its height is CARD_HEIGHT_UNITS units. */
function drawCard(ctx: CanvasRenderingContext2D, report: StreakWeekReport, x: number, y: number, w: number, family: string) {
  const u = w / CARD_UNITS;
  const h = u * CARD_HEIGHT_UNITS;
  const radius = u * 1.1;
  const border = Math.max(3, u * 0.08);
  const shadow = u * 0.32;

  // Hard offset shadow, then the white face with its ink outline.
  roundRectPath(ctx, x + shadow, y + shadow, w, h, radius);
  ctx.fillStyle = INK;
  ctx.fill();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.lineWidth = border;
  ctx.strokeStyle = INK;
  ctx.stroke();

  const p = u * 1.4;
  const innerW = w - p * 2;

  // Eyebrow: "LAST WEEK · 21–27 SEP".
  const eyebrowSize = u * 0.6;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = INK_60;
  ctx.font = `800 ${eyebrowSize}px ${family}`;
  const eyebrowY = y + p + eyebrowSize;
  drawTracked(ctx, `${weekEyebrow(report)} · ${weekRangeLabel(report)}`.toUpperCase(), x + p, eyebrowY, eyebrowSize * 0.14);

  // Tiles.
  const gap = u * 0.5;
  const tileW = (innerW - gap * 2) / 3;
  const tileH = u * 3.7;
  const tileTop = eyebrowY + u * 0.95;
  weekTiles(report).forEach((tile, i) => {
    const tx = x + p + i * (tileW + gap);
    roundRectPath(ctx, tx, tileTop, tileW, tileH, u * 0.55);
    ctx.fillStyle = LIME;
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = INK;
    const nSize = fitText(ctx, String(tile.n), 800, u * 2.2, family, tileW - u * 0.6);
    ctx.font = `800 ${nSize}px ${family}`;
    ctx.fillText(String(tile.n), tx + tileW / 2, tileTop + u * 2.1);

    ctx.fillStyle = INK_70;
    const lSize = fitText(ctx, tile.label, 700, u * 0.66, family, tileW - u * 0.5);
    ctx.font = `700 ${lSize}px ${family}`;
    ctx.fillText(tile.label, tx + tileW / 2, tileTop + u * 3.0);
  });

  // The streak line.
  const line = weekStreakLine(report);
  const lineSize = u * 0.82;
  const lineY = tileTop + tileH + u * 1.45;
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = `800 ${lineSize}px ${family}`;
  let lx = x + p;
  if (line.flame) {
    ctx.fillText("\u{1F525}", lx, lineY);
    lx += ctx.measureText("\u{1F525}").width + u * 0.3;
  }
  ctx.fillText(line.text, lx, lineY);
}

export function renderWeekCard(canvas: HTMLCanvasElement, opts: RenderWeekCardOptions): void {
  const { report, format, fontFamily, referralLink } = opts;
  const { width, height } = CARD_DIMENSIONS[format];
  const L = LAYOUT[format];

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  drawGround(ctx, width, height);

  const footerTop = height - L.footer;
  const contentW = width - L.pad * 2;
  const headline = report.partial ? "My job search this week" : "My job search last week";

  /** Eyebrow then headline lines from `top`, at `x`. */
  const drawHeading = (lines: string[], x: number, top: number) => {
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = INK_60;
    ctx.font = `800 ${L.eyebrow}px ${fontFamily}`;
    drawTracked(ctx, EYEBROW, x, top + L.eyebrow, L.eyebrow * 0.16);
    ctx.fillStyle = INK;
    ctx.font = `800 ${L.headline}px ${fontFamily}`;
    let baseline = top + L.eyebrow * 1.9 + L.headline;
    lines.forEach((text, i) => {
      if (i > 0) baseline += L.headline * 1.08;
      ctx.fillText(text, x, baseline);
    });
  };
  /** How tall `drawHeading` draws: eyebrow, its gap, and the lines down to the last baseline plus its descent. */
  const headingHeight = (lines: number) => L.eyebrow * 1.9 + L.headline * (1.25 + 1.08 * (lines - 1));

  const cardW = contentW * L.cardW;
  const cardH = (cardW / CARD_UNITS) * CARD_HEIGHT_UNITS;

  if (L.twoCol) {
    // Words on the left, the card on the right, each centred in the space above the footer.
    const textW = contentW - cardW - L.pad * 0.8;
    drawCard(ctx, report, width - L.pad - cardW, (footerTop - cardH) / 2, cardW, fontFamily);
    ctx.font = `800 ${L.headline}px ${fontFamily}`;
    const lines = wrap(ctx, headline, textW, 3);
    drawHeading(lines, L.pad, (footerTop - headingHeight(lines.length)) / 2);
  } else {
    // Stacked: the heading, then the card, the whole block centred above the footer.
    ctx.font = `800 ${L.headline}px ${fontFamily}`;
    const lines = wrap(ctx, headline, contentW, 2);
    const gapToCard = L.headline * 0.6;
    const blockH = headingHeight(lines.length) + gapToCard + cardH;
    const top = Math.max(L.pad * 0.6, (footerTop - blockH) / 2);
    drawHeading(lines, L.pad, top);
    drawCard(ctx, report, L.pad, top + headingHeight(lines.length) + gapToCard, cardW, fontFamily);
  }

  // Footer bar — the invite link is how a share brings someone back.
  ctx.fillStyle = INK;
  ctx.fillRect(0, footerTop, width, L.footer);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = LIME;
  ctx.font = `700 ${L.footer * 0.32}px ${fontFamily}`;
  ctx.fillText(referralLink, L.pad, footerTop + L.footer / 2);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  const brandSize = L.footer * 0.26;
  ctx.font = `800 ${brandSize}px ${fontFamily}`;
  const brand = "REMOTE WORLDWIDE";
  const tracking = brandSize * 0.14;
  const bw = [...brand].reduce((sum, ch) => sum + ctx.measureText(ch).width + tracking, -tracking);
  drawTracked(ctx, brand, width - L.pad - bw, footerTop + L.footer / 2 + brandSize * 0.06, tracking);
}

/**
 * Paint helper for React call sites, as `paintWinCard`: draws at once (a
 * fallback-font frame beats a blank card), then again once the real font is in.
 * `live` guards the late repaint against a canvas unmounted or replaced since.
 */
export function paintWeekCard(el: HTMLCanvasElement, live: () => HTMLCanvasElement | null, opts: Omit<RenderWeekCardOptions, "fontFamily">): void {
  const fontFamily = getComputedStyle(document.body).fontFamily || "sans-serif";
  renderWeekCard(el, { ...opts, fontFamily });
  document.fonts.ready.then(() => {
    if (live() === el) renderWeekCard(el, { ...opts, fontFamily });
  });
}
