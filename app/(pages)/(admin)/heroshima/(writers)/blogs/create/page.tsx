import { allAuthorsSelect } from "@/libs/query";
import { listCtas, listLeadMagnets } from "@/libs/blog-admin";
import BlogForm from "@/app/components/ADMIN/blog/BlogForm";

export const dynamic = "force-dynamic";

const Page = async () => {
  const [authors, magnets, ctas] = await Promise.all([allAuthorsSelect(), listLeadMagnets(), listCtas()]);
  return (
    <BlogForm
      authors={authors}
      magnets={magnets.filter((m) => m.active).map((m) => ({ id: m.id, slug: m.slug, title: m.title }))}
      ctas={ctas.filter((c) => c.active).map((c) => ({ key: c.key, name: c.name }))}
    />
  );
};

export default Page;
