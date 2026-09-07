import { listAdminPosts, myAuthor, type AdminPostScope } from "@/libs/blog-admin";
import AllBlogsClient from "./Client";

export const dynamic = "force-dynamic";

const Page = async () => {
  const me = await myAuthor();
  const scope: AdminPostScope = me ? "mine" : "all";
  const posts = await listAdminPosts(1, scope);
  return <AllBlogsClient initialRows={posts.data} initialCount={posts.count} initialScope={scope} hasAuthorProfile={me !== null} />;
};

export default Page;
