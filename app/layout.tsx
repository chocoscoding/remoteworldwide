import type { Metadata } from "next";
import "./globals.css";
import "react-quill/dist/quill.snow.css";
import { Manrope } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
const font = Manrope({
  subsets: ["latin-ext"],
  weight: ["200", "300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Worldwide Remote",
  description: "Get worldwide remote jobs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${font.className} antialiased`}>
        <NextTopLoader color="#000000" shadow="0 0 10px #000000,0 0 5px #000000" showSpinner={false} />
        {children}
      </body>
    </html>
  );
}
