"use client";

// The last resort: an error in the root layout itself. It replaces that layout, so it brings its
// own <html>, <body>, global styles and font, and the same look as every other error page.
// Metadata exports are not supported here, so the tab title is a plain <title>.

import "./globals.css";
import { useEffect } from "react";
import { Manrope } from "next/font/google";
import ErrorScreen from "@/app/components/ErrorScreen";

const font = Manrope({
  subsets: ["latin-ext"],
  weight: ["400", "500", "700"],
});

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  retry?: () => void;
};

export default function GlobalError({ error, reset, retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className={`${font.className} antialiased`}>
        <title>Something went wrong | Remote Worldwide</title>
        <ErrorScreen
          fit="screen"
          digits={["5", "0"]}
          title="Something went wrong"
          message="The site hit a problem on our side. Try again, and if it keeps happening, write to contact@remoteworldwide.net."
          onRetry={retry ?? reset}
          reference={error.digest}
        />
      </body>
    </html>
  );
}
