import type { FC, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import NoImage from "./NoImage";
import type { BlogCategory } from "@/app/lib/blog/categories";
import type { RenderedPost } from "@/app/lib/blog/render";
import type { AuthorProfile, BlogStatus, Cta, LeadMagnet, PostCard as PostCardData } from "@/app/lib/blog/types";
import { absoluteUrl, jsonLd as serializeJsonLd, publisherNode, SITE_URL } from "@/app/lib/seo";
import AuthorCard from "./AuthorCard";
import AuthorStack from "./AuthorStack";
import CtaCard, { ctaHref } from "./CtaCard";
import LeadMagnetCard from "./LeadMagnetCard";
import PostBody from "./PostBody";
import ArticleDiscovery from "./ArticleDiscovery";
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

// A ~720px text column plus the rail, centred together. Header and body share it
// so the title lines up with the text.
const GRID =
  SIDEBAR_SIDE === "right"
    ? "mx-auto w-full max-w-[720px] lg:grid lg:max-w-none lg:grid-cols-[minmax(0,720px)_260px] lg:justify-center lg:gap-10 xl:grid-cols-[minmax(0,720px)_310px] xl:gap-16"
    : "mx-auto w-full max-w-[720px] lg:grid lg:max-w-none lg:grid-cols-[260px_minmax(0,720px)] lg:justify-center lg:gap-10 xl:grid-cols-[380px_minmax(0,720px)] xl:gap-16";
const TEXT_COLUMN = SIDEBAR_SIDE === "left" ? "lg:col-start-2 lg:row-start-1" : undefined;

const Article: FC<ArticleProps> = ({ data, rendered, toolbar, jsonLd }) => {
  const { post, category, leadMagnet, cta, magnets, ctas, related } = data;
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
          headline: post.title.replace(/\s+/g, " ").trim().slice(0, 110),
          description: post.description,
          // An empty url is invalid markup; with no cover the post simply names no image.
          ...(post.coverImage ? { image: { "@type": "ImageObject", url: post.coverImage } } : {}),
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
            ...(category
              ? [{ "@type": "ListItem", position: 2, name: category.name, item: absoluteUrl(`/blogs/category/${category.slug}`) }]
              : []),
            { "@type": "ListItem", position: category ? 3 : 2, name: post.title, item: url },
          ],
        },
      ]
    : null;

  return (
    <div className="min-h-screen bg-white">
      {structured && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(structured) }}
        />
      )}
      {toolbar}

      <header className="border-b-2 border-primary/10 bg-primary2 min-[1500px]:rounded-b-md">
        <div className="px-5 py-9 md:px-6 md:py-12">
          <div className={GRID}>
            <div className={cn("min-w-0", TEXT_COLUMN)}>
              <nav
                aria-label="Breadcrumb"
                className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary/55">
                <Link
                  href="/blogs"
                  className="hover:text-primary">
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
              <h1 className="mt-5 text-[1.875rem] font-bold leading-[1.2] tracking-[-0.02em] text-primary md:text-[2.25rem] lg:text-[2.5rem]">
                {post.title}
              </h1>
              <p className="mt-5 text-[17px] leading-[1.7] text-primary/65 md:text-lg">{post.description}</p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-4">
                <AuthorStack
                  authors={post.authors}
                  size="md"
                  meta={`${formatPostDate(published)} · ${rendered.readingMinutes} min read`}
                />
                <ShareRow
                  url={url}
                  title={post.title}
                  className="sm:ml-auto"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="px-5 py-9 md:px-6 md:py-12">
        <div className={GRID}>
          <main className={cn("min-w-0", TEXT_COLUMN)}>
            <figure className="relative mb-9 aspect-[3/2] overflow-hidden rounded-[20px] border-2 border-primary md:mb-12">
              {post.coverImage ? (
                <Image
                  src={post.coverImage}
                  alt={post.title}
                  fill
                  priority
                  sizes="(min-width: 768px) 720px, 100vw"
                  className="object-cover"
                />
              ) : (
                <NoImage className="absolute inset-0" />
              )}
            </figure>

            {rendered.toc.length >= 2 && (
              <details className="mb-9 rounded-xl border border-primary/15 bg-primary2 px-5 lg:hidden">
                <summary className="cursor-pointer py-4 text-sm font-bold text-primary">Jump to a section</summary>
                <TableOfContents entries={rendered.toc} className="pb-5 pt-2" />
              </details>
            )}

            <PostBody
              segments={rendered.segments}
              blogSlug={post.slug}
              leadMagnet={leadMagnet}
              magnetsBySlug={magnetsBySlug}
              cta={cta}
              ctasByKey={ctasByKey}
              nextStep={nextStep}
            />

            {jsonLd && post.status === "PUBLISHED" && <ArticleDiscovery post={post} />}

            {cta && (
              <CtaCard
                cta={cta}
                variant="end"
                placement="end"
                blogSlug={post.slug}
              />
            )}

            {post.tags.length > 0 && (
              <ul
                className="mt-8 flex flex-wrap gap-2"
                aria-label="Tags">
                {post.tags.map((tag) => (
                  <li
                    key={tag}
                    className="rounded-full border border-primary/15 bg-white px-3 py-1 text-xs font-semibold text-primary/70">
                    {tag}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t-2 border-primary/10 pt-6">
              <p className="text-sm text-primary/55">Found this useful? Pass it on.</p>
              <ShareRow
                url={url}
                title={post.title}
              />
            </div>

            {publisher && (
              <AuthorCard
                author={publisher}
                className="mt-8"
              />
            )}
            {coauthors.map((a) => (
              <AuthorCard
                key={a.slug}
                author={a}
                label="Co-written by"
                className="mt-4"
              />
            ))}
          </main>

          {/* Scrolls on its own when taller than the screen, so the download form stays reachable; the small
              padding keeps the cards' 2px shadows from being clipped. */}
          <aside
            className={cn(
              "mt-12 scrollbar-none lg:sticky lg:top-24 lg:mt-0 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pb-1 lg:pr-1",
              SIDEBAR_SIDE === "left" && "lg:col-start-1 lg:row-start-1",
            )}
            aria-label="Sidebar">
            <TableOfContents
              entries={rendered.toc}
              className="mb-8 hidden max-h-[min(45vh,420px)] overflow-y-auto scrollbar-neo pr-3 lg:block"
            />
            {leadMagnet && (
              <LeadMagnetCard
                magnet={leadMagnet}
                variant="sidebar"
                placement="sidebar"
                blogSlug={post.slug}
                nextStep={nextStep}
              />
            )}
          </aside>
        </div>

        {related.length > 0 && (
          <section
            className="mx-auto mt-12 border-t-2 border-primary/10 pt-10 lg:max-w-[1020px] xl:max-w-[1164px]"
            aria-label="Keep reading">
            <div className="flex items-end justify-between gap-4">
              <h2 className="text-2xl font-extrabold tracking-tight text-primary md:text-3xl">Keep reading</h2>
              <Link
                href={category ? `/blogs/category/${category.slug}` : "/blogs"}
                className="text-sm font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
                {category ? `More in ${category.name}` : "All posts"}
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <PostCard
                  key={p.slug}
                  post={p}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default Article;
