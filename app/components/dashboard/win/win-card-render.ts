// Draws the shareable win card onto a canvas — the same hand-built approach
// as the vault's placeholder PDF: no html-to-image library, no server. What
// the preview shows IS the PNG that downloads, because they're the same
// canvas. Three formats from one draw function; the toggles just change the
// strings before layout.
//
// In production this exact design moves to a server template (Satori/@vercel/og)
// so links can unfurl it — the layout here is the spec for that template.

import {
  CARD_DIMENSIONS,
  firstNameOf,
  WIN_REFERRAL_LINK,
  type WinCardFormat,
  type WinCardToggles,
  type WinRecord,
} from "@/app/lib/dashboard/win";

const LIME = "#e1f073";
const INK = "#222325";
const INK_60 = "rgba(34,35,37,0.6)";
const INK_45 = "rgba(34,35,37,0.45)";
const WHITE = "#ffffff";

export interface RenderWinCardOptions {
  win: WinRecord;
  toggles: WinCardToggles;
  format: WinCardFormat;
  /** The page's real font stack — read from computed style, since next/font hashes the family name. */
  fontFamily: string;
  /** "Amara Okafor" from the profile. */
  ownerName: string;
}

/** Per-format layout constants. One design, three densities. */
const LAYOUT: Record<
  WinCardFormat,
  { pad: number; eyebrow: number; headline: number; sub: number; chip: number; journey: number; footer: number; twoCol: boolean }
> = {
  landscape: { pad: 56, eyebrow: 20, headline: 64, sub: 27, chip: 22, journey: 22, footer: 66, twoCol: true },
  square: { pad: 64, eyebrow: 24, headline: 76, sub: 32, chip: 26, journey: 26, footer: 78, twoCol: false },
  story: { pad: 88, eyebrow: 32, headline: 108, sub: 46, chip: 38, journey: 42, footer: 104, twoCol: false },
};

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

