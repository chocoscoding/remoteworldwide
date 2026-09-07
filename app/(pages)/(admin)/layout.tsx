import { auth } from "@/auth";
import { myAuthor } from "@/libs/blog-admin";
import Sidebar from "@/app/components/navigation/Sidebar";
import { notFound } from "next/navigation";
// TEMPORARY — bot keep-alive. Delete this import and the <BotKeepAlive /> below
// to remove; see the header of that file.
import BotKeepAlive from "@/app/components/ADMIN/BotKeepAlive";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (session === null || session.user?.role === "USER") {
    notFound();
  }

  const me = await myAuthor().catch(() => null);

  return (
    <div className="w-full flex">
      <BotKeepAlive />
      <Sidebar hasAuthorProfile={me !== null} />
      <div className="h-screen w-full max-w-[1580px] overflow-x-clip overflow-y-auto m-auto">{children}</div>
    </div>
  );
}
