import type { Metadata } from "next";
import Link from "next/link";
import { permanentRedirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BLOG_CATEGORIES, categoryBySlug } from "@/app/lib/blog/categories";
import { getCategoriesWithCounts, getFeaturedPosts, getOffers, getPublishedPosts } from "@/app/lib/blog/data";
import { absoluteUrl, SITE_NAME, SITE_URL, publisherNode } from "@/app/lib/seo";
import CategoryNav from "@/app/components/blog/CategoryNav";
import CtaCard from "@/app/components/blog/CtaCard";
import PostCard from "@/app/components/blog/PostCard";
import PostGrid, { BlogPagination } from "@/app/components/blog/PostGrid";

type Search = { searchParams: Promise<{ category?: string; page?: string }> };

const TITLE = `${SITE_NAME} Blog — Get hired remotely, faster`;
const DESCRIPTION = "Practical guides on resumes, interviews and the remote job search, written by people who hire remotely.";

export async function generateMetadata({ searchParams }: Search): Promise<Metadata> {
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: absoluteUrl("/blogs") },
    robots: page > 1 ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      title: TITLE,
      description: DESCRIPTION,
      url: absoluteUrl("/blogs"),
      images: [absoluteUrl("/api/og/blog")],
    },
    twitter: {
      card: "summary_large_image",
      title: TITLE,
      description: DESCRIPTION,
    },
  };
}

const BlogIndex = async ({ searchParams }: Search) => {
  const { category: categoryParam, page: pageParam } = await searchParams;

  if (categoryParam) {
    const known = categoryBySlug(categoryParam);
    permanentRedirect(known ? `/blogs/category/${known.slug}` : "/blogs");
  }

  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const landing = page === 1;

  const [offers, categories, list, featured] = await Promise.all([
    getOffers(),
    getCategoriesWithCounts(),
    getPublishedPosts({ page }),
    landing ? getFeaturedPosts(4) : Promise.resolve([]),
  ]);

  const bandCta = offers.cta;
  const featuredSlugs = new Set(featured.map((p) => p.slug));
  const latest = landing ? list.posts.filter((p) => !featuredSlugs.has(p.slug)) : list.posts;
  const [lead, ...picks] = featured;
  const hrefFor = (n: number) => (n > 1 ? `/blogs?page=${n}` : "/blogs");

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: TITLE,
      description: DESCRIPTION,
      url: absoluteUrl("/blogs"),
      isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
      publisher: publisherNode,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: [...featured, ...latest].slice(0, 12).map((p, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: absoluteUrl(`/blogs/${p.slug}`),
          name: p.title,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Blog",
          item: absoluteUrl("/blogs"),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header
        className="relative w-full overflow-hidden border-b-2 border-primary bg-primary2"
        style={{
          backgroundImage: "radial-gradient(#222325 0.9px, transparent 0.9px)",
          backgroundSize: "22px 22px",
        }}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#f9f8f1_35%,_rgba(249,248,241,0.6)_70%,_rgba(249,248,241,0.2)_100%)]" />
        <div className="relative mx-auto flex max-w-[1440px] flex-col items-center px-4 pb-14 pt-14 text-center md:pb-20 md:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border-2 border-primary bg-secondary px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary shadow-[3px_3px_0_0_#222325]">
            <span aria-hidden className="font-black">{"///"}</span>
            Free career playbooks
          </span>
          <h1 className="mt-6 max-w-[14ch] text-[2.5rem] font-extrabold leading-[1.02] tracking-[-0.025em] text-primary md:text-[3.75rem] lg:text-[4.5rem]">
            Get hired remotely,{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span aria-hidden className="absolute inset-x-[-0.08em] bottom-[0.08em] top-[0.55em] -z-0 -rotate-1 rounded-sm bg-secondary" />
              <span className="relative">faster.</span>
            </span>
          </h1>
          <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-primary/70 md:text-xl">
            Practical guides on resumes, interviews and the remote job search — written by people who actually hire, built around the tools that get you the
            offer.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#latest"
              className="drop-shadow-primary2-hover inline-flex h-11 items-center gap-2 rounded-sm border-2 border-primary bg-primary px-5 text-sm font-bold text-white transition-all">
              Start reading
              <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/jobs"
              className="drop-shadow-primary2-hover inline-flex h-11 items-center gap-2 rounded-sm border-2 border-primary bg-white px-5 text-sm font-bold text-primary transition-all hover:bg-secondary">
              This week&apos;s vetted remote jobs
            </Link>
          </div>
        </div>
      </header>

      <div
        id="latest"
        className={cn(
          "mx-auto max-w-[1440px] px-4 py-10 md:py-14 scroll-mt-4",
          bandCta && "lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-16",
        )}>
        <main className="min-w-0">
          <CategoryNav categories={categories} active={null} />

          {landing && lead && (
            <section className="mt-10" aria-label="Start here">
              <PostCard post={lead} variant="feature" />
              {picks.length > 0 && (
                <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {picks.map((p) => (
                    <PostCard key={p.slug} post={p} />
                  ))}
                </div>
              )}
            </section>
          )}

          {(latest.length > 0 || !landing || list.total === 0) && (
            <section className={landing ? "mt-16" : "mt-12"} aria-label="Latest posts">
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-2xl font-extrabold tracking-tight text-primary md:text-3xl">Latest</h2>
                <p className="text-sm text-primary/55">
                  {list.total} {list.total === 1 ? "post" : "posts"}
                </p>
              </div>
              {latest.length === 0 ? (
                <div className="mt-8 rounded-[20px] border-2 border-dashed border-primary/20 p-12 text-center">
                  <p className="text-lg font-bold text-primary">Nothing here yet.</p>
                  <p className="mt-1 text-sm text-primary/60">The first guides are being written.</p>
                </div>
              ) : (
                <PostGrid posts={latest} />
              )}
            </section>
          )}

          <BlogPagination page={page} totalPages={list.totalPages} hrefFor={hrefFor} />

          {landing && (
            <section
              className="mt-16 rounded-[24px] border-2 border-primary bg-primary p-8 text-white shadow-[6px_6px_0_0_#e1f073] md:p-12"
              aria-label="Explore by topic">
              <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">Pick a topic, get the playbook.</h2>
              <p className="mt-2 max-w-[56ch] text-white/70">Every category has its own free download at the top of the page.</p>
              <ul className="mt-6 flex flex-wrap gap-2.5">
                {BLOG_CATEGORIES.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/blogs/category/${c.slug}`}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-white/25 px-4 py-2 text-sm font-bold text-white transition-colors hover:border-secondary hover:text-secondary">
                      {c.name}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </main>

        {bandCta && (
          <aside className="mt-12 lg:mt-0">
            <div className="lg:sticky lg:top-24">
              <CtaCard cta={bandCta} variant="side" placement="index-band" />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

export default BlogIndex;
