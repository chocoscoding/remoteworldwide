import type { FC } from "react";
import { cn } from "@/lib/utils";
import { AUTOFILL_ATS } from "@/app/lib/pricing/catalogue";

/**
 * "Autofill works on", under the /pricing hero (owner, 2026-10-26): the application systems the
 * extension fills, as plain monochrome wordmarks in our own type. No vendor logo files, so nothing
 * of theirs is redrawn, and the words say "works on", never "partners".
 *
 * The rail is the list twice end to end (the globals.css `marquee-track` moves it half its width,
 * so the loop is seamless), slow, and holds still under the pointer. With reduced motion it is a
 * static wrapped grid instead. Both visible versions are hidden from screen readers, which get the
 * plain list once.
 */
const AtsMarquee: FC<{ className?: string }> = ({ className }) => {
  const names = (copy: number) =>
    AUTOFILL_ATS.map((name) => (
      <li key={`${copy}-${name}`} className="flex-none whitespace-nowrap px-5 text-base font-bold tracking-tight text-primary/55">
        {name}
      </li>
    ));
  return (
    <section aria-labelledby="ats-heading" className={cn("mx-auto max-w-[1180px] px-4", className)}>
      <h2 id="ats-heading" className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-primary/65">
        Autofill works on
      </h2>
      <ul className="sr-only">
        {AUTOFILL_ATS.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>

      <div
        aria-hidden
        className="marquee-hold mt-4 overflow-hidden border-y border-primary/10 py-4 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] motion-reduce:hidden">
        <div className="marquee-track marquee-slow flex w-max">
          <ul className="flex">{names(0)}</ul>
          <ul className="flex">{names(1)}</ul>
        </div>
      </div>

      <ul aria-hidden className="mt-4 hidden flex-wrap justify-center gap-y-2 border-y border-primary/10 py-4 motion-reduce:flex">
        {names(2)}
      </ul>
    </section>
  );
};

export default AtsMarquee;
