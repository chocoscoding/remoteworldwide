import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { BLOG_CATEGORIES, categoryBySlug } from "@/app/lib/blog/categories";
import { getCategoriesWithCounts, getOffers, getPublishedPosts } from "@/app/lib/blog/data";
import { absoluteUrl, SITE_NAME, SITE_URL, publisherNode } from "@/app/lib/seo";
import CategoryNav from "@/app/components/blog/CategoryNav";
import CtaCard from "@/app/components/blog/CtaCard";
import LeadMagnetCard from "@/app/components/blog/LeadMagnetCard";
import PostGrid, { BlogPagination } from "@/app/components/blog/PostGrid";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export function generateStaticParams() {
  return BLOG_CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const category = categoryBySlug((await params).slug);
  if (!category) return { title: "Category not found", robots: { index: false } };
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const title = `${category.name} — ${SITE_NAME} Blog`;
  const description = `${category.tagline} Practical ${category.name.toLowerCase()} guides for people applying to remote roles.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/blogs/category/${category.slug}`) },
    robots: page > 1 ? { index: false, follow: true } : undefined,
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(`/blogs/category/${category.slug}`),
      images: [absoluteUrl("/api/og/blog")],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

const CategoryPage = async ({ params, searchParams }: Props) => {
  const category = categoryBySlug((await params).slug);
  if (!category) notFound();

  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const [offers, categories, list] = await Promise.all([getOffers(category.slug), getCategoriesWithCounts(), getPublishedPosts({ page, category: category.slug })]);
  const magnet = offers.leadMagnet;
  const cta = offers.cta;
  const hrefFor = (n: number) => (n > 1 ? `/blogs/category/${category.slug}?page=${n}` : `/blogs/category/${category.slug}`);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${category.name} — ${SITE_NAME} Blog`,
      description: category.tagline,
      url: absoluteUrl(`/blogs/category/${category.slug}`),
      isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
      publisher: publisherNode,
      mainEntity: {
        "@type": "ItemList",
        itemListElement: list.posts.map((p, i) => ({
          "@type": "ListItem",
          position: (page - 1) * list.pageSize + i + 1,
          url: absoluteUrl(`/blogs/${p.slug}`),
          name: p.title,
        })),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: absoluteUrl("/blogs") },
        { "@type": "ListItem", position: 2, name: category.name, item: absoluteUrl(`/blogs/category/${category.slug}`) },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="border-b-2 border-primary/10 bg-primary2">
        <div className="mx-auto grid max-w-[1120px] gap-10 px-4 pb-12 pt-12 md:pt-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center lg:gap-14">
          <div>
            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary/55">
              <Link href="/blogs" className="hover:text-primary">
                Blog
              </Link>
              <span aria-hidden>/</span>
              <span className="text-primary">{category.name}</span>
            </nav>
            <h1 className="mt-4 max-w-[16ch] text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.02em] text-primary md:text-[3.25rem]">{category.name}</h1>
            <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-primary/70">{category.tagline}</p>
            <Link href="/jobs" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
              Or browse this week&apos;s vetted remote jobs
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {magnet && <LeadMagnetCard magnet={magnet} variant="hero" placement="category" nextStep={cta ? { label: cta.buttonLabel, href: `/go/${cta.key}?s=magnet-next` } : undefined} />}
        </div>
      </section>

      <div className="mx-auto max-w-[1120px] px-4 py-10 md:py-14">
        <CategoryNav categories={categories} active={category.slug} />

        <section className="mt-10" aria-label={`Posts in ${category.name}`}>
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-2xl font-extrabold tracking-tight text-primary md:text-3xl">Every {category.name.toLowerCase()} guide</h2>
            <p className="text-sm text-primary/55">
              {list.total} {list.total === 1 ? "post" : "posts"}
            </p>
          </div>
          {list.posts.length === 0 ? (
            <div className="mt-8 rounded-[20px] border-2 border-dashed border-primary/20 p-12 text-center">
              <p className="text-lg font-bold text-primary">Nothing here yet.</p>
              <p className="mt-1 text-sm text-primary/60">
                This category is still being written.{" "}
                <Link href="/blogs" className="font-bold underline decoration-2 underline-offset-2">
                  See all posts
                </Link>
              </p>
            </div>
          ) : (
            <>
              <PostGrid posts={list.posts} />
              <BlogPagination page={page} totalPages={list.totalPages} hrefFor={hrefFor} />
            </>
          )}
        </section>

        {cta && <CtaCard cta={cta} variant="band" placement="category-band" className="mt-14" />}
      </div>
    </div>
  );
};

export default CategoryPage;
