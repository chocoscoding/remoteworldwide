import type { Metadata } from "next";
import { auth } from "@/auth";
import Sidebar from "@/app/components/navigation/Sidebar";
import { ToastContainer, Slide } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "MANAGER - Worldwide Remote",
  description: "Get worldwide remote jobs",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (session === null || session.user?.role === "USER") {
    notFound();
  }

  return (
    <div className="w-full flex">
      <ToastContainer
        position="bottom-right"
        stacked={true}
        autoClose={4000}
        hideProgressBar={true}
        newestOnTop={true}
        closeOnClick
        pauseOnHover
        draggable
        theme="dark"
        transition={Slide}
      />
      <Sidebar />
      <div className="w-full max-w-[1580px] overflow-clip m-auto">{children}</div>
    </div>
  );
}
