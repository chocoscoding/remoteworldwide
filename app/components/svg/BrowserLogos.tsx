import type { SVGProps } from "react";

/* Coloured Safari and Firefox marks, drawn on the same 48-unit, r=22 grid as ChromeLogo so
   the three read as equal circles at 16-18px. Simplified shapes: legible small, not exact copies. */

const TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  const at = (r: number) => [24 + Math.cos(a) * r, 24 + Math.sin(a) * r].map((n) => n.toFixed(2));
  const [x1, y1] = at(16.5);
  const [x2, y2] = at(18);
  return { x1, y1, x2, y2 };
});

export const SafariLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" {...props}>
    <defs>
      <linearGradient id="rww-safari-face" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#1ADBFF" />
        <stop offset="1" stopColor="#1A6CF0" />
      </linearGradient>
    </defs>
    <circle cx="24" cy="24" r="22" fill="#fff" stroke="#D5D5D5" strokeWidth="1" />
    <circle cx="24" cy="24" r="19" fill="url(#rww-safari-face)" />
    <g stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".9">
      {TICKS.map((t, i) => (
        <line key={i} {...t} />
      ))}
    </g>
    <path fill="#FF3B30" d="M35.3 12.7 26.5 26.5 21.5 21.5Z" />
    <path fill="#fff" d="M12.7 35.3 21.5 21.5 26.5 26.5Z" />
  </svg>
);

export const FirefoxLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" {...props}>
    <defs>
      <linearGradient id="rww-firefox-fox" x1=".85" y1=".1" x2=".15" y2=".95">
        <stop offset="0" stopColor="#FFE226" />
        <stop offset=".35" stopColor="#FF980E" />
        <stop offset=".7" stopColor="#FF3647" />
        <stop offset="1" stopColor="#E31587" />
      </linearGradient>
      <radialGradient id="rww-firefox-globe" cx=".35" cy=".3" r=".9">
        <stop offset="0" stopColor="#9059FF" />
        <stop offset=".6" stopColor="#5B2ED9" />
        <stop offset="1" stopColor="#3A1CB0" />
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="22" fill="url(#rww-firefox-fox)" />
    <circle cx="25.5" cy="25.5" r="13" fill="url(#rww-firefox-globe)" />
    <path
      fill="url(#rww-firefox-fox)"
      d="M10.5 22C11 14 18 9.5 25 10.5 31 11.3 35.5 15 37 20 33 15.5 27 14 22 15.5 17 17 14 21 14.2 26 12.6 25.3 11.2 24 10.5 22Z"
    />
  </svg>
);
