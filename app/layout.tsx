import type { Metadata } from "next";
import "./globals.css";
import { NavbarProvider } from "@/provider/NavbarContext";
import Navbar from "./components/navigation/Navbar";
import { Manrope } from "next/font/google";
import Footer from "./components/navigation/Footer";

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
      <body className={`${font.className} antialiased`}>{children}</body>
    </html>
  );
}
