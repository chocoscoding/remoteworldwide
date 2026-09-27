import type { CSSProperties } from "react";
import { Check, Flame, Sparkle, X } from "lucide-react";
import { cn } from "@/lib/utils";

// The /waitlist hero illustration: three tool cards in a loose stack. Purely
// decorative (aria-hidden) and made of markup, not screenshots, so it stays
// sharp and costs no image weight. The people and numbers on it are samples.

const WAVE = [0.35, 0.6, 0.9, 0.5, 0.75, 1, 0.55, 0.8, 0.4, 0.95, 0.65, 0.45, 0.85, 0.6, 0.3, 0.7, 0.95, 0.5, 0.75, 0.4, 0.6, 0.9, 0.55, 0.7];

const LABEL = "text-[10px] font-extrabold uppercase tracking-[0.14em]";

const float = (delay: string): CSSProperties => ({ animationDelay: delay });

function Gauge({ value }: { value: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-[84px] w-[84px] flex-none">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#ecebe3" strokeWidth="9" />
        <circle cx="40" cy="40" r={r} fill="none" stroke="#cddd54" strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-2xl font-extrabold text-primary tabular-nums">{value}</span>
        <span className="mt-0.5 text-[9px] font-bold text-primary/50">/ 100</span>
      </span>
    </div>
  );
}

export default function ProductCollage({ className }: { className?: string }) {
  // Laid out on a fixed 540 × 500 stage from lg up, scaled to fit the narrower
  // column between lg and xl, so the overlaps stay deliberate at every width.
  return (
    <div aria-hidden className={cn("mx-auto w-full max-w-[540px] select-none lg:h-[420px] xl:h-[500px]", className)}>
      <div className="relative lg:h-[500px] lg:w-[540px] lg:origin-top-left lg:scale-[0.84] xl:scale-100">
        <Sparkle className="absolute -left-4 top-[250px] hidden h-8 w-8 fill-secondary text-primary lg:block" strokeWidth={1.5} />
        <Sparkle className="absolute right-6 top-[96px] hidden h-5 w-5 fill-secondary text-primary lg:block" strokeWidth={1.5} />
        <Sparkle className="absolute bottom-[60px] right-[90px] hidden h-7 w-7 fill-white text-primary lg:block" strokeWidth={1.5} />

        <div className="flex flex-col gap-6 sm:flex-row sm:items-start lg:block">
          {/* ATS match */}
          <div className="rww-float relative w-full -rotate-2 rounded-[20px] border-2 border-primary bg-white p-5 shadow-[6px_6px_0_0_#222325] sm:w-1/2 lg:absolute lg:left-0 lg:top-0 lg:w-[305px] lg:-rotate-3" style={float("0s")}>
            <div className="flex items-center justify-between gap-2">
              <span className={cn(LABEL, "text-primary/55")}>ATS match</span>
              <span className="truncate rounded-full border-2 border-primary px-2 py-0.5 text-[10px] font-bold text-primary">Product Designer · Remote</span>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <Gauge value={86} />
              <ul className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-primary">
                {["Design systems", "Figma", "User research"].map((k) => (
                  <li key={k} className="flex items-center gap-1.5">
                    <span className="grid h-4 w-4 flex-none place-content-center rounded-full bg-secondary">
                      <Check className="h-2.5 w-2.5" strokeWidth={4} />
                    </span>
                    {k}
                  </li>
                ))}
                <li className="flex items-center gap-1.5 text-[#b23c26]">
                  <span className="grid h-4 w-4 flex-none place-content-center rounded-full bg-[#f6ddd6]">
                    <X className="h-2.5 w-2.5" strokeWidth={4} />
                  </span>
                  A/B testing
                </li>
              </ul>
            </div>
            <p className="mt-4 rounded-lg border-2 border-dashed border-primary/25 bg-[#f9f8f1] px-3 py-2 text-[11px] font-semibold leading-snug text-primary/75">
              Add &ldquo;A/B testing&rdquo; to your checkout-redesign bullet
            </p>
          </div>

          {/* Mock interview */}
          <div className="rww-float relative z-10 w-full rotate-2 rounded-[20px] border-2 border-primary bg-primary p-5 text-white shadow-[6px_6px_0_0_#e1f073] sm:mt-10 sm:w-1/2 lg:absolute lg:right-0 lg:top-[150px] lg:mt-0 lg:w-[270px]" style={float("-2s")}>
            <div className="flex items-center justify-between">
              <span className={cn(LABEL, "flex items-center gap-2 text-white/60")}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b57] opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff6b57]" />
                </span>
                Mock interview
              </span>
              <span className="font-mono text-xs text-white/55">04:12</span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-snug">&ldquo;Tell me about a time you changed a stakeholder&apos;s mind.&rdquo;</p>
            <div className="mt-4 flex h-12 items-center gap-[3px]">
              {WAVE.map((h, i) => (
                <span key={i} className="rww-wave-bar w-[5px] flex-none rounded-full bg-secondary" style={{ height: `${h * 100}%`, animationDelay: `${(i % 8) * -0.14}s` }} />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 text-[10px] font-bold">
              <span className="rounded-full bg-white/10 px-2 py-1">Pace · steady</span>
              <span className="rounded-full bg-white/10 px-2 py-1">Clear STAR story</span>
            </div>
          </div>

          {/* Tracker */}
          <div className="rww-float relative hidden rotate-2 rounded-[20px] border-2 border-primary bg-secondary p-5 shadow-[6px_6px_0_0_#222325] lg:absolute lg:left-[40px] lg:top-[300px] lg:block lg:w-[260px]" style={float("-1s")}>
            <span className={cn(LABEL, "text-primary/60")}>This week</span>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { n: 7, l: "Applied" },
                { n: 2, l: "Interviews" },
                { n: 1, l: "Offer" },
              ].map((s) => (
                <div key={s.l} className="rounded-lg border-2 border-primary bg-white px-1 py-2 text-center">
                  <p className="text-xl font-extrabold leading-none text-primary tabular-nums">{s.n}</p>
                  <p className="mt-1 text-[10px] font-bold text-primary/55">{s.l}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary">
              <Flame className="h-3.5 w-3.5 fill-[#f0c86a]" /> 5-day streak
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
