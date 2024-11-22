import BookmarkClient from "./Client";
import { auth } from "@/auth";

const Page = async () => {
  const user = await auth();
  if (user?.user) {
    return <BookmarkClient />;
  } else {
    return <h1>Login to access this page</h1>;
  }
};

export default Page;
