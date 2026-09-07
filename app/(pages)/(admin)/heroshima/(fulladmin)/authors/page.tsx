import AllAuthorsPage from "./Client";
import { FcEmptyTrash } from "react-icons/fc";
import Link from "next/link";
import { getAuthors } from "@/app/lib/blog/data";

const Page = async () => {
  const author = await getAuthors();

  if (author.length === 0) {
    return (
      <div className="w-full h-screen flex flex-col justify-center items-center">
        <div>
          <FcEmptyTrash className="w-[10rem] h-[10rem] icon-empty" /> {/* Replace with your icon */}
        </div>
        <p className="text-xl font-bold">No authors yet</p>
        <Link
          href={"/heroshima/authors/create"}
          className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-md p-3 mt-2">
          Create author
        </Link>
      </div>
    );
  }

  return <AllAuthorsPage data={author} />;
};

export default Page;
