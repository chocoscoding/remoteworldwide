import NotFound from "@/app/components/NotFound";
import { findAuthorBySlug } from "@/libs/query";
import UpdateAuthorClient from "./Client";

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const slug = (await params).id;
  const author = await findAuthorBySlug(slug);

  return author.data ? (
    <UpdateAuthorClient
      id={author.data?.id}
      data={{
        profileImage: author.data.profileImage,
        name: author.data.name,
        website: author.data.website ?? "",
        linkedin: author.data?.linkedin ?? "",
        instagram: author.data?.instagram ?? "",
        twitter: author.data?.twitter ?? "",
        about: author.data.about ?? "",
      }}
    />
  ) : (
    <NotFound title="Author" buttonType="back" />
  );
};

export default Page;
