import { listAuthorPicks, listCtas, listLeadMagnets, myAuthor } from "@/libs/blog-admin";
import BlogForm from "@/app/components/ADMIN/blog/BlogForm";
import NeedAuthorProfile from "@/app/components/ADMIN/blog/NeedAuthorProfile";

export const dynamic = "force-dynamic";

const Page = async () => {
  const [authors, me, magnets, ctas] = await Promise.all([listAuthorPicks(), myAuthor(), listLeadMagnets(), listCtas()]);
  if (!me) return <NeedAuthorProfile />;
  return (
    <BlogForm
      authors={authors}
      me={me}
      magnets={magnets.filter((m) => m.active).map((m) => ({ id: m.id, slug: m.slug, title: m.title }))}
      ctas={ctas.filter((c) => c.active).map((c) => ({ key: c.key, name: c.name }))}
    />
  );
};

export default Page;
