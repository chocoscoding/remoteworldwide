import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getPostByPreviousSlug, getPostPageData } from "@/app/lib/blog/data";
import { renderArticle } from "@/app/lib/blog/article";
import Article from "@/app/components/blog/Article";
import { absoluteUrl, blogOgImage, SITE_NAME } from "@/app/lib/seo";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const slug = decodeURIComponent((await params).id);
  const data = await getPostPageData(slug);
  if (!data) {
    return { title: "Post not found", description: "The post you are looking for does not exist.", robots: { index: false } };
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
    authors: post.authors.map((a) => ({ name: a.name, url: absoluteUrl(`/author/${a.slug}`) })),
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
      authors: post.authors.map((a) => a.name),
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
  return <Article data={data} rendered={renderArticle(data.post, data)} jsonLd />;
};

export default Page;
