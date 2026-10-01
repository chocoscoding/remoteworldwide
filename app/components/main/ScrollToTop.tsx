"use client";
import { FC, useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Floating up arrow that appears once the page is scrolled past `threshold` px
// and takes the reader back to the top. `invisible` (not unmounting) keeps the
// fade while also dropping it from the tab order when hidden.
const ScrollToTop: FC<{ threshold?: number }> = ({ threshold = 300 }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const toTop = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Scroll to top"
      className={cn(
        "fixed bottom-6 right-4 md:right-6 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white br-shadow-press br-lime transition-[opacity,transform,visibility,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2",
        visible ? "visible opacity-100" : "invisible opacity-0 translate-y-3",
      )}>
      <ArrowUp className="h-5 w-5" aria-hidden />
    </button>
  );
};

export default ScrollToTop;
