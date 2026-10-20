import NotFound from "@/app/components/NotFound";
import { getPostPageData } from "@/app/lib/blog/data";
import { renderArticle } from "@/app/lib/blog/article";
import Article from "@/app/components/blog/Article";
import { getBlogBySlug } from "@/libs/query";
import AdminPostActions from "./Client";

export const dynamic = "force-dynamic";

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const slug = decodeURIComponent((await params).id);
  const [data, editable] = await Promise.all([getPostPageData(slug), getBlogBySlug(slug)]);
  if (!data) return <NotFound title="Blog" buttonType="back" />;
  return (
    <Article
      data={data}
      rendered={renderArticle(data.post, data)}
      toolbar={<AdminPostActions id={data.post.id} slug={data.post.slug} title={data.post.title} status={data.post.status} notUpdated={Boolean(editable.data?.hasPendingEdit)} />}
    />
  );
};

export default Page;
