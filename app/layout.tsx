import type { Metadata } from "next";
import "./globals.css";
import "react-quill/dist/quill.snow.css";
import "react-quill/dist/quill.bubble.css";
import { Manrope } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { SessionProvider } from "next-auth/react";
import { ToastContainer, Slide } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const font = Manrope({
  subsets: ["latin-ext"],
  weight: ["200", "300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "Remote Worldwide",
  description: "Get worldwide remote jobs and get hired in no time!",
  icons: "/favicon.ico",
  metadataBase: new URL("https://remoteworldwide.net"),
  openGraph: {
    url: "https://remoteworldwide.net",
    title: "Remote Worldwide",
    description: "Get worldwide remote jobs and get hired in no time!",
    images: [`${process.env.NEXT_PUBLIC_SITE_URL}/api/og/job`],
  },
  twitter: {
    card: "summary_large_image",
    title: "Remote Worldwide",
    description: "Get worldwide remote jobs and get hired in no time!",
    // creator: '@remoteworldwide',
    images: [`${process.env.NEXT_PUBLIC_SITE_URL}/api/og/job`],
  },
  keywords: ["job", "remote", "remote work", "remote worldwide", "work", "remote jobs", "tech jobs", "worldwide jobs"],
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
        <ToastContainer
          className={"z-50"}
          position="bottom-right"
          toastClassName={"!bg-primary"}
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
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
