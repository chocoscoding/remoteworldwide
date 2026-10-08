/**
 * A countdown that is still true when the email is opened.
 *
 * Email clients run no script, so the only live thing an email can carry is an image fetched at open
 * time. This draws one: an animated GIF that starts at the time left right now and ticks for a
 * minute (one frame a second), then rests on its last frame. Each open fetches a fresh one.
 *
 * Hand-rolled on purpose, with no image library: four flat colours, a blocky pixel font in the
 * site's light-brutalism look (ink outlines, hard shadows, lime on the one tile that matters), and a
 * plain GIF89a encoder. No fonts to install on the host, no native module, nothing that can render
 * as empty boxes on a serverless box with no system fonts.
 */

const WHITE = 0;
const INK = 1;
const LIME = 2;
const MUTED = 3;
// Everything outside the tiles is see-through, so the image sits on the email's own background:
// white in light mode, whatever a mail app paints in dark mode (no white box around the tiles).
const CLEAR = 4;

// GIF palettes come in powers of two; the last four slots are padding.
const PALETTE = [
  [0xff, 0xff, 0xff],
  [0x22, 0x23, 0x25],
  [0xe1, 0xf0, 0x73],
  [0x6b, 0x6c, 0x66],
  [0xff, 0xff, 0xff],
  [0xff, 0xff, 0xff],
  [0xff, 0xff, 0xff],
  [0xff, 0xff, 0xff],
];
const MIN_CODE_SIZE = 3;

// 5x7 glyphs, one string per row. Only what the countdown spells.
const GLYPHS: Record<string, string[]> = {
  "0": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
};

// Laid out at 1x and drawn at 2x, so it stays sharp on high-density screens. 496 is the email
// card's inner width (560 less 32 padding a side).
const SCALE = 2;
const W1 = 496;
const H1 = 92;
const TILE_W = 113;
const TILE_H = 84;
const GAP = 13;
const SHADOW = 4;
const BORDER = 2;
const RADIUS = 10;
const DIGIT_PX = 6; // one glyph pixel of a digit, at 1x
const LABEL_PX = 2;

export const WIDTH = W1 * SCALE;
export const HEIGHT = H1 * SCALE;

const UNITS = ["DAYS", "HOURS", "MINS", "SECS"] as const;

class Canvas {
  readonly px = new Uint8Array(WIDTH * HEIGHT).fill(CLEAR);

  /** A filled rounded rectangle, in 1x units. */
  roundRect(x: number, y: number, w: number, h: number, r: number, color: number): void {
    const [x0, y0, x1, y1, rr] = [x * SCALE, y * SCALE, (x + w) * SCALE, (y + h) * SCALE, r * SCALE];
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const cx = px < x0 + rr ? x0 + rr : px >= x1 - rr ? x1 - rr - 1 : px;
        const cy = py < y0 + rr ? y0 + rr : py >= y1 - rr ? y1 - rr - 1 : py;
        const dx = px - cx;
        const dy = py - cy;
        if (dx * dx + dy * dy <= rr * rr) this.px[py * WIDTH + px] = color;
      }
    }
  }

  /** Text in the pixel font; `size` is one glyph pixel at 1x. Returns nothing; centring is the caller's. */
  text(value: string, x: number, y: number, size: number, gap: number, color: number): void {
    let left = x;
    for (const ch of value) {
      const glyph = GLYPHS[ch];
      if (glyph) {
        glyph.forEach((row, gy) => {
          for (let gx = 0; gx < 5; gx++) {
            if (row[gx] !== "1") continue;
            const sx = (left + gx * size) * SCALE;
            const sy = (y + gy * size) * SCALE;
            for (let py = sy; py < sy + size * SCALE; py++) this.px.fill(color, py * WIDTH + sx, py * WIDTH + sx + size * SCALE);
          }
        });
      }
      left += 5 * size + gap;
    }
  }
}

const textWidth = (value: string, size: number, gap: number): number => value.length * 5 * size + (value.length - 1) * gap;

export type Remaining = { days: number; hours: number; mins: number; secs: number };

export const split = (seconds: number): Remaining => {
  const s = Math.max(0, Math.floor(seconds));
  return {
    days: Math.min(99, Math.floor(s / 86_400)),
    hours: Math.floor((s % 86_400) / 3_600),
    mins: Math.floor((s % 3_600) / 60),
    secs: s % 60,
  };
};

const pad = (n: number): string => String(n).padStart(2, "0");

