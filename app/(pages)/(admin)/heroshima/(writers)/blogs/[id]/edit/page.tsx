import NotFound from "@/app/components/NotFound";
import EditBlog from "./Client";
import { allAuthorsSelect, getBlogBySlug } from "@/libs/query";

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const blogSlug = decodeURIComponent((await params).id);
  const BLOG = await getBlogBySlug(blogSlug);
  const authors = await allAuthorsSelect();

  if (!BLOG) {
    return <NotFound title="Blog" buttonType="back" />;
  }

  return BLOG.data ? <EditBlog authors={authors} blog={BLOG.data} /> : <NotFound title="Blog" buttonType="back" />;
};

export default Page;
