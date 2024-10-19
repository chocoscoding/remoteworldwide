import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { NavbarProvider } from "@/provider/NavbarContext";
import Navbar from "./components/navigation/Navbar";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NavbarProvider>
          <Navbar />
          {children}
        </NavbarProvider>
      </body>
    </html>
  );
}
