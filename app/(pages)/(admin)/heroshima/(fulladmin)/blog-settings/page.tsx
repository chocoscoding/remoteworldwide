import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getBlogSettingsRow, listCtas, listLeadMagnets, listPicks, blogConversionStats } from "@/libs/blog-admin";
import BlogSettingsForm from "@/app/components/ADMIN/blog/BlogSettingsForm";
import FeaturedPicks from "@/app/components/ADMIN/blog/FeaturedPicks";

export const dynamic = "force-dynamic";

const Page = async () => {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") notFound();

  const [settings, magnets, ctas, stats, posts] = await Promise.all([getBlogSettingsRow(), listLeadMagnets(), listCtas(), blogConversionStats(), listPicks()]);

  return (
    <div className="w-full min-h-screen p-4 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Blog settings</h1>
        <p className="text-sm text-gray-500">Central control of what the blog asks readers to do.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Subscribers", value: stats.subscribers },
          { label: "Downloads claimed", value: stats.claims },
          { label: "Active lead magnets", value: stats.magnets.filter((m) => m.active).length },
          { label: "CTA clicks", value: stats.ctas.reduce((n, c) => n + c.clicks, 0) },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-white p-4 shadow">
            <p className="text-xs uppercase tracking-wide text-gray-500">{s.label}</p>
            <p className="text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <BlogSettingsForm initial={settings} magnets={magnets.map((m) => ({ slug: m.slug, title: m.title }))} ctas={ctas.map((c) => ({ key: c.key, name: c.name }))} />

      <FeaturedPicks posts={posts} />
    </div>
  );
};

export default Page;
