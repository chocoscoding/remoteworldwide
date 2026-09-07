import NotFound from "@/app/components/NotFound";
import { allAuthorsSelect, getBlogBySlug } from "@/libs/query";
import { listCtas, listLeadMagnets } from "@/libs/blog-admin";
import BlogForm from "@/app/components/ADMIN/blog/BlogForm";

export const dynamic = "force-dynamic";

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const blogSlug = decodeURIComponent((await params).id);
  const [BLOG, authors, magnets, ctas] = await Promise.all([getBlogBySlug(blogSlug), allAuthorsSelect(), listLeadMagnets(), listCtas()]);

  if (!BLOG?.data) {
    return <NotFound title="Blog" buttonType="back" />;
  }

  return (
    <BlogForm
      authors={authors}
      magnets={magnets.filter((m) => m.active).map((m) => ({ id: m.id, slug: m.slug, title: m.title }))}
      ctas={ctas.filter((c) => c.active).map((c) => ({ key: c.key, name: c.name }))}
      blog={BLOG.data}
    />
  );
};

export default Page;
