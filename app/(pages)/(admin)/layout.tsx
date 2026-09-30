import { auth } from "@/auth";
import { myAuthor } from "@/libs/blog-admin";
import Sidebar from "@/app/components/navigation/Sidebar";
import { notFound, redirect } from "next/navigation";

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
    <div className="w-full flex">
      <Sidebar hasAuthorProfile={me !== null} />
      <div className="h-screen w-full max-w-[1580px] overflow-x-clip overflow-y-auto m-auto">{children}</div>
    </div>
  );
}
