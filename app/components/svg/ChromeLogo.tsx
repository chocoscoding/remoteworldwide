import type { SVGProps } from "react";

/* The real, coloured Chrome logo (lucide's Chrome is a one-colour outline). Three 120° sectors, each
   edge a line tangent to the white ring, then the white ring and the blue centre on top. */
const ChromeLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" {...props}>
    <path fill="#EA4335" d="M43.596 14A22 22 0 0 0 5.543 12.03L15.34 29A10 10 0 0 1 24 14Z" />
    <path fill="#34A853" d="M5.543 12.03A22 22 0 0 0 22.862 45.97L32.66 29A10 10 0 0 1 15.34 29Z" />
    <path fill="#FBBC04" d="M22.862 45.97A22 22 0 0 0 43.596 14H24A10 10 0 0 1 32.66 29Z" />
    <circle cx="24" cy="24" r="10" fill="#fff" />
    <circle cx="24" cy="24" r="8" fill="#1A73E8" />
  </svg>
);

export default ChromeLogo;
