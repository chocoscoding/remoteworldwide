import NotFound from "@/app/components/NotFound";
import { backendOrNull } from "@/app/lib/backend";
import type { Blog } from "@/app/lib/blog/types";
import BlogPageClient from "./Client";

const getBlogBySlug = (slug: string) => backendOrNull<Blog>(`/blog/admin/posts/${encodeURIComponent(slug)}`, { session: true });
const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const blogSlug = decodeURIComponent((await params).id);
  const BLOG = await getBlogBySlug(blogSlug);

  if (!BLOG) {
    return <NotFound title="Blog" buttonType="back" />;
  }

  return <BlogPageClient blog={BLOG} />;
};

export default Page;
