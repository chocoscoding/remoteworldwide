import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cn } from "@/lib/utils";
import { getPostByPreviousSlug, getPostPageData } from "@/app/lib/blog/data";
import { renderPost } from "@/app/lib/blog/render";
import { effectiveInlineOffers, offerMarker } from "@/app/lib/blog/offers";
import AuthorCard from "@/app/components/blog/AuthorCard";
import CtaCard, { ctaHref } from "@/app/components/blog/CtaCard";
import LeadMagnetCard from "@/app/components/blog/LeadMagnetCard";
import PostBody from "@/app/components/blog/PostBody";
import PostCard, { formatPostDate } from "@/app/components/blog/PostCard";
import ShareRow from "@/app/components/blog/ShareRow";
import TableOfContents from "@/app/components/blog/TableOfContents";
import { absoluteUrl, blogOgImage, publisherNode, SITE_NAME, SITE_URL } from "@/app/lib/seo";

const SIDEBAR_SIDE = "right" as "left" | "right";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = decodeURIComponent((await params).id);
  const data = await getPostPageData(slug);
  if (!data) {
    return {
      title: "Post not found",
      description: "The post you are looking for does not exist.",
      robots: { index: false },
    };
  }
  const { post } = data;
  if (post.status !== "PUBLISHED") {
    return { title: `${post.title} (draft)`, description: post.description, robots: { index: false, follow: false } };
  }
  const url = absoluteUrl(`/blogs/${post.slug}`);
  const ogImage = blogOgImage({ title: post.title, author: post.author.name, description: post.description, image: post.coverImage });
  return {
    title: post.title,
    description: post.description,
    keywords: post.tags,
    authors: [{ name: post.author.name, url: absoluteUrl(`/author/${post.author.slug}`) }],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title: post.title,
      description: post.description,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
      publishedTime: (post.publishedAt ?? post.createdAt).toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.author.name],
      tags: post.tags,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: [ogImage] },
  };
}

