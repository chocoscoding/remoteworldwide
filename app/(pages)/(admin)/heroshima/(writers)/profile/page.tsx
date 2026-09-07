import { myAuthor } from "@/libs/blog-admin";
import ProfileForm from "@/app/components/ADMIN/blog/ProfileForm";

export const dynamic = "force-dynamic";

const Page = async () => {
  const me = await myAuthor();
  return <ProfileForm key={me?.id ?? "new"} author={me} />;
};

export default Page;
