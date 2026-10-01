"use client";
import { useEffect, useRef } from "react";
import { useNavbar } from "@/provider/NavbarContext";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { signOut } from "@/app/lib/authClient";
import Image from "next/image";
import { LoaderCircle, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import LogoFull from "../svg/LogoFull";
import LogoMini from "../svg/LogoMini";
import { cn } from "@/app/lib/utils";
import { loginWithNext, returnTo, signupWithNext } from "@/app/lib/next-url";

const JOBS = "/jobs";
const DASHBOARD = "/dashboard";
const WAITLIST = "/waitlist";
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
// 36px rows: compact, as a menu's should be (owner, 2026-10-02: same text size, less height).
const MENU_ITEM =
  "flex min-h-9 w-full items-center px-4 text-left text-sm font-medium text-primary hover:bg-primary2 focus-visible:bg-primary2 focus-visible:outline-none";
const BAR_LINK =
  "inline-flex h-11 items-center rounded-full px-2 text-sm font-semibold text-primary/80 transition-colors hover:bg-primary2 hover:text-primary sm:px-3";

/** What the bar used to link and no longer does, in the menu whether or not you're signed in. */
const SITE_LINKS = [
  // { href: "/dashboard", label: "Dashboard" },
  { href: "/jobs", label: "Jobs" },
  { href: "/companies", label: "Companies" },
  { href: "/blogs", label: "Blog" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * The user icon and its menu, below it. Signed out: Log in and Sign up, then the site's other pages.
 * Signed in, behind the avatar: Bookmarks, Writer or Admin by role, the same pages, and Logout.
 */
const AccountMenu = ({ signedIn, image, role }: { signedIn: boolean; image?: string | null; role?: string | null }) => {
  const { isOpen2: open, toggleNavbar2: toggle, closeNavbar2: close } = useNavbar();
  const { replace } = useRouter();
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
            className="h-7 w-7 rounded-full border border-primary/15 object-cover"
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
        <div
          id="account-menu"
          className="absolute right-0 top-full z-30 mt-2 w-52 overflow-hidden rounded-xl border border-primary/10 bg-white py-1 shadow-[0_8px_24px_-12px_rgba(34,35,37,0.25)] !br-shadow">
          {signedIn ? (
            <>
              <Link href="/bookmarks" onClick={close} className={MENU_ITEM}>
                Bookmarks
              </Link>
              {role === "AUTHOR" ? (
                <Link href="/heroshima/blogs" onClick={close} className={MENU_ITEM}>
                  Writer
                </Link>
              ) : null}
              {role === "ADMIN" ? (
                <Link href="/heroshima" onClick={close} className={MENU_ITEM}>
                  Admin
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <Link href={loginWithNext(here)} onClick={close} className={cn(MENU_ITEM, "font-bold")}>
                Log in
              </Link>
              <Link href={signupWithNext(here)} onClick={close} className={MENU_ITEM}>
                Sign up
              </Link>
            </>
          )}
          <div className="my-1 border-t border-primary/10" />
          {SITE_LINKS.map((item) => (
            <Link key={item.href} href={item.href} onClick={close} className={MENU_ITEM}>
              {item.label}
            </Link>
          ))}
          {signedIn ? (
            <button
              type="button"
              onClick={async () => {
                close();
                await signOut();
                replace("/");
              }}
              className={cn(MENU_ITEM, "mt-1 border-t border-primary/10")}>
              Logout
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

const Navbar = () => {
  const pathname = usePathname();
  const { status, data } = useSession();
  const signedIn = status === "authenticated";
  const dashboardHref = signedIn ? DASHBOARD : loginWithNext(DASHBOARD);

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
              <LogoFull className="hidden h-[21px] w-auto sm:block" />
              <LogoMini width={35} height={35} className="w-full !h-auto block sm:hidden" />
            </Link>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1">
            <Link href={JOBS} aria-current={pathname?.startsWith(JOBS) ? "page" : undefined} className={cn(BAR_LINK, FOCUS)}>
              Jobs
            </Link>

            {/* <Link href={dashboardHref} aria-current={pathname?.startsWith(DASHBOARD) ? "page" : undefined} className={cn(BAR_LINK, FOCUS)}>
              Dashboard
            </Link> */}

            {/* The 44px link is the touch target; the pill inside is what you see. */}
            <Link
              href={WAITLIST}
              aria-current={pathname === WAITLIST ? "page" : undefined}
              className={cn("group inline-flex h-11 items-center rounded-full", FOCUS)}>
              <span className="inline-flex h-8 items-center rounded-full bg-secondary px-3.5 text-sm font-bold text-primary br-shadow-press">
                Waitlist
              </span>
            </Link>

            {/* The user icon sits where the hamburger was, on every screen size. */}
            {status === "loading" ? (
              <span role="status" aria-label="Loading your account" className="grid h-11 w-11 place-content-center">
                <LoaderCircle className="h-3.5 w-3.5 animate-spin text-primary/60" aria-hidden />
              </span>
            ) : (
              <AccountMenu signedIn={signedIn} image={data?.user?.image} role={data?.user?.role} />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
