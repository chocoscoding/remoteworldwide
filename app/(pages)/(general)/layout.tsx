import { NavbarProvider } from "@/provider/NavbarContext";
import { AuthModalProvider } from "@/app/components/auth/AuthModalProvider";
import Navbar from "@/app/components/navigation/Navbar";
import Footer from "@/app/components/navigation/Footer";
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div>
      <NavbarProvider>
        <AuthModalProvider>
          <Navbar />
          <div className="w-full max-w-[1580px] overflow-clip m-auto">{children}</div>
          <Footer />
        </AuthModalProvider>
      </NavbarProvider>
    </div>
  );
}
