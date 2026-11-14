import Link from "next/link";
import type { FC } from "react";
import { FileText, KanbanSquare, Mic, MousePointerClick, PenLine, Puzzle, ScanSearch, type LucideIcon } from "lucide-react";

/**
 * The tools, as a rail of buttons right under the home page's hero (owner, 2026-11-14), each opening
 * that tool's page. The names are the owner's short ones, so they differ from the page titles the
 * navbar and footer keep for sitelinks; the slugs are TOOLS' in app/lib/tools/catalogue.ts.
 */
const TOOLS: { name: string; href: string; Icon: LucideIcon }[] = [
  { name: "ATS scorer", href: "/tools/ats-resume-checker", Icon: ScanSearch },
  { name: "Resume creator", href: "/tools/ai-resume-builder", Icon: FileText },
  { name: "Cover letter creator", href: "/tools/ai-cover-letter-generator", Icon: PenLine },
  { name: "Application autofill", href: "/tools/job-application-autofill", Icon: MousePointerClick },
  { name: "Chrome extension", href: "/tools/chrome-extension", Icon: Puzzle },
  { name: "AI mock interview", href: "/tools/ai-mock-interview", Icon: Mic },
  { name: "Application tracker", href: "/tools/job-application-tracker", Icon: KanbanSquare },
];

/**
 * The rail is the list twice end to end (the globals.css `marquee-track` moves it half its width, so
 * the loop is seamless). Only the first copy is in the tab order and read out; the second is there
 * for the loop. It holds still under the pointer or while a button has keyboard focus, so a moving
 * button is never hard to press. With reduced motion it is one still, wrapped, centred row.
 *
 * A white band; the buttons are 10% black and turn lime on hover, with the hard 2px shadow
 * (br-plain-press) and the press on click (owner, 2026-11-14).
 */
const ToolsMarquee: FC = () => {
  const row = (copy: number) => (
    <ul
      aria-hidden={copy > 0 || undefined}
      className={copy > 0 ? "flex gap-3 pr-3 motion-reduce:hidden" : "flex gap-3 pr-3 motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:pr-0"}>
      {TOOLS.map(({ name, href, Icon }) => (
        <li key={href} className="flex-none">
          <Link
            href={href}
            tabIndex={copy > 0 ? -1 : undefined}
            className="inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-full border-transparent bg-primary/10 px-4 text-sm font-semibold text-primary transition-[background-color,border-color,box-shadow,transform] duration-150 br-plain-press hover:border-primary hover:bg-secondary focus-visible:border-primary focus-visible:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <Icon className="h-4 w-4 text-primary/70" aria-hidden />
            {name}
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <nav aria-label="Our tools" className="marquee-hold border-b border-primary/10 bg-white py-4">
      {/* The edge fade is on this inner box, so it fades the buttons and never the band. */}
      <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] motion-reduce:px-3 motion-reduce:[mask-image:none]">
        {/* The duration is inline: globals.css sets the animation outside Tailwind's layers. No side
            padding on the rail: it would make the half-width loop jump by that much at every wrap. */}
        <div className="marquee-track flex w-max py-1 motion-reduce:w-full motion-reduce:justify-center" style={{ animationDuration: "45s" }}>
          {row(0)}
          {row(1)}
        </div>
      </div>
    </nav>
  );
};

export default ToolsMarquee;