const Page = async ({ params }: Params) => {
  const slug = decodeURIComponent((await params).id);
  const data = await getPostPageData(slug);
  if (!data) {
    const renamed = await getPostByPreviousSlug(slug);
    if (renamed) permanentRedirect(`/blogs/${renamed.slug}`);
    notFound();
  }

  const { post, category, leadMagnet, cta, magnets, ctas, featured, related } = data;
  const magnetsBySlug = Object.fromEntries(magnets.map((m) => [m.slug, m]));
  const ctasByKey = Object.fromEntries(ctas.map((c) => [c.key, c]));
  const offers = effectiveInlineOffers(post).filter((o) =>
    o.kind === "cta" ? (o.ref === "auto" ? Boolean(cta) : o.ref in ctasByKey) : o.ref === "auto" ? Boolean(leadMagnet) : o.ref in magnetsBySlug,
  );
  const rendered = renderPost(post.content, { offers: offers.map(offerMarker) });
  const url = absoluteUrl(`/blogs/${post.slug}`);
  const published = post.publishedAt ?? post.createdAt;
  const nextStep = cta ? { label: cta.buttonLabel, href: ctaHref(cta.key, "magnet-next", post.slug) } : undefined;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title.slice(0, 110),
      description: post.description,
      image: { "@type": "ImageObject", url: post.coverImage },
      datePublished: published.toISOString(),
      dateModified: post.updatedAt.toISOString(),
      author: { "@type": "Person", name: post.author.name, url: absoluteUrl(`/author/${post.author.slug}`) },
      publisher: publisherNode,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
      url,
      wordCount: rendered.words,
      timeRequired: `PT${rendered.readingMinutes}M`,
      articleSection: category?.name ?? "Blog",
      keywords: post.tags.join(", "),
      inLanguage: "en",
      isAccessibleForFree: true,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: absoluteUrl("/blogs") },
        ...(category
          ? [{ "@type": "ListItem", position: 2, name: category.name, item: absoluteUrl(`/blogs/category/${category.slug}`) }]
          : []),
        { "@type": "ListItem", position: category ? 3 : 2, name: post.title, item: url },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b-2 border-primary/10 bg-primary2 min-[1500px]:rounded-b-md">
        <div className="mx-auto max-w-[1440px] px-4 pb-7 pt-7 md:pb-9 md:pt-9">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary/55">
            <Link href="/blogs" className="hover:text-primary">
              Blog
            </Link>
            {category && (
              <>
                <span aria-hidden>/</span>
                <Link
                  href={`/blogs/category/${category.slug}`}
                  className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-primary hover:bg-secondary2">
                  {category.name}
                </Link>
              </>
            )}
            {post.status !== "PUBLISHED" && (
              <span className="rounded-full bg-[#fdeae6] px-2.5 py-1 text-[11px] text-[#b23c26]">Draft preview</span>
            )}
          </nav>
          <h1 className="mt-3 max-w-[28ch] text-[1.875rem] font-extrabold leading-[1.12] tracking-[-0.02em] text-primary md:text-[2.375rem] lg:text-[2.75rem]">
            {post.title}
          </h1>
          <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-primary/70 md:text-lg">{post.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href={`/author/${post.author.slug}`} className="group flex items-center gap-2.5">
              <span className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-primary">
                <Image src={post.author.profileImage} alt="" fill sizes="40px" className="object-cover" />
              </span>
              <span className="text-sm">
                <span className="block font-bold text-primary group-hover:underline">{post.author.name}</span>
                <span className="block text-primary/55">
                  {formatPostDate(published)} · {rendered.readingMinutes} min read
                </span>
              </span>
            </Link>
            <ShareRow url={url} title={post.title} className="sm:ml-auto" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-8 md:py-10">
        <div
          className={cn(
            "lg:grid lg:gap-12 xl:gap-14",
            SIDEBAR_SIDE === "right"
              ? "lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_352px]"
              : "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[352px_minmax(0,1fr)]",
          )}>
          <main className={cn("min-w-0", SIDEBAR_SIDE === "left" && "lg:col-start-2 lg:row-start-1")}>
            <figure className="relative mb-7 aspect-[3/2] overflow-hidden rounded-[20px] border-2 border-primary">
              <Image
                src={post.coverImage}
                alt={post.title}
                fill
                priority
                sizes="(min-width: 1024px) 660px, 100vw"
                className="object-cover"
              />
            </figure>

            <TableOfContents entries={rendered.toc} className="mb-9 min-[1220px]:hidden" />

            <PostBody
              segments={rendered.segments}
              blogSlug={post.slug}
              leadMagnet={leadMagnet}
              magnetsBySlug={magnetsBySlug}
              cta={cta}
              ctasByKey={ctasByKey}
              nextStep={nextStep}
            />

            {cta && <CtaCard cta={cta} variant="end" placement="end" blogSlug={post.slug} />}

            {post.tags.length > 0 && (
              <ul className="mt-10 flex flex-wrap gap-2" aria-label="Tags">
                {post.tags.map((tag) => (
                  <li key={tag} className="rounded-full border border-primary/15 bg-white px-3 py-1 text-xs font-semibold text-primary/70">
                    {tag}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t-2 border-primary/10 pt-6">
              <p className="text-sm text-primary/55">Found this useful? Pass it on.</p>
              <ShareRow url={url} title={post.title} />
            </div>

            <AuthorCard author={post.author} className="mt-10" />
          </main>

          <aside
            className={cn("mt-12 lg:mt-0 lg:sticky lg:top-24 lg:self-start", SIDEBAR_SIDE === "left" && "lg:col-start-1 lg:row-start-1")}
            aria-label="Sidebar">
            <TableOfContents
              entries={rendered.toc}
              className="mb-6 hidden max-h-[min(46vh,420px)] overflow-y-auto scrollbar-neo pr-1 min-[1220px]:block"
            />
            {leadMagnet && (
              <LeadMagnetCard magnet={leadMagnet} variant="sidebar" placement="sidebar" blogSlug={post.slug} nextStep={nextStep} />
            )}
            {featured.length > 0 && (
              <section className="mt-6 rounded-[20px] border-2 border-primary bg-primary2 p-4" aria-label="Start here">
                <p className="px-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary/60">Start here</p>
                <ul className="mt-2">
                  {featured.map((p) => (
                    <li key={p.slug}>
                      <PostCard post={p} variant="compact" />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-16 border-t-2 border-primary/10 pt-12" aria-label="Keep reading">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-extrabold tracking-tight text-primary md:text-3xl">Keep reading</h2>
              <Link
                href={category ? `/blogs/category/${category.slug}` : "/blogs"}
                className="text-sm font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
                {category ? `More in ${category.name}` : "All posts"}
              </Link>
            </div>
            <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Page;
