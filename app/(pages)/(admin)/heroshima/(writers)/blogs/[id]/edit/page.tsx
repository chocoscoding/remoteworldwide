import NotFound from "@/app/components/NotFound";
import { getBlogBySlug } from "@/libs/query";
import { listAuthorPicks, listCtas, listLeadMagnets, myAuthor } from "@/libs/blog-admin";
import BlogForm from "@/app/components/ADMIN/blog/BlogForm";
import NeedAuthorProfile from "@/app/components/ADMIN/blog/NeedAuthorProfile";

export const dynamic = "force-dynamic";

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const blogSlug = decodeURIComponent((await params).id);
  const [BLOG, authors, me, magnets, ctas] = await Promise.all([getBlogBySlug(blogSlug), listAuthorPicks(), myAuthor(), listLeadMagnets(), listCtas()]);

  if (!BLOG?.data) {
    return <NotFound title="Blog" buttonType="back" />;
  }

  if (!me) return <NeedAuthorProfile action="edit" />;

  return (
    <BlogForm
      authors={authors}
      me={me}
      magnets={magnets.filter((m) => m.active).map((m) => ({ id: m.id, slug: m.slug, title: m.title }))}
      ctas={ctas.filter((c) => c.active).map((c) => ({ key: c.key, name: c.name }))}
      blog={BLOG.data}
    />
  );
};

export default Page;
