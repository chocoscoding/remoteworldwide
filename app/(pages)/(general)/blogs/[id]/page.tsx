import NotFound from "@/app/components/NotFound";
import BlogPageClient from "./Client";
import { revalidatePath } from "next/cache";

const getBlogBySlug = async (slug: string) => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/blog/${slug}`, { cache: "no-cache" });
  const data = await res.json();
  if (!res.ok) {
    if (data.message === "Blog not found") {
      return null;
    }
    throw new Error("Failed to fetch blog");
  }
  return data.data;
};
const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  revalidatePath("./");
  const blogSlug = decodeURIComponent((await params).id);
  const BLOG = await getBlogBySlug(blogSlug);

  if (!BLOG) {
    return <NotFound title="Blog" buttonType="back" />;
  }

  return <BlogPageClient blog={BLOG} />;
};

export default Page;
