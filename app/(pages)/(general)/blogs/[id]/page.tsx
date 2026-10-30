import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getPostByPreviousSlug, getPublishedPostPageData } from "@/app/lib/blog/data";
import { renderArticle } from "@/app/lib/blog/article";
import Article from "@/app/components/blog/Article";
import { absoluteUrl, blogOgImage, SITE_NAME } from "@/app/lib/seo";

type Params = { params: Promise<{ id: string }> };

// Cached: built on a post's first visit, then served from the cache until a blog change refreshes
// it (libs/query.ts, libs/blog-admin.ts) or an hour passes (BLOG_REVALIDATE_S; this has to be a
// literal). Published posts only, read without the visitor's session, so every reader gets the
// same page. Writers preview drafts in the admin's view (/heroshima/blogs/[slug]).
export const revalidate = 3600;
export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = decodeURIComponent((await params).id);
  const data = await getPublishedPostPageData(slug);
  if (!data) {
    return { title: "Post not found", description: "The post you are looking for does not exist.", robots: { index: false } };
  }
  const { post } = data;
  if (post.status !== "PUBLISHED") {
    return { title: `${post.title} (draft)`, description: post.description, robots: { index: false, follow: false } };
  }
  const url = absoluteUrl(`/blogs/${post.slug}`);
  // As typed in the editor: "Remote Work: Local vs Global " ended in a space, so the tab read "Global  | Remote Worldwide".
  const title = post.title.replace(/\s+/g, " ").trim();
  const ogImage = blogOgImage({ title, author: post.author.name, description: post.description, image: post.coverImage });
  return {
    title,
    description: post.description,
    keywords: post.tags,
    authors: post.authors.map((a) => ({ name: a.name, url: absoluteUrl(`/author/${a.slug}`) })),
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      title,
      description: post.description,
      url,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      publishedTime: (post.publishedAt ?? post.createdAt).toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: post.authors.map((a) => a.name),
      tags: post.tags,
    },
    twitter: { card: "summary_large_image", title, description: post.description, images: [ogImage] },
  };
}

const Page = async ({ params }: Params) => {
  const slug = decodeURIComponent((await params).id);
  const data = await getPublishedPostPageData(slug);
  if (!data) {
    const renamed = await getPostByPreviousSlug(slug);
    if (renamed) permanentRedirect(`/blogs/${renamed.slug}`);
    notFound();
  }
  return <Article data={data} rendered={renderArticle(data.post, data)} jsonLd />;
};

export default Page;
