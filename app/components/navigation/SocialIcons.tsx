import { cn } from "@/lib/utils";
import styles from "./SocialIcons.module.css";

// The footer's X, LinkedIn and Instagram icons. They animate when their link is hovered: put
// `socialLink` on the link. Plain SVG and CSS (SocialIcons.module.css), so no script ships for them.

export const socialLink = styles.link;

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const TwitterIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 512 512"
    width={size}
    height={size}
    fill="currentColor"
    stroke="currentColor"
    aria-hidden
    className={cn(styles.icon, styles.twitter)}>
    <path
      className={styles.twitterPath}
      d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z"
    />
  </svg>
);

export const InstagramIcon = ({ size = 24 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} {...STROKE} aria-hidden className={cn(styles.icon, styles.instagram)}>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" pathLength={1} className={cn(styles.draw, styles.igFrame)} />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" pathLength={1} className={cn(styles.draw, styles.igLens)} />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" className={styles.igDot} />
  </svg>
);

export const LinkedInIcon = ({ size = 24 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} {...STROKE} aria-hidden className={cn(styles.icon, styles.linkedin)}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" pathLength={1} className={cn(styles.draw, styles.liMain)} />
    <rect width="4" height="12" x="2" y="9" pathLength={1} className={cn(styles.draw, styles.liRest)} />
    <circle cx="4" cy="4" r="2" pathLength={1} className={cn(styles.draw, styles.liRest)} />
  </svg>
);
