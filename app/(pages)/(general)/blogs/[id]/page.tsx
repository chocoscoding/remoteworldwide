import NotFound from "@/app/components/NotFound";
import BlogPageClient from "./Client";
import { getBlogBySlug } from "@/libs/query";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const blogSlug = decodeURIComponent((await params).id);
  const { data: BLOG } = await getBlogBySlug(blogSlug);

  if (!BLOG) {
    return {
      title: "Blog Not Found",
      description: "The blog you are looking for does not exist.",
      openGraph: {
        title: "Read more job related blogs on RemoteWorldWide",
        images: `${process.env.NEXT_PUBLIC_SITE_URL}/api/og/blog`,
        url: `${process.env.NEXT_PUBLIC_SITE_URL}/blogs`,
      },
    };
  }
  const { title, author, description, coverImage, slug } = BLOG;

  // fetch data
  const imageUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/og/blog?title=${encodeURIComponent(title)}&author=${encodeURIComponent(
    author.name
  )}&description=${encodeURIComponent(description)}&image=${encodeURIComponent(coverImage)}`;

  return {
    title: title,
    description: `Remoteworldwide Blog - ${description}`,
    openGraph: {
      images: imageUrl,
      title: title,
      description,
      author: author.name,
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/blogs/${slug}`,
    },
  };
}

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const blogSlug = decodeURIComponent((await params).id);
  const { data: BLOG } = await getBlogBySlug(blogSlug);

  if (!BLOG) {
    return <NotFound title="Blog" buttonType="back" />;
  }

  return <BlogPageClient blog={{ ...BLOG, createdAt: BLOG.createdAt.toISOString(), updatedAt: BLOG.updatedAt.toISOString() }} />;
};

export default Page;
