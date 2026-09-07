import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { listConversions } from "@/libs/blog-admin";
import { categoryBySlug } from "@/app/lib/blog/categories";
import { ActiveToggle } from "@/app/components/ADMIN/blog/OfferSwitch";

export const dynamic = "force-dynamic";

const KIND_BADGE = {
  cta: "bg-[#e1f073] text-[#222325]",
  magnet: "bg-[#222325] text-[#e1f073]",
} as const;

const Page = async () => {
  const { magnets, ctas } = await listConversions();
  const rows = [
    ...ctas.map((c) => ({
      kind: "cta" as const,
      id: c.id,
      name: c.name,
      token: `[[cta:${c.key}]]`,
      detail: c.headline,
      targets: c.targetCategories.map((s) => categoryBySlug(s)?.name ?? s),
      tags: c.targetTags,
      stat: `${c.clicks} click${c.clicks === 1 ? "" : "s"}`,
      active: c.active,
      createdAt: c.createdAt,
      href: `/heroshima/conversions/cta/${c.id}/edit`,
    })),
    ...magnets.map((m) => ({
      kind: "magnet" as const,
      id: m.id,
      name: m.title,
      token: `[[magnet:${m.slug}]]`,
      detail: m.fileName,
      targets: m.targetCategories.map((s) => categoryBySlug(s)?.name ?? s),
      tags: m.targetTags,
      stat: `${m.claims} claim${m.claims === 1 ? "" : "s"} · ${m.downloads} unique`,
      active: m.active,
      createdAt: m.createdAt,
      href: `/heroshima/conversions/lead-magnet/${m.id}/edit`,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="w-full min-h-screen p-4">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Conversions</h1>
          <p className="text-sm text-gray-500">
            Calls-to-action and lead magnets. Posts pick from these — by category and tags, or set per post. Switch one off and it disappears everywhere.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/heroshima/conversions/new" className="flex items-center p-2 bg-primary text-white outline outline-2 outline-primary font-bold rounded-md drop-shadow-primary2-hover transition-all">
            <PlusCircle className="w-5 h-5 mr-2" />
            New conversion
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 p-10 text-center text-gray-500">Nothing yet. Create the first conversion — the blog shows no offers until you do.</div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="p-3">Type</th>
                <th className="p-3">Name</th>
                <th className="p-3">Targets</th>
                <th className="p-3">Performance</th>
                <th className="p-3">On / off</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.id}`} className={`border-t ${r.active ? "" : "bg-gray-50/60 text-gray-500"}`}>
                  <td className="p-3">
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${KIND_BADGE[r.kind]}`}>{r.kind === "cta" ? "CTA" : "Lead magnet"}</span>
                  </td>
                  <td className="p-3">
                    <Link href={r.href} className="font-semibold text-primary hover:underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-gray-500">
                      {r.token} · {r.detail}
                    </div>
                  </td>
                  <td className="p-3 text-xs text-gray-600">
                    {r.targets.join(", ") || "General"}
                    {r.tags.length > 0 && <div className="text-gray-400">tags: {r.tags.join(", ")}</div>}
                  </td>
                  <td className="p-3 text-xs tabular-nums text-gray-600">{r.stat}</td>
                  <td className="p-3">
                    <ActiveToggle kind={r.kind} id={r.id} initial={r.active} name={r.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Page;
