"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavbar } from "@/provider/NavbarContext";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { signOut } from "@/app/lib/authClient";
import Image from "next/image";
import { ArrowRight, Bookmark, ChevronDown, LoaderCircle, LogOut, Menu, PenLine, Shield, UserRound, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import LogoFull from "../svg/LogoFull";
import LogoMini from "../svg/LogoMini";
import { cn } from "@/app/lib/utils";
import { loginWithNext, returnTo, signupWithNext } from "@/app/lib/next-url";
import { useAuthModal } from "@/app/components/auth/AuthModalProvider";
import { SITE_NAV } from "@/app/lib/navigation/siteNav";

const DASHBOARD = "/dashboard";
const WAITLIST = "/waitlist";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
// 36px rows: compact, as a menu's should be (owner, 2026-10-02: same text size, less height).
const MENU_ITEM =
  "flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm font-medium text-primary hover:bg-primary2 focus-visible:bg-primary2 focus-visible:outline-none";
// Both menus: a white card with the ink hairline and the 2px hard shadow, nothing softer.
const MENU_CARD = "rounded-xl bg-white br-shadow";

/** Each list's width, fixed so the panel never measures (and clips) a half-laid-out list. Features is two columns. */
const LIST_WIDTH: Record<string, string> = { Jobs: "w-[300px]", Features: "w-[560px]", Company: "w-[300px]" };
/** A group's overview page: a footer link under its rows instead of a row of its own. */
const OVERVIEW: Record<string, { title: string; href: string }> = { Features: { title: "See all features", href: "/tools" } };

/**
 * The user icon and its menu, below it. The site's pages live in the bar (and the hamburger on a
 * phone), so this is only about you: signed out, Log in and Sign up; signed in, who you are, then
 * Bookmarks, Writer or Admin by role, and Log out.
 */
const AccountMenu = ({
  signedIn,
  image,
  role,
  name,
  email,
}: {
  signedIn: boolean;
  image?: string | null;
  role?: string | null;
  name?: string | null;
  email?: string | null;
}) => {
  const { isOpen2: open, toggleNavbar2: toggle, closeNavbar2: close } = useNavbar();
  const { replace } = useRouter();
  const { openAuthModal } = useAuthModal();
  const pathname = usePathname();
  // Log in and Sign up open the popup over the page (owner, 2026-10-07). The /login and /signup
  // pages stay for links and for anyone who goes there; on them, the items just switch page.
  const onAuthPage = pathname === "/login" || pathname === "/signup";
  const wrapper = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // Closes on a click anywhere else, or on Escape (which hands focus back to the avatar).
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Signing in comes back to this page, query and all. The menu only renders after a click, so
  // `window` is always there when this is read (and no useSearchParams Suspense boundary is needed).
  const here = open && !signedIn ? returnTo(window.location.pathname, window.location.search) : "/";

  return (
    <div ref={wrapper} className="relative">
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-label={signedIn ? "Account menu" : "Sign in and more"}
        aria-expanded={open}
        aria-controls="account-menu"
        className={cn("group grid h-11 w-11 cursor-pointer place-content-center rounded-full text-primary", FOCUS)}>
        {signedIn ? (
          <Image
            width={28}
            height={28}
            src={image ?? "/images/noimage.png"}
            alt=""
            referrerPolicy="no-referrer"
            className="h-9 w-9 rounded-full border border-primary/15 object-cover"
          />
        ) : (
          <span
            className={cn(
              "grid h-[31px] w-[31px] place-content-center rounded-full border transition-colors group-hover:border-primary group-hover:bg-primary2",
              open ? "border-primary bg-primary2" : "border-primary/20",
            )}>
            <UserRound className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </button>

      {open ? (
        <div id="account-menu" className={cn("absolute right-0 top-full z-30 mt-2 w-64 p-1.5", MENU_CARD)}>
          {signedIn ? (
            <>
              <div className="flex items-center gap-3 px-2.5 pb-3 pt-2">
                <Image
                  width={36}
                  height={36}
                  src={image ?? "/images/noimage.png"}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 shrink-0 rounded-full border border-primary/15 object-cover"
                />
                <div className="min-w-0">
                  {name ? <p className="truncate text-sm font-bold text-primary">{name}</p> : null}
                  {email ? <p className="truncate text-xs text-primary/60">{email}</p> : null}
                </div>
              </div>
              <div className="mb-1.5 border-t border-primary/10" />
              <Link href="/bookmarks" onClick={close} className={MENU_ITEM}>
                <Bookmark className="h-4 w-4 text-primary/60" aria-hidden />
                Bookmarks
              </Link>
              {role === "AUTHOR" ? (
                <Link href="/heroshima/blogs" onClick={close} className={MENU_ITEM}>
                  <PenLine className="h-4 w-4 text-primary/60" aria-hidden />
                  Writer
                </Link>
              ) : null}
              {role === "ADMIN" ? (
                <Link href="/heroshima" onClick={close} className={MENU_ITEM}>
                  <Shield className="h-4 w-4 text-primary/60" aria-hidden />
                  Admin
                </Link>
              ) : null}
              <div className="my-1.5 border-t border-primary/10" />
              <button
                type="button"
                onClick={async () => {
                  close();
                  await signOut();
                  replace("/");
                }}
                className={cn(MENU_ITEM, "cursor-pointer")}>
                <LogOut className="h-4 w-4 text-primary/60" aria-hidden />
                Log out
              </button>
            </>
          ) : onAuthPage ? (
            <>
              <Link href={loginWithNext(here)} onClick={close} className={cn(MENU_ITEM, "font-bold")}>
                Log in
              </Link>
              <Link href={signupWithNext(here)} onClick={close} className={MENU_ITEM}>
                Sign up
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  close();
                  openAuthModal("login");
                }}
                className={cn(MENU_ITEM, "cursor-pointer font-bold")}>
                Log in
              </button>
              <button
                type="button"
                onClick={() => {
                  close();
                  openAuthModal("signup");
                }}
                className={cn(MENU_ITEM, "cursor-pointer")}>
                Sign up
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
};

// The words in the bar: tight, since the sliding underline under them is what shows hover and "you're here".
const TRIGGER =
  "inline-flex h-9 items-center whitespace-nowrap rounded-full text-sm font-semibold text-primary/80 transition-colors hover:text-primary";
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const GAP = 16; // the panel never comes closer than this to the window's edge

type Box = { left: number; width: number; height: number; shown: boolean; instant: boolean };
const HIDDEN: Box = { left: 0, width: 0, height: 0, shown: false, instant: true };

/**
 * The bar's three words and one shared panel under them (owner, 2026-10-15). Hovering a word opens
 * the panel; moving to the next word slides the panel and resizes it to that word's list instead of
 * closing one menu and opening another, and the underline under the words slides along with the cursor
 * (resting on the current page's word otherwise). Touch and keyboard use the chevrons.
 *
 * Every list is always in the HTML, only hidden while it isn't showing, so Google reads every link:
 * what it picks the sitelinks under the site's result from. The word opens its page (Company has
 * none, so it opens the list).
 */
const NavMenu = ({ pathname }: { pathname: string | null }) => {
  const [open, setOpen] = useState<number | null>(null); // the list the panel shows
  const [hover, setHover] = useState<number | null>(null); // the word under the pointer
  const [line, setLine] = useState<Box>(HIDDEN);
  const [panel, setPanel] = useState<Box>(HIDDEN);
  const root = useRef<HTMLDivElement>(null);
  const triggers = useRef<(HTMLDivElement | null)[]>([]);
  const lists = useRef<(HTMLDivElement | null)[]>([]);
  const closeTimer = useRef<number | undefined>(undefined);
  const lastOpen = useRef<number | null>(null);
  // One menu at a time: opening a list closes the account menu, and opening that closes the list.
  const { isOpen2: accountOpen, closeNavbar2: closeAccount } = useNavbar();

  const here = SITE_NAV.findIndex((group) => group.links.some((link) => pathname?.startsWith(link.href)));
  const lineAt = hover ?? open ?? (here >= 0 ? here : null);

  // The underline: under the word and its chevron (the `data-mark` parts), sliding from the last
  // word, or straight there when it was hidden.
  useLayoutEffect(() => {
    const el = lineAt === null ? null : triggers.current[lineAt];
    const marks = el ? [...el.querySelectorAll("[data-mark]")].map((m) => m.getBoundingClientRect()) : [];
    if (!el || !el.offsetWidth || !marks.length || !root.current) {
      setLine((p) => ({ ...p, shown: false, instant: true }));
      return;
    }
    const rootLeft = root.current.getBoundingClientRect().left;
    const left = Math.min(...marks.map((r) => r.left)) - rootLeft;
    const width = Math.max(...marks.map((r) => r.right)) - rootLeft - left - 20;
    setLine((p) => ({ left, width, height: 0, shown: true, instant: !p.shown }));
  }, [lineAt]);

  // The panel: under its word, as big as its list, kept inside the window. From closed it fades in
  // where it belongs; from another list it slides and resizes.
  useLayoutEffect(() => {
    const previous = lastOpen.current;
    lastOpen.current = open;
    if (open === null) {
      setPanel((p) => ({ ...p, shown: false }));
      return;
    }
    const trigger = triggers.current[open];
    const list = lists.current[open];
    if (!trigger || !list || !root.current) return;
    const rootLeft = root.current.getBoundingClientRect().left;
    const width = list.offsetWidth;
    const maxLeft = window.innerWidth - GAP - width - rootLeft;
    const left = Math.max(GAP - rootLeft, Math.min(trigger.offsetLeft, maxLeft));
    setPanel({ left, width, height: list.offsetHeight, shown: true, instant: previous === null });
  }, [open]);

  const close = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(null);
    setHover(null);
  };

  // A click anywhere else, Escape, or a new page closes it.
  useEffect(close, [pathname]);
  useEffect(() => {
    if (open === null) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (open !== null) closeAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    if (accountOpen) close();
  }, [accountOpen]);

  const toggle = (i: number) => setOpen((current) => (current === i ? null : i));

  return (
    <div
      ref={root}
      // From sm up; a phone gets the hamburger (MobileMenu) instead.
      className="relative hidden items-center gap-1 lg:flex"
      onPointerEnter={() => window.clearTimeout(closeTimer.current)}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        // A moment's grace, so a cursor that slips off a corner doesn't close it.
        closeTimer.current = window.setTimeout(close, 150);
      }}>
      {/* The underline: 1.5px black, sliding between the words (owner, 2026-10-15). */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 mt-[11px] h-[1.5px] rounded-full bg-primary"
        style={{
          left: line.left,
          width: line.width,
          opacity: line.shown ? 1 : 0,
          transition: line.instant ? "opacity 150ms" : `left 300ms ${EASE}, width 300ms ${EASE}, opacity 150ms`,
        }}
      />

      {SITE_NAV.map((group, i) => {
        const chevron = (
          <ChevronDown data-mark className={cn("h-3.5 w-3.5 transition-transform duration-200", open === i && "rotate-180")} aria-hidden />
        );
        const lit = open === i || hover === i || here === i;
        return (
          <div
            key={group.label}
            ref={(el) => {
              triggers.current[i] = el;
            }}
            className="relative z-10 flex items-center"
            onPointerEnter={(e) => {
              if (e.pointerType !== "mouse") return;
              setHover(i);
              setOpen(i);
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") setHover(null);
            }}>
            {group.href ? (
              <>
                <Link
                  href={group.href}
                  onClick={close}
                  aria-current={pathname === group.href ? "page" : undefined}
                  className={cn(TRIGGER, "pl-3 pr-0.5", lit && "text-primary", FOCUS)}>
                  <span data-mark>{group.label}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={open === i}
                  aria-controls="nav-panel"
                  aria-label={`More ${group.label} pages`}
                  className={cn(
                    "grid h-9 w-7 cursor-pointer place-content-center rounded-full pr-1 text-primary/70 hover:text-primary",
                    FOCUS,
                  )}>
                  {chevron}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-expanded={open === i}
                aria-controls="nav-panel"
                className={cn(TRIGGER, "cursor-pointer gap-1 pl-3 pr-2.5", lit && "text-primary", FOCUS)}>
                <span data-mark>{group.label}</span>
                {chevron}
              </button>
            )}
          </div>
        );
      })}

      {/* One panel for all three lists. Its top padding bridges the gap under the words, so the
          cursor never leaves the menu on its way down. */}
      <div
        className={cn("absolute top-full z-30 pt-2", !panel.shown && "pointer-events-none")}
        style={{ left: panel.left, transition: panel.instant ? "none" : `left 300ms ${EASE}` }}>
        <div
          id="nav-panel"
          className={cn("relative overflow-hidden", MENU_CARD)}
          style={{
            width: panel.width,
            height: panel.height,
            opacity: panel.shown ? 1 : 0,
            transform: panel.shown ? "translateY(0)" : "translateY(-4px)",
            visibility: panel.shown ? "visible" : "hidden",
            transition: panel.instant
              ? "opacity 150ms, transform 150ms, visibility 150ms"
              : `width 300ms ${EASE}, height 300ms ${EASE}, opacity 150ms, transform 150ms, visibility 150ms`,
          }}>
          {SITE_NAV.map((group, i) => {
            const showing = open === i;
            // The list going out drifts away from the one coming in, which arrives from the side
            // its word is on.
            const offset = showing || open === null ? 0 : i < open ? -24 : 24;
            const overview = OVERVIEW[group.label];
            const rows = group.links.filter((link) => link.href !== overview?.href);
            return (
              <div
                key={group.label}
                ref={(el) => {
                  lists.current[i] = el;
                }}
                aria-hidden={!showing}
                className={cn("absolute left-0 top-0 p-1.5", LIST_WIDTH[group.label] ?? "w-[300px]")}
                style={{
                  opacity: showing ? 1 : 0,
                  visibility: showing ? "visible" : "hidden",
                  transform: `translateX(${offset}px)`,
                  transition: `opacity 200ms, transform 300ms ${EASE}, visibility 200ms`,
                }}>
                <ul className={cn("grid gap-0.5", rows.length > 4 && "grid-cols-2")}>
                  {rows.map((link) => {
                    const current = pathname === link.href;
                    return (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          onClick={close}
                          tabIndex={showing ? undefined : -1}
                          aria-current={current ? "page" : undefined}
                          className={cn(
                            "block rounded-lg px-2.5 py-2 hover:bg-primary2 focus-visible:bg-primary2 focus-visible:outline-none",
                            current && "bg-primary2",
                          )}>
                            <span className={cn("block text-sm text-primary", current ? "font-bold" : "font-semibold")}>
                              {link.title}
                            </span>
                          {link.blurb ? <span className="block text-xs leading-snug text-primary/60">{link.blurb}</span> : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {overview ? (
                  <Link
                    href={overview.href}
                    onClick={close}
                    tabIndex={showing ? undefined : -1}
                    aria-current={pathname === overview.href ? "page" : undefined}
                    className="group/all mx-1 mt-1.5 flex items-center justify-between border-t border-primary/10 px-1.5 pb-1.5 pt-3 text-sm font-semibold text-primary hover:underline focus-visible:underline focus-visible:outline-none">
                    {overview.title}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/all:translate-x-0.5" aria-hidden />
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * A phone's menu (owner, 2026-10-15): the hamburger at the bar's right end opens a sheet under the bar
 * with the same three groups, each a row that opens its list. The desktop lists above are in the HTML
 * on a phone too (only hidden), so Google reads every link either way.
 */
const MobileMenu = ({ pathname }: { pathname: string | null }) => {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<number | null>(null);
  const { isOpen2: accountOpen, closeNavbar2: closeAccount } = useNavbar();
  const button = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setGroup(null);
  };

  // A new page or the account menu closes it; Escape closes it and hands focus back to the button.
  useEffect(close, [pathname]);
  useEffect(() => {
    if (accountOpen) close();
  }, [accountOpen]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      button.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={button}
        type="button"
        onClick={() => {
          if (!open) closeAccount();
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className={cn("grid h-11 w-11 cursor-pointer place-content-center rounded-full text-primary", FOCUS)}>
        {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
      </button>

      {open ? (
        <>
          {/* Dim and blur the page beneath the sheet; tapping the backdrop closes the menu. */}
          <div aria-hidden onClick={close} className="fixed inset-x-0 bottom-0 top-16 z-20 bg-black/20 backdrop-blur-sm" />
          <div
            id="mobile-menu"
            className="absolute inset-x-0 top-full z-30 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-primary/10 bg-white px-4 pb-5 pt-2">
            {SITE_NAV.map((navGroup, i) => {
              const expanded = group === i;
              return (
                <div key={navGroup.label} className="border-b border-primary/10 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setGroup(expanded ? null : i)}
                    aria-expanded={expanded}
                    aria-controls={`mobile-menu-${i}`}
                    className={cn(
                      "flex min-h-14 w-full cursor-pointer items-center justify-between text-base font-bold text-primary",
                      FOCUS,
                    )}>
                    {navGroup.label}
                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} aria-hidden />
                  </button>
                  {/* Opens to its own height: the grid row animates from 0fr to 1fr. */}
                  <div
                    id={`mobile-menu-${i}`}
                    className={cn(
                      "grid transition-[grid-template-rows] duration-300 ease-out",
                      expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}>
                    <ul className="overflow-hidden">
                      {navGroup.links.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={close}
                            tabIndex={expanded ? undefined : -1}
                            aria-current={pathname === link.href ? "page" : undefined}
                            className={cn(
                              "flex min-h-11 items-center text-[15px] text-primary/75 hover:text-primary",
                              pathname === link.href && "font-bold text-primary underline decoration-[1.5px] underline-offset-4",
                              FOCUS,
                            )}>
                            {link.title}
                          </Link>
                        </li>
                      ))}
                      <li aria-hidden className="h-2" />
                    </ul>
                  </div>
                </div>
              );
            })}
            {/* The bar's Waitlist button, which a phone's bar leaves out. */}
            <Link
              href={WAITLIST}
              onClick={close}
              aria-current={pathname === WAITLIST ? "page" : undefined}
              className={cn(
                "mt-4 flex h-12 w-full items-center justify-center rounded-full bg-secondary text-base font-bold text-primary br-shadow-press",
                FOCUS,
              )}>
              Join the waitlist
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
};

const Navbar = () => {
  const pathname = usePathname();
  const { status, data } = useSession();
  const signedIn = status === "authenticated";
  const { openAuthModal } = useAuthModal();

  const colorToShow = (() => {
    const currentPathname = pathname;
    switch (currentPathname) {
      case "/blogs":
        return "bg-white border-white";
      default:
        return "bg-white border-primary/10";
    }
  })();
  return (
    <nav aria-label="Main" className={cn("border-b sticky z-20 top-0", colorToShow)}>
      <div className="max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" aria-label="Remote Worldwide home" className={cn("block rounded-md py-2.5", FOCUS)}>
              <LogoFull className="hidden h-[21px] w-auto lg:block" />
              <LogoMini width={35} height={35} className="w-full !h-auto block lg:hidden" />
            </Link>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-2">
            <NavMenu pathname={pathname} />

            {/* <Link href={DASHBOARD} onClick={(event) => {
              if (!signedIn) { event.preventDefault(); openAuthModal("login", DASHBOARD); }
            }} aria-current={pathname?.startsWith(DASHBOARD) ? "page" : undefined} className={cn(BAR_LINK, "hidden lg:inline-flex", FOCUS)}>
              Dashboard
            </Link> */}

            {/* The 44px link is the touch target; the pill inside is what you see. From sm up only:
                a phone has it in the hamburger (owner, 2026-10-15). */}
            <Link
              href={WAITLIST}
              aria-current={pathname === WAITLIST ? "page" : undefined}
              className={cn("group hidden h-10 items-center rounded-full lg:inline-flex", FOCUS)}>
              <span className="inline-flex h-8 items-center rounded-full bg-secondary px-3.5 text-sm font-bold text-primary br-shadow-press mr-2">
                Waitlist
              </span>
            </Link>

            {/* The user icon on every screen size; a phone also gets the hamburger after it. */}
            {status === "loading" ? (
              <span role="status" aria-label="Loading your account" className="grid h-11 w-11 place-content-center">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary/60" aria-hidden />
              </span>
            ) : (
              <AccountMenu
                signedIn={signedIn}
                image={data?.user?.image}
                role={data?.user?.role}
                name={data?.user?.name}
                email={data?.user?.email}
              />
            )}

            <MobileMenu pathname={pathname} />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
