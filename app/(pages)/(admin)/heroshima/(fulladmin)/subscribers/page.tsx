import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { auth } from "@/auth";
import { listSubscribers } from "@/libs/blog-admin";

export const dynamic = "force-dynamic";

const Page = async ({ searchParams }: { searchParams: Promise<{ page?: string }> }) => {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") notFound();

  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const { rows, total, pageSize } = await listSubscribers(page);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="w-full min-h-screen p-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Subscribers</h1>
          <p className="text-sm text-gray-500">{total} emails captured through lead magnets. No provider is connected yet — export and import when one is.</p>
        </div>
        <a href="/api/subscribers/export" className="flex items-center p-2 bg-primary text-white outline outline-2 outline-primary font-bold rounded-md drop-shadow-primary2-hover transition-all">
          <Download className="w-5 h-5 mr-2" />
          Download CSV
        </a>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-10 text-center text-gray-500">No subscribers yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-3">Email</th>
                <th className="p-3">Captured by</th>
                <th className="p-3">Downloads</th>
                <th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="p-3 font-semibold">
                    {s.email}
                    {s.unsubscribedAt && <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs">unsubscribed</span>}
                  </td>
                  <td className="p-3 text-xs text-gray-600">
                    {s.source}
                    {s.firstBlogSlug && <div className="truncate text-gray-400 max-w-[260px]">{s.firstBlogSlug}</div>}
                  </td>
                  <td className="p-3 text-xs text-gray-600">{Array.from(new Set(s.claims.map((c) => c.leadMagnet.title))).join(", ") || "—"}</td>
                  <td className="p-3 text-xs text-gray-600">{s.createdAt.toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/heroshima/subscribers?page=${page - 1}`} className="underline">Previous</Link> : <span />}
          <span>
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? <Link href={`/heroshima/subscribers?page=${page + 1}`} className="underline">Next</Link> : <span />}
        </div>
      )}
    </div>
  );
};

export default Page;