/** One frame: four tiles, ink outline and hard shadow, the days tile in lime. */
export const drawFrame = (left: Remaining): Uint8Array => {
  const canvas = new Canvas();
  const values = [left.days, left.hours, left.mins, left.secs];
  values.forEach((value, i) => {
    const x = i * (TILE_W + GAP);
    canvas.roundRect(x + SHADOW, SHADOW, TILE_W, TILE_H, RADIUS, INK);
    canvas.roundRect(x, 0, TILE_W, TILE_H, RADIUS, INK);
    canvas.roundRect(x + BORDER, BORDER, TILE_W - 2 * BORDER, TILE_H - 2 * BORDER, RADIUS - BORDER, i === 0 ? LIME : WHITE);

    const digits = pad(value);
    const dw = textWidth(digits, DIGIT_PX, DIGIT_PX);
    canvas.text(digits, x + Math.round((TILE_W - dw) / 2), 12, DIGIT_PX, DIGIT_PX, INK);

    const label = UNITS[i];
    const lw = textWidth(label, LABEL_PX, LABEL_PX);
    canvas.text(label, x + Math.round((TILE_W - lw) / 2), 62, LABEL_PX, LABEL_PX, i === 0 ? INK : MUTED);
  });
  return canvas.px;
};

// --- GIF89a ---------------------------------------------------------------------------------------

/** LZW for GIF: variable-width codes, packed least-significant bit first. */
const lzw = (indices: Uint8Array): number[] => {
  const clear = 1 << MIN_CODE_SIZE;
  const eoi = clear + 1;
  let codeSize = MIN_CODE_SIZE + 1;
  let next = eoi + 1;
  let table = new Map<number, number>();
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  const emit = (code: number) => {
    acc |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      out.push(acc & 0xff);
      acc >>>= 8;
      bits -= 8;
    }
  };

  emit(clear);
  let prefix = indices[0] ?? 0;
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i] as number;
    const key = (prefix << 8) | k;
    const found = table.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next === 4096) {
      emit(clear);
      table = new Map();
      codeSize = MIN_CODE_SIZE + 1;
      next = eoi + 1;
    } else {
      // The decoder widens one entry late, so widen before adding the entry that would overflow.
      if (next >= 1 << codeSize) codeSize++;
      table.set(key, next++);
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) out.push(acc & 0xff);
  return out;
};

const u16 = (n: number): number[] => [n & 0xff, (n >> 8) & 0xff];

type Rect = { x: number; y: number; w: number; h: number };

/** The smallest box holding every pixel that changed, so a tick only re-encodes the tiles that moved. */
const changed = (prev: Uint8Array, cur: Uint8Array): Rect | null => {
  let [minX, minY, maxX, maxY] = [WIDTH, HEIGHT, -1, -1];
  for (let y = 0; y < HEIGHT; y++) {
    const row = y * WIDTH;
    for (let x = 0; x < WIDTH; x++) {
      if (prev[row + x] === cur[row + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
};

const crop = (px: Uint8Array, r: Rect): Uint8Array => {
  const out = new Uint8Array(r.w * r.h);
  for (let y = 0; y < r.h; y++) out.set(px.subarray((r.y + y) * WIDTH + r.x, (r.y + y) * WIDTH + r.x + r.w), y * r.w);
  return out;
};

const frameBytes = (px: Uint8Array, r: Rect, delayCs: number): number[] => {
  const data = lzw(px);
  const blocks: number[] = [];
  for (let i = 0; i < data.length; i += 255) {
    const chunk = data.slice(i, i + 255);
    blocks.push(chunk.length, ...chunk);
  }
  return [
    // Graphic control: leave the frame in place (disposal 1), CLEAR is transparent, then wait.
    0x21, 0xf9, 0x04, 0x05, ...u16(delayCs), CLEAR, 0x00,
    0x2c, ...u16(r.x), ...u16(r.y), ...u16(r.w), ...u16(r.h), 0x00,
    MIN_CODE_SIZE, ...blocks, 0x00,
  ];
};

/**
 * The time left until `endsAt`, as of `now`, ticking for `frames` seconds. It plays once and stops,
 * so a reader who leaves the email open sees a still number, not a loop that jumps back a minute.
 */
export const countdownGif = (endsAt: Date, now: Date = new Date(), frames = 60): Buffer => {
  const start = Math.max(0, Math.floor((endsAt.getTime() - now.getTime()) / 1000));
  const count = start === 0 ? 1 : Math.min(frames, start + 1);

  const bytes: number[] = [
    ...Array.from("GIF89a", (c) => c.charCodeAt(0)),
    ...u16(WIDTH), ...u16(HEIGHT),
    0xf0 | (MIN_CODE_SIZE - 1), 0x00, 0x00,
    ...PALETTE.flat(),
  ];

  let prev: Uint8Array | null = null;
  for (let i = 0; i < count; i++) {
    const cur = drawFrame(split(start - i));
    const full: Rect = { x: 0, y: 0, w: WIDTH, h: HEIGHT };
    const box = prev ? changed(prev, cur) : full;
    // Nothing moved (it can't, a second always changes the seconds tile): still spend the second.
    const r = box ?? { x: 0, y: 0, w: 1, h: 1 };
    for (const b of frameBytes(prev ? crop(cur, r) : cur, r, 100)) bytes.push(b);
    prev = cur;
  }
  bytes.push(0x3b);
  return Buffer.from(bytes);
};
