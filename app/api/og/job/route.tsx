import LogoFull2 from "@/app/components/svg/LogoFull2";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The share card for a job: region pills, "Title at Company", and the company's logo (or its
// initial) on the right. Called by the job page's metadata and by rwwbot's LinkedIn posts with
// ?title&company&type (regions, comma-separated) and an optional &logo.
//
// Without title/company/type it draws the plain site card instead: the home, pricing and tools
// pages use the bare /api/og/job as their share image.

const WIDTH = 1200;
const HEIGHT = 630;
const LIME = "#e1f073";
const INK = "#111111";
// tailwind.config.ts `primary` / `secondary`: the no-logo card is bg-primary with the letter in secondary.
const PRIMARY = "#222325";
const SECONDARY = "#e1f073";
const HAIRLINE = "rgba(17, 17, 17, 0.14)";

// The renderer can't read the site's variable Geist/Manrope files, so static Manrope cuts ship in assets/fonts.
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

const LOGO_TYPES = ["image/png", "image/jpeg", "image/gif", "image/svg+xml"];
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

/**
 * The company logo as a data URI, or null to fall back to the company's initial. Fetched here
 * rather than handed to the renderer as a URL, because one unreadable logo (webp, avif, a 404)
 * would otherwise fail the whole image. Cloudinary logos are asked for as a PNG, whatever they
 * were uploaded as.
 */
async function loadLogo(raw: string | null): Promise<string | null> {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname === "res.cloudinary.com" && url.pathname.includes("/image/upload/")) {
    url.pathname = url.pathname.replace("/image/upload/", "/image/upload/f_png,w_400,h_400,c_limit/");
  }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!LOGO_TYPES.includes(type)) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);

/** Region pills: at most three, then "+N". */
function regionPills(type: string | null): string[] {
  const regions = [...new Set((type ?? "").split(",").map((r) => r.trim()).filter(Boolean))];
  if (regions.length === 0) return ["Anywhere in the world"];
  if (regions.length <= 3) return regions;
  return [...regions.slice(0, 3), `+${regions.length - 3}`];
}

function titleSize(length: number): number {
  if (length <= 40) return 58;
  if (length <= 70) return 49;
  return 41;
}

/** The plain site card, for pages that share /api/og/job with no job. */
function siteCard() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fff",
          fontSize: 32,
          fontWeight: 600,
        }}>
        <LogoFull2
          style={{
            width: "550px",
          }}
        />
        <div style={{ marginTop: 1, margin: 50, marginBottom: 0, textAlign: "center", fontWeight: "600" }}>Visit remoteworldwide.net</div>
        <div>for latest remote jobs</div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
    },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("title") ?? "").trim();
  const company = (searchParams.get("company") ?? "").trim();
  if (!title || !company || !searchParams.get("type")) return siteCard();
  const pills = regionPills(searchParams.get("type"));
  const [logo, fontData] = await Promise.all([loadLogo(searchParams.get("logo")), fonts]);

  const headline = clip(company ? `${title} at ${company}` : title, 110);
  const size = titleSize(headline.length);
  const initial = (company || title || "R").charAt(0).toUpperCase();
  // Hairline frame with dots where the lines cross, as in the mock.
  const columns = [56, 760, 1144];
  const rows = [104, 526];

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

        {/* Pills and headline sit centred in the middle band, level with the logo card. */}
        <div style={{ position: "absolute", left: 84, top: 104, height: 422, width: 640, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {pills.map((pill) => (
              <div
                key={pill}
                style={{ display: "flex", padding: "6px 18px", borderRadius: 999, border: `2px solid ${INK}`, background: "#ffffff", fontSize: 22, fontWeight: 700 }}>
                {pill}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: size, fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{headline}</div>
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
          View job →
        </div>
        <div style={{ position: "absolute", right: 84, top: 560, display: "flex", fontSize: 24, fontWeight: 700 }}>remoteworldwide.net</div>

        <div
          style={{
            position: "absolute",
            left: 861,
            top: 220,
            width: 182,
            height: 182,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: logo ? "#ffffff" : PRIMARY,
            border: `2px solid ${INK}`,
            borderRadius: 20,
            boxShadow: `6px 6px 0 ${INK}`,
          }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={logo} width={123} height={123} style={{ objectFit: "contain" }} />
          ) : (
            <div style={{ display: "flex", fontSize: 98, fontWeight: 800, color: SECONDARY }}>{initial}</div>
          )}
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT, fonts: fontData },
  );
}
