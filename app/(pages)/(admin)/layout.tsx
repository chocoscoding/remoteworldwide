import type { Metadata } from "next";
import { NavbarProvider } from "@/provider/NavbarContext";
import Navbar from "@/app/components/navigation/Navbar";
import Footer from "@/app/components/navigation/Footer";
import AdminNavbar from "@/app/components/navigation/AdminNavbar";
import Sidebar from "@/app/components/navigation/Sidebar";

export const metadata: Metadata = {
  title: "ADMIN- Worldwide Remote",
  description: "Get worldwide remote jobs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="w-full flex">
      <Sidebar />
      <div className="w-full max-w-[1580px] overflow-clip m-auto">{children}</div>
    </div>
  );
}