/** Shrinks the font size until `text` fits `maxWidth`. Returns the size used. */
function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, family: string, maxWidth: number): number {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (s > 12 && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

/** One white stat chip; returns the width consumed so the row can flow. */
function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, size: number, family: string): number {
  ctx.font = `700 ${size}px ${family}`;
  const padX = size * 0.9;
  const h = size * 2.1;
  const w = ctx.measureText(text).width + padX * 2;
  roundRectPath(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + size * 0.06);
  return w;
}

/**
 * The journey panel — the tracker's path, dated. This is the card's whole
 * point: not "I got the job" but the visible road to it.
 */
function drawJourney(
  ctx: CanvasRenderingContext2D,
  win: WinRecord,
  x: number,
  y: number,
  w: number,
  size: number,
  family: string
): number {
  const rowH = size * 2.45;
  const padX = size * 1.2;
  const padY = size * 1.3;
  const titleSize = size * 0.72;
  const h = padY * 2 + titleSize + size * 0.9 + win.journey.length * rowH;

  roundRectPath(ctx, x, y, w, h, size * 0.8);
  ctx.fillStyle = WHITE;
  ctx.fill();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK_45;
  ctx.font = `800 ${titleSize}px ${family}`;
  drawTracked(ctx, "THE ROAD HERE", x + padX, y + padY + titleSize, titleSize * 0.14);

  const listTop = y + padY + titleSize + size * 0.9;
  const dotX = x + padX + size * 0.3;
  const dateX = dotX + size * 1.1;
  const dateW = size * 3.4;
  const labelX = dateX + dateW;
  const labelMax = x + w - padX - labelX;

  // Connecting spine behind the dots.
  ctx.strokeStyle = "rgba(34,35,37,0.15)";
  ctx.lineWidth = Math.max(2, size * 0.09);
  ctx.beginPath();
  ctx.moveTo(dotX, listTop + rowH * 0.5);
  ctx.lineTo(dotX, listTop + rowH * (win.journey.length - 0.5));
  ctx.stroke();

  win.journey.forEach((step, i) => {
    const cy = listTop + rowH * (i + 0.5);
    const last = i === win.journey.length - 1;

    ctx.beginPath();
    ctx.arc(dotX, cy, last ? size * 0.42 : size * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = last ? LIME : INK;
    ctx.fill();
    if (last) {
      ctx.lineWidth = Math.max(2.5, size * 0.13);
      ctx.strokeStyle = INK;
      ctx.stroke();
    }

    ctx.textBaseline = "middle";
    ctx.fillStyle = INK_45;
    ctx.font = `700 ${size * 0.82}px ${family}`;
    ctx.fillText(step.dateLabel, dateX, cy);

    ctx.fillStyle = INK;
    ctx.font = `${last ? 800 : 600} ${size * 0.92}px ${family}`;
    let label = step.label;
    while (ctx.measureText(label).width > labelMax && label.length > 6) label = `${label.slice(0, -2).trimEnd()}…`;
    ctx.fillText(label, labelX, cy);
  });

  return h;
}

/** Letterspaced caps — canvas has no letter-spacing, so it's drawn per glyph. */
function drawTracked(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number) {
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}

/**
 * Word-wraps the story into at most four lines, quoted, and stops before
 * `maxY` — a share card is not the place for scrollback.
 */
function drawQuote(
  ctx: CanvasRenderingContext2D,
  story: string,
  x: number,
  y: number,
  w: number,
  maxY: number,
  size: number,
  family: string
) {
  ctx.font = `600 ${size}px ${family}`;
  ctx.fillStyle = INK_60;
  ctx.textBaseline = "alphabetic";

  const words = `“${story}”`.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const probe = line === "" ? word : `${line} ${word}`;
    if (ctx.measureText(probe).width > w && line !== "") {
      lines.push(line);
      line = word;
      if (lines.length === 4) break;
    } else {
      line = probe;
    }
  }
  if (lines.length < 4 && line !== "") lines.push(line);
  if (lines.length === 4 && line !== "" && !lines[3].endsWith("”")) {
    lines[3] = `${lines[3].slice(0, -1).trimEnd()}…”`;
  }

  const lineH = size * 1.5;
  lines.forEach((l, i) => {
    const ly = y + size + i * lineH;
    if (ly < maxY) ctx.fillText(l, x, ly);
  });
}

export function renderWinCard(canvas: HTMLCanvasElement, opts: RenderWinCardOptions): void {
  const { win, toggles, format, fontFamily, ownerName } = opts;
  const { width, height } = CARD_DIMENSIONS[format];
  const L = LAYOUT[format];

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Ground + hard ink frame.
  ctx.fillStyle = LIME;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(6, width * 0.007);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);

  const name = toggles.firstNameOnly ? firstNameOf(ownerName) : ownerName;
  const roleLine = toggles.hideCompany ? win.facts.role : `${win.facts.role} at ${win.facts.company}`;

  const chips = [
    `${win.stats.applications} applications`,
    `${win.stats.interviewLoops} interview loops`,
    `${win.stats.streak}-day streak`,
  ];
  if (!toggles.hideSalary && win.stats.salaryDelta) chips.push(`${win.stats.salaryDelta} negotiated`);

  const contentW = width - L.pad * 2;
  const colW = L.twoCol ? contentW * 0.48 : contentW;
  let y = L.pad + L.eyebrow;

  // Eyebrow.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = INK_60;
  ctx.font = `800 ${L.eyebrow}px ${fontFamily}`;
  drawTracked(ctx, `OFFER ACCEPTED · ${win.facts.offerDateLabel.toUpperCase()}`, L.pad, y, L.eyebrow * 0.16);

  // Headline.
  y += L.headline * 1.25;
  ctx.fillStyle = INK;
  const hlSize = fitText(ctx, "I got the job \u{1F389}", 800, L.headline, fontFamily, colW);
  ctx.font = `800 ${hlSize}px ${fontFamily}`;
  ctx.fillText("I got the job \u{1F389}", L.pad, y);

  // Name + role.
  y += L.sub * 1.9;
  ctx.fillStyle = INK;
  const nameSize = fitText(ctx, name, 800, L.sub, fontFamily, colW);
  ctx.font = `800 ${nameSize}px ${fontFamily}`;
  ctx.fillText(name, L.pad, y);

  y += L.sub * 1.45;
  ctx.fillStyle = INK_60;
  const roleSize = fitText(ctx, roleLine, 600, L.sub * 0.92, fontFamily, colW);
  ctx.font = `600 ${roleSize}px ${fontFamily}`;
  ctx.fillText(roleLine, L.pad, y);

  // Stat chips, flowing onto new rows when the column runs out.
  y += L.chip * 1.6;
  let cx = L.pad;
  for (const chip of chips) {
    ctx.font = `700 ${L.chip}px ${fontFamily}`;
    const w = ctx.measureText(chip).width + L.chip * 1.8;
    if (cx + w > L.pad + colW && cx > L.pad) {
      cx = L.pad;
      y += L.chip * 2.1 + L.chip * 0.55;
    }
    cx += drawChip(ctx, cx, y, chip, L.chip, fontFamily) + L.chip * 0.55;
  }

  // Journey — beside the text in landscape, beneath it otherwise.
  const footerTop = height - L.footer;
  if (L.twoCol) {
    const jx = L.pad + colW + L.pad * 0.75;
    drawJourney(ctx, win, jx, L.pad, width - jx - L.pad, L.journey, fontFamily);
  } else {
    const jy = y + L.chip * 3.4;
    const jh = drawJourney(ctx, win, L.pad, jy, contentW, L.journey, fontFamily);

    // The stacked formats (story especially) end with slack above the footer.
    // Their one honest line fills it — that's the thing people actually post
    // a story about. Skipped when it's empty or the slack is too tight.
    const slackTop = jy + jh + L.chip * 1.6;
    if (win.story && footerTop - slackTop > L.sub * 3) {
      drawQuote(ctx, win.story, L.pad, slackTop, contentW, footerTop - L.chip, L.sub * 0.72, fontFamily);
    }
  }

  // Footer bar — referral link is the whole reason the card exists for RWW.
  ctx.fillStyle = INK;
  ctx.fillRect(0, footerTop, width, L.footer);
  ctx.textBaseline = "middle";
  ctx.fillStyle = LIME;
  ctx.font = `700 ${L.footer * 0.32}px ${fontFamily}`;
  ctx.fillText(WIN_REFERRAL_LINK, L.pad, footerTop + L.footer / 2);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `800 ${L.footer * 0.26}px ${fontFamily}`;
  const brand = "REMOTE WORLDWIDE";
  const bw = ctx.measureText(brand).width + L.footer * 0.26 * 0.14 * brand.length;
  drawTracked(ctx, brand, width - L.pad - bw, footerTop + L.footer / 2 + L.footer * 0.09, L.footer * 0.26 * 0.14);
}

/**
 * Paint helper for React call sites. Draws immediately (a fallback-font frame
 * beats a blank card), then repaints once the real font is in. `live` guards
 * the late repaint against a canvas that was unmounted or replaced meanwhile.
 *
 * Exists because the celebration dialog's canvas lives in a Radix portal,
 * which mounts its subtree AFTER the parent's effects run — a mount effect
 * sees a null ref and the card stays blank. Call sites paint from a callback
 * ref (fires exactly when the element exists) and re-paint from an effect on
 * prop changes.
 */
export function paintWinCard(
  el: HTMLCanvasElement,
  live: () => HTMLCanvasElement | null,
  opts: Omit<RenderWinCardOptions, "fontFamily">
): void {
  const fontFamily = getComputedStyle(document.body).fontFamily || "sans-serif";
  renderWinCard(el, { ...opts, fontFamily });
  document.fonts.ready.then(() => {
    if (live() === el) renderWinCard(el, { ...opts, fontFamily });
  });
}
