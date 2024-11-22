import { allAuthorsSelect } from "@/libs/query";
import CreateBlogClient from "./Client";

const Page = async () => {
  const authors = await allAuthorsSelect();
  return <CreateBlogClient authors={authors} />;
};

export default Page;
