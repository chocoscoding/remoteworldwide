import NotFound from "@/app/components/NotFound";
import { AuthorListChildType } from "@/types/main";
import { revalidatePath } from "next/cache";
import React from "react";
import AuthorDetailsPage from "./Client";
import AllAuthorsPage from "./Client";
import { FcEmptyTrash } from "react-icons/fc";
import Link from "next/link";

const getAllAuthors = async (id: string): Promise<AuthorListChildType[]> => {
  try {
    const res = await fetch(process.env.NEXT_PUBLIC_URL + "/api/author", { cache: "no-cache" });
    const data: Promise<{ data: AuthorListChildType[]; message: string }> = await res.json();
    if (!res.ok) {
      throw new Error((await data).message);
    }
    return (await data).data;
  } catch (error) {
    throw new Error("Failed to fetch authors.");
  }
};

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const author = await getAllAuthors((await params).id);
  console.log(author);

  if (author.length === 0) {
    return (
      <div className="w-full h-screen flex flex-col justify-center items-center">
        <div>
          <FcEmptyTrash className="w-[10rem] h-[10rem] icon-empty" /> {/* Replace with your icon */}
        </div>
        <p className="text-xl font-bold">No authors yet</p>
        <Link
          href={"/heroshima/authors/create"}
          className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm hover:rounded-md p-3 mt-2">
          Create author
        </Link>
      </div>
    );
  }

  return <AllAuthorsPage data={author} />;
};

export default Page;
