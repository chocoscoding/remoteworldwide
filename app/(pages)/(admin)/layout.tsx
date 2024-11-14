import type { Metadata } from "next";

import Sidebar from "@/app/components/navigation/Sidebar";
import { ToastContainer, Slide } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
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
