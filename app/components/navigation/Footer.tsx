import Link from "next/link";
import React from "react";
import LogoMini from "../svg/LogoMini";
import { InstagramIcon } from "@/components/ui/instagram-icon";
import { FaTelegram } from "react-icons/fa6";
import { LinkedInIcon } from "@/components/ui/linkedin-icon";
import { TwitterIcon } from "@/components/ui/twitter-icon";
import CookieSettingsButton from "@/app/components/consent/CookieSettingsButton";
import { SITE_NAV } from "@/app/lib/navigation/siteNav";

// The site's crawlable links, in three columns (owner, 2026-10-15): the navbar's three groups
// (SITE_NAV, so the words stay the same in both, as Google wants for sitelinks), Features first, plus
// the links only the footer carries. `external` opens in a new tab; a mailto: is a plain link.
type FooterLink = { title: string; href: string; external?: boolean };

const FOOTER_ONLY: Record<string, FooterLink[]> = {
  Jobs: [{ title: "Daily jobs on Telegram", href: "https://t.me/worldwideremote", external: true }],
  Company: [
    { title: "Contact", href: "mailto:contact@remoteworldwide.net" },
    { title: "Privacy Policy", href: "/privacy-policy" },
    { title: "Terms", href: "/terms" },
  ],
};

const COLUMN_ORDER = ["Features", "Jobs", "Company"];
const COLUMNS: { heading: string; links: FooterLink[] }[] = COLUMN_ORDER.map((label) => {
  const group = SITE_NAV.find((g) => g.label === label);
  return { heading: label, links: [...(group?.links ?? []), ...(FOOTER_ONLY[label] ?? [])] };
});

const SOCIALS = [
  { label: "X/Twitter", href: "https://x.com/W0rldwideremote", icon: <TwitterIcon size={20} /> },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/remoteworldwide", icon: <LinkedInIcon size={20} /> },
  { label: "Telegram", href: "https://t.me/worldwideremote", icon: <FaTelegram size={20} /> },
  { label: "Instagram", href: "https://www.instagram.com/remoteworldwide_/", icon: <InstagramIcon size={20} /> },
  {
    label: "TikTok",
    href: "https://www.tiktok.com/@worldwideremote",
    icon: (
      <svg className="size-5" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M16.6 5.82s.51.5 0 0A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6c0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64c0 3.33 2.76 5.7 5.69 5.7c3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48"></path>
      </svg>
    ),
  },
];

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary";
const LINK_CLASS = `inline-flex min-h-8 items-center rounded-sm text-sm text-white/65 transition-colors duration-150 hover:text-white ${FOCUS}`;

const FooterLinkItem = ({ link }: { link: FooterLink }) =>
  link.external || link.href.startsWith("mailto:") ? (
    <a href={link.href} {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={LINK_CLASS}>
      {link.title}
    </a>
  ) : (
    <Link href={link.href} className={LINK_CLASS}>
      {link.title}
    </Link>
  );

const Footer = () => {
  return (
    <footer className="relative z-10 bg-primary text-white">
      <div className="mx-auto max-w-[1200px] px-4 pb-8 pt-14 sm:px-6 md:pt-16">
        {/* Brand row: who we are in a line, and the way in. */}
        <div className="flex flex-col gap-6 border-b border-white/15 pb-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[420px]">
            <Link href="/" aria-label="Remote Worldwide home" className={`inline-flex items-center gap-2.5 rounded-md ${FOCUS}`}>
              <LogoMini width={30} height={30} className="h-[30px] w-[30px]" />
              <span className="text-lg font-extrabold tracking-tight">Remote Worldwide</span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              Vetted remote jobs you can do from anywhere, plus the AI tools to land them.
            </p>
          </div>
          <Link
            href="/waitlist"
            className={`inline-flex h-11 w-fit items-center rounded-full bg-secondary px-5 text-sm font-bold text-primary transition-colors hover:bg-white ${FOCUS}`}>
            Join the waitlist
          </Link>
        </div>

        {/* The three columns. Two across on a phone, Features taking the full first row. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 py-10 sm:grid-cols-3">
          {COLUMNS.map((column, i) => (
            <nav key={column.heading} aria-label={column.heading} className={i === 0 ? "col-span-2 sm:col-span-1" : undefined}>
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-secondary">{column.heading}</h2>
              <ul className={`mt-4 grid gap-y-0.5 ${i === 0 ? "grid-cols-2 gap-x-6 sm:grid-cols-1" : ""}`}>
                {column.links.map((link) => (
                  <li key={link.title}>
                    <FooterLinkItem link={link} />
                  </li>
                ))}
                {column.heading === "Company" && (
                  <li>
                    <CookieSettingsButton className={`${LINK_CLASS} cursor-pointer`} />
                  </li>
                )}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar: the years and the profiles. */}
        <div className="flex flex-col-reverse items-start gap-4 border-t border-white/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-white/50">© 2024 - {new Date().getFullYear()} Remote Worldwide</span>
          <div className="-ml-2.5 flex flex-wrap gap-1 sm:ml-0 sm:-mr-2.5">
            {SOCIALS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className={`grid size-10 place-content-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white ${FOCUS}`}>
                {social.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
