import { NavbarProvider } from "@/provider/NavbarContext";
import Navbar from "@/app/components/navigation/Navbar";
import Footer from "@/app/components/navigation/Footer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div>
      <NavbarProvider>
        <Navbar />
        <div className="w-full max-w-[1580px] overflow-clip m-auto">{children}</div>
        <Footer />
      </NavbarProvider>
    </div>
  );
}
