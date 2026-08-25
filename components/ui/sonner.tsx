"use client";

// App-wide toast host. Styled to match the dashboard's neobrutalist house
// style — hard `#222325` ink border, flat offset lime shadow, square-ish
// corners — the same "sticker" language as `StickerButton`/`DashCard`,
// rather than sonner's default soft-elevation look. `unstyled: true` strips
// sonner's built-in visuals entirely so every pixel here is intentional.
//
// The dashboard has no dark-mode toggle (no `ThemeProvider` is mounted
// anywhere in the app), so theme is pinned to "light" rather than wired to
// `next-themes`.

import type { ComponentProps } from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = ComponentProps<typeof Sonner>;

const TOAST_BASE =
  "flex items-start gap-3 w-full rounded-xl border-2 border-[#222325] bg-white p-4 text-[#222325] shadow-[4px_4px_0_0_#e1f073]";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      gap={10}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast: TOAST_BASE,
          title: "text-sm font-bold text-[#222325] leading-snug",
          description: "text-xs text-black/55 mt-0.5",
          icon: "text-[#222325] mt-0.5",
          actionButton: "!bg-[#222325] !text-white !rounded-lg !text-xs !font-semibold !px-3 !py-1.5 !h-auto",
          cancelButton: "!bg-[#f0f0ea] !text-[#222325] !rounded-lg !text-xs !font-semibold !px-3 !py-1.5 !h-auto",
          closeButton: "!border-[#222325]/15 !bg-white !text-[#222325] hover:!bg-[#f0f0ea]",
          // Per-type accents layer on top of TOAST_BASE — the lime shadow is
          // the "default/success" signal, others swap it for a matching hue
          // while keeping the same hard ink border.
          success: "!shadow-[4px_4px_0_0_#e1f073]",
          error: "!shadow-[4px_4px_0_0_#f0a0a0]",
          warning: "!shadow-[4px_4px_0_0_#f0c86a]",
          info: "!shadow-[4px_4px_0_0_#cddd54]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
