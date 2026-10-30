import { auth } from "@/auth";
import { myAuthor } from "@/libs/blog-admin";
import Sidebar from "@/app/components/navigation/Sidebar";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { sttLabAvailable } from "@/app/lib/stt-lab";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (session === null || session.user?.role === "USER") {
    notFound();
  }
  // Staff are locked for deletion like anyone else: the backend answers 423 on every admin route,
  // so the only useful screen is the one that says when the account goes.
  if (session.user?.deletionDueAt) redirect("/account-deletion");

  const me = await myAuthor().catch(() => null);

  return (
    // The window itself never scrolls: the sidebar is one screen tall and the page scrolls in its own
    // column, which takes what's left beside the sidebar (min-w-0, so wide content can't push it
    // past the screen's right edge).
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar hasAuthorProfile={me !== null} sttLab={sttLabAvailable((await headers()).get("host"))} />
      <div className="h-screen min-w-0 flex-1 max-w-[1680px] overflow-x-clip overflow-y-auto m-auto">{children}</div>
    </div>
  );
}
