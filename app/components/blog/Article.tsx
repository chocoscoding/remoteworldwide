import type { FC, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BlogCategory } from "@/app/lib/blog/categories";
import type { RenderedPost } from "@/app/lib/blog/render";
import type { AuthorProfile, BlogStatus, Cta, LeadMagnet, PostCard as PostCardData } from "@/app/lib/blog/types";
import { absoluteUrl, publisherNode, SITE_URL } from "@/app/lib/seo";
import AuthorCard from "./AuthorCard";
import AuthorStack from "./AuthorStack";
import CtaCard, { ctaHref } from "./CtaCard";
import LeadMagnetCard from "./LeadMagnetCard";
import PostBody from "./PostBody";
import PostCard, { formatPostDate } from "./PostCard";
import ShareRow from "./ShareRow";
import TableOfContents from "./TableOfContents";

export interface ArticlePost {
  slug: string;
  title: string;
  description: string;
  coverImage: string;
  tags: string[];
  status: BlogStatus;
  createdAt: Date | string;
  updatedAt: Date | string;
  publishedAt: Date | string | null;
  authors: AuthorProfile[];
}

export interface ArticleData {
  post: ArticlePost;
  category: BlogCategory | null;
  leadMagnet: LeadMagnet | null;
  cta: Cta | null;
  magnets: LeadMagnet[];
  ctas: Cta[];
  featured: PostCardData[];
  related: PostCardData[];
}

export interface ArticleProps {
  data: ArticleData;
  rendered: RenderedPost;
  toolbar?: ReactNode;
  jsonLd?: boolean;
}

const SIDEBAR_SIDE = "right" as "left" | "right";

const Article: FC<ArticleProps> = ({ data, rendered, toolbar, jsonLd }) => {
  const { post, category, leadMagnet, cta, magnets, ctas, featured, related } = data;
  const magnetsBySlug = Object.fromEntries(magnets.map((m) => [m.slug, m]));
  const ctasByKey = Object.fromEntries(ctas.map((c) => [c.key, c]));
  const url = absoluteUrl(`/blogs/${post.slug}`);
  const published = new Date(post.publishedAt ?? post.createdAt);
  const nextStep = cta ? { label: cta.buttonLabel, href: ctaHref(cta.key, "magnet-next", post.slug) } : undefined;
  const [publisher, ...coauthors] = post.authors;

  const structured = jsonLd
    ? [
        {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title.slice(0, 110),
          description: post.description,
          image: { "@type": "ImageObject", url: post.coverImage },
          datePublished: published.toISOString(),
          dateModified: new Date(post.updatedAt).toISOString(),
          author: post.authors.map((a) => ({ "@type": "Person", name: a.name, url: absoluteUrl(`/author/${a.slug}`) })),
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
            ...(category ? [{ "@type": "ListItem", position: 2, name: category.name, item: absoluteUrl(`/blogs/category/${category.slug}`) }] : []),
            { "@type": "ListItem", position: category ? 3 : 2, name: post.title, item: url },
          ],
        },
      ]
    : null;

  return (
    <div className="min-h-screen bg-white">
      {structured && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured) }} />}
      {toolbar}

      <header className="border-b-2 border-primary/10 bg-primary2 min-[1500px]:rounded-b-md">
        <div className="mx-auto max-w-[1440px] px-4 pb-7 pt-7 md:pb-9 md:pt-9">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary/55">
            <Link href="/blogs" className="hover:text-primary">
              Blog
            </Link>
            {category && (
              <>
                <span aria-hidden>/</span>
                <Link href={`/blogs/category/${category.slug}`} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-primary hover:bg-secondary2">
                  {category.name}
                </Link>
              </>
            )}
            {post.status !== "PUBLISHED" && <span className="rounded-full bg-[#fdeae6] px-2.5 py-1 text-[11px] text-[#b23c26]">Draft preview</span>}
          </nav>
          <h1 className="mt-3 max-w-[28ch] text-[1.875rem] font-extrabold leading-[1.12] tracking-[-0.02em] text-primary md:text-[2.375rem] lg:text-[2.75rem]">{post.title}</h1>
          <p className="mt-3 max-w-[62ch] text-base leading-relaxed text-primary/70 md:text-lg">{post.description}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <AuthorStack authors={post.authors} size="md" meta={`${formatPostDate(published)} · ${rendered.readingMinutes} min read`} />
            <ShareRow url={url} title={post.title} className="sm:ml-auto" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-8 md:py-10">
        <div
          className={cn(
            "lg:grid lg:gap-12 xl:gap-14",
            SIDEBAR_SIDE === "right" ? "lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_352px]" : "lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[352px_minmax(0,1fr)]",
          )}>
          <main className={cn("min-w-0", SIDEBAR_SIDE === "left" && "lg:col-start-2 lg:row-start-1")}>
            <figure className="relative mb-7 aspect-[3/2] overflow-hidden rounded-[20px] border-2 border-primary">
              <Image src={post.coverImage} alt={post.title} fill priority sizes="(min-width: 1024px) 660px, 100vw" className="object-cover" />
            </figure>

            <TableOfContents entries={rendered.toc} className="mb-9 min-[1220px]:hidden" />

            <PostBody segments={rendered.segments} blogSlug={post.slug} leadMagnet={leadMagnet} magnetsBySlug={magnetsBySlug} cta={cta} ctasByKey={ctasByKey} nextStep={nextStep} />

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

            {publisher && <AuthorCard author={publisher} className="mt-10" />}
            {coauthors.map((a) => (
              <AuthorCard key={a.slug} author={a} label="Co-written by" className="mt-4" />
            ))}
          </main>

          <aside className={cn("mt-12 lg:mt-0 lg:sticky lg:top-24 lg:self-start", SIDEBAR_SIDE === "left" && "lg:col-start-1 lg:row-start-1")} aria-label="Sidebar">
            <TableOfContents entries={rendered.toc} className="mb-6 hidden max-h-[min(46vh,420px)] overflow-y-auto scrollbar-neo pr-1 min-[1220px]:block" />
            {leadMagnet && <LeadMagnetCard magnet={leadMagnet} variant="sidebar" placement="sidebar" blogSlug={post.slug} nextStep={nextStep} />}
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
              <Link href={category ? `/blogs/category/${category.slug}` : "/blogs"} className="text-sm font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
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

export default Article;
