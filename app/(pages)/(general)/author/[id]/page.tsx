import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Globe, Instagram, Linkedin, Twitter } from "lucide-react";
import { getAuthorProfile } from "@/app/lib/blog/data";
import { absoluteUrl, publisherNode, SITE_NAME, SITE_URL } from "@/app/lib/seo";
import PostGrid from "@/app/components/blog/PostGrid";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const author = await getAuthorProfile((await params).id);
  if (!author) return { title: "Author not found", robots: { index: false } };
  const count = author._count.blogs;
  const title = `${author.name} — ${SITE_NAME}`;
  const description = author.about ? `${author.about.slice(0, 155)}${author.about.length > 155 ? "…" : ""}` : `${count} ${count === 1 ? "post" : "posts"} by ${author.name} on remote work and careers.`;
  const url = absoluteUrl(`/author/${author.slug}`);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "profile", title, description, url, siteName: SITE_NAME, images: [{ url: author.profileImage, width: 1200, height: 630, alt: author.name }] },
    twitter: { card: "summary", title, description, images: [author.profileImage] },
  };
}

const Page = async ({ params }: Params) => {
  const author = await getAuthorProfile((await params).id);
  if (!author) notFound();

  const socials = [
    { href: author.website, icon: Globe, label: "Website" },
    { href: author.linkedin, icon: Linkedin, label: "LinkedIn" },
    { href: author.twitter, icon: Twitter, label: "X" },
    { href: author.instagram, icon: Instagram, label: "Instagram" },
  ].filter((s) => s.href);
  const count = author._count.blogs;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: absoluteUrl(`/author/${author.slug}`),
    isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
    mainEntity: {
      "@type": "Person",
      name: author.name,
      description: author.about,
      image: author.profileImage,
      url: absoluteUrl(`/author/${author.slug}`),
      sameAs: socials.map((s) => s.href),
      worksFor: publisherNode,
    },
  };

  return (
    <div className="min-h-screen bg-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header
        className="relative overflow-hidden border-b-2 border-primary bg-primary2"
        style={{ backgroundImage: "radial-gradient(#222325 0.9px, transparent 0.9px)", backgroundSize: "22px 22px" }}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#f9f8f1_40%,_rgba(249,248,241,0.55)_75%,_rgba(249,248,241,0.2)_100%)]" />
        <div className="relative mx-auto max-w-[1120px] px-4 pb-12 pt-10 md:pb-16 md:pt-14">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-primary/55">
            <Link href="/blogs" className="hover:text-primary">
              Blog
            </Link>
            <span aria-hidden>/</span>
            <span className="text-primary">Author</span>
          </nav>
          <div className="mt-6 flex flex-col items-start gap-6 md:flex-row md:items-center md:gap-10">
            <span className="relative h-32 w-32 flex-none overflow-hidden rounded-full border-[3px] border-primary bg-white shadow-[6px_6px_0_0_#e1f073] md:h-40 md:w-40">
              <Image src={author.profileImage} alt={author.name} fill priority sizes="160px" className="object-cover" />
            </span>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border-2 border-primary bg-secondary px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary shadow-[3px_3px_0_0_#222325]">
                {count} {count === 1 ? "post" : "posts"}
              </span>
              <h1 className="mt-4 text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.025em] text-primary md:text-[3.25rem]">{author.name}</h1>
              {author.about && <p className="mt-4 max-w-[64ch] text-base leading-relaxed text-primary/70 md:text-lg">{author.about}</p>}
              {socials.length > 0 && (
                <ul className="mt-5 flex flex-wrap gap-2" aria-label="Links">
                  {socials.map((s) => (
                    <li key={s.label}>
                      <a
                        href={s.href!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-2 rounded-sm border-2 border-primary bg-white px-3 text-xs font-bold text-primary transition-all drop-shadow-primary2-hover hover:bg-secondary">
                        <s.icon className="h-3.5 w-3.5" />
                        {s.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1120px] px-4 py-10 md:py-14" aria-label={`Posts by ${author.name}`}>
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-extrabold tracking-tight text-primary md:text-3xl">Posts by {author.name.split(" ")[0]}</h2>
          <Link href="/blogs" className="text-sm font-bold text-primary underline decoration-2 underline-offset-2 hover:decoration-[#6c7a1e]">
            All posts
          </Link>
        </div>
        {author.blogs.length > 0 ? (
          <PostGrid posts={author.blogs} />
        ) : (
          <div className="mt-8 rounded-[20px] border-2 border-dashed border-primary/20 p-12 text-center">
            <p className="text-lg font-bold text-primary">Nothing published yet.</p>
            <p className="mt-1 text-sm text-primary/60">Check back soon.</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Page;
