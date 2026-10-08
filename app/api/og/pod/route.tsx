import LogoFull2 from "@/app/components/svg/LogoFull2";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The share card for a pod invite (owner, 2026-10-08): what a `/pod/<code>` link shows wherever it
// is pasted. The job card's lime and hairline frame, "You're invited to a job-search pod" on the
// left, and on the right a pod: ten seats round a table, nine taken and one left open for you.
//
// The same card for every invite, on purpose. It names no one and counts nothing: the code is a
// key to a pod of real people, and a public image is no place to say who is in it or how full it
// is. Nothing is read from the request, so a crafted link can't put words on this domain's image.

const WIDTH = 1200;
const HEIGHT = 630;
const LIME = "#e1f073";
const INK = "#111111";
const HAIRLINE = "rgba(17, 17, 17, 0.14)";

// The renderer can't read the site's variable fonts, so the static Manrope cuts in assets/fonts (as the job card).
const fonts = Promise.all(
  [
    ["Manrope-Medium.ttf", 500],
    ["Manrope-Bold.ttf", 700],
    ["Manrope-ExtraBold.ttf", 800],
  ].map(async ([file, weight]) => ({
    name: "Manrope",
    data: await readFile(join(process.cwd(), "assets/fonts", file as string)),
    weight: weight as 500 | 700 | 800,
    style: "normal" as const,
  })),
);

// The pod: ten seats on a ring round the table, the open one last, at the lower left.
const SEATS = 10;
const CENTER_X = 922;
const CENTER_Y = 315;
const RING = 152;
const SEAT = 78;
const TABLE = 150;

/** Seat `i`'s top-left corner, starting at the top and going clockwise. */
function seatAt(i: number): { left: number; top: number } {
  const angle = -Math.PI / 2 + (i * 2 * Math.PI) / SEATS;
  return { left: Math.round(CENTER_X + RING * Math.cos(angle) - SEAT / 2), top: Math.round(CENTER_Y + RING * Math.sin(angle) - SEAT / 2) };
}

/** A taken seat: a white disc with someone in it, a head over shoulders, nobody in particular. */
function TakenSeat({ left, top, dark }: { left: number; top: number; dark: boolean }) {
  const fill = dark ? INK : "#ffffff";
  const figure = dark ? LIME : INK;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top,
        width: SEAT,
        height: SEAT,
        borderRadius: SEAT,
        background: fill,
        border: `2px solid ${INK}`,
        boxShadow: `4px 4px 0 ${INK}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "hidden",
      }}>
      <div style={{ display: "flex", marginTop: 15, width: 24, height: 24, borderRadius: 24, background: figure }} />
      <div style={{ display: "flex", marginTop: 5, width: 44, height: 30, borderRadius: "22px 22px 0 0", background: figure }} />
    </div>
  );
}

export async function GET() {
  const fontData = await fonts;
  // Hairline frame with dots where the lines cross, as on the job card.
  const columns = [56, 700, 1144];
  const rows = [104, 526];
  const open = seatAt(SEATS - 3);

  return new ImageResponse(
    (
      <div style={{ display: "flex", position: "relative", width: "100%", height: "100%", background: LIME, fontFamily: "Manrope", color: INK }}>
        {columns.map((x) => (
          <div key={`c${x}`} style={{ position: "absolute", left: x, top: 0, width: 1, height: HEIGHT, background: HAIRLINE }} />
        ))}
        {rows.map((y) => (
          <div key={`r${y}`} style={{ position: "absolute", top: y, left: 0, width: WIDTH, height: 1, background: HAIRLINE }} />
        ))}
        {columns.flatMap((x) =>
          rows.map((y) => <div key={`d${x}-${y}`} style={{ position: "absolute", left: x - 4, top: y - 4, width: 9, height: 9, borderRadius: 9, background: INK }} />),
        )}

        <div style={{ position: "absolute", left: 84, top: 36, display: "flex", alignItems: "center", height: 40 }}>
          <LogoFull2 style={{ width: 320, height: 32.6 }} />
        </div>

        <div style={{ position: "absolute", left: 84, top: 104, height: 422, width: 580, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", padding: "6px 18px", borderRadius: 999, border: `2px solid ${INK}`, background: "#ffffff", fontSize: 22, fontWeight: 700 }}>
              Pod invite
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 22, fontSize: 60, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.02em" }}>
            You&apos;re invited to a job-search pod
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 26, fontWeight: 500, lineHeight: 1.35 }}>
            Up to ten people, weekly goals and a shared streak. Nobody job-hunts alone.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 84,
            top: 548,
            display: "flex",
            alignItems: "center",
            padding: "12px 30px",
            borderRadius: 999,
            background: INK,
            color: "#ffffff",
            fontSize: 26,
            fontWeight: 700,
          }}>
          Join the pod →
        </div>
        <div style={{ position: "absolute", right: 84, top: 560, display: "flex", fontSize: 24, fontWeight: 700 }}>remoteworldwide.net</div>

        {/* The table, with the pod's size on it. */}
        <div
          style={{
            position: "absolute",
            left: CENTER_X - TABLE / 2,
            top: CENTER_Y - TABLE / 2,
            width: TABLE,
            height: TABLE,
            borderRadius: TABLE,
            background: "#ffffff",
            border: `2px solid ${INK}`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}>
          <div style={{ display: "flex", fontSize: 58, fontWeight: 800, lineHeight: 1 }}>10</div>
          <div style={{ display: "flex", marginTop: 4, fontSize: 17, fontWeight: 700, letterSpacing: "0.12em" }}>SEATS</div>
        </div>

        {Array.from({ length: SEATS }, (_, i) => i)
          .filter((i) => i !== SEATS - 3)
          .map((i) => {
            const at = seatAt(i);
            return <TakenSeat key={i} left={at.left} top={at.top} dark={i % 3 === 1} />;
          })}

        {/* The open seat: dashed, empty, waiting. */}
        <div
          style={{
            position: "absolute",
            left: open.left,
            top: open.top,
            width: SEAT,
            height: SEAT,
            borderRadius: SEAT,
            border: `3px dashed ${INK}`,
            background: "rgba(255, 255, 255, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 21,
            fontWeight: 800,
          }}>
          + you
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT, fonts: fontData },
  );
}
