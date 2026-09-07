"use client";

import type { FC, ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Home } from "lucide-react";
import { Lottie } from "lottie-react";
import { cn } from "@/lib/utils";

export interface ErrorScreenProps {
  digits: [string, string];
  title: string;
  message?: string;
  action?: ReactNode;
  fit?: "screen" | "shell";
}

export const ERROR_BUTTON =
  "inline-flex h-12 items-center gap-2 rounded-sm border-2 border-primary px-5 text-sm font-bold transition-all drop-shadow-primary2-hover";

const SHELLS = ["/heroshima", "/dashboard"];

const ErrorScreen: FC<ErrorScreenProps> = ({ digits: [left, right], title, message, action, fit }) => {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const shell = SHELLS.find((s) => pathname.startsWith(s));
  const home = shell ?? "/";
  const inShell = (fit ?? (shell ? "shell" : "screen")) === "shell";

  return (
    <section
      className={cn("flex w-full flex-col items-center justify-center bg-primary2 px-4 py-16 text-center", inShell ? "min-h-[calc(100vh-4rem)]" : "h-screen")}
      style={{ backgroundImage: "radial-gradient(#222325 0.9px, transparent 0.9px)", backgroundSize: "22px 22px" }}>
      <div className="flex items-center justify-center gap-1" aria-hidden>
        <Digit>{left}</Digit>
        <Lottie
          src="/Lottie/neobrutalism/Alerts_Circle_lottie.json"
          autoplay
          loop
          speed={0.6}
          className="h-[7.5rem] w-[7.5rem] sm:h-[11rem] sm:w-[11rem] md:h-[14rem] md:w-[14rem]"
        />
        <Digit>{right}</Digit>
      </div>
      <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.02em] text-primary md:text-4xl">{title}</h1>
      {message && <p className="mt-3 max-w-[48ch] text-base text-primary/65 md:text-lg">{message}</p>}
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {action ?? (
          <>
            <button type="button" onClick={() => router.back()} className={`${ERROR_BUTTON}bg-white text-primary hover:bg-secondary`}>
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
            <Link href={home} className={`${ERROR_BUTTON}bg-primary text-white`}>
              <Home className="h-4 w-4" />
              Go home
            </Link>
          </>
        )}
      </div>
    </section>
  );
};

const Digit: FC<{ children: ReactNode }> = ({ children }) => (
  <span
    className="select-none text-[7.5rem] font-black leading-none tracking-[-0.06em] text-primary sm:text-[11rem] md:text-[14rem]"
    style={{ textShadow: "6px 6px 0 #e1f073" }}>
    {children}
  </span>
);

export default ErrorScreen;
