"use client";
import { FC, useState } from "react";
import { Edit, Trash } from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { deleteAuthor } from "@/libs/query";
import { useRouter } from "next/navigation";
import { AuthorWithBlog } from "@/types/main";

const AuthorDetailsPage: FC<{ data: AuthorWithBlog }> = ({ data }) => {
  const { blogs, ...authorsInfo } = data;
  const [isLoading, setIsLoading] = useState(false);
  const { push } = useRouter();
  console.log(authorsInfo);

  const handleDeleteAuthor = async () => {
    if (confirm("Are you sure you want to delete this author?")) {
      setIsLoading(true);
      toast.info("Deleting author...", { autoClose: 300 });

      try {
        await deleteAuthor(authorsInfo.id);

        toast.success("Author deleted successfully!", {
          position: "bottom-right",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "dark",
        });
        push("/heroshima/authors");
      } catch (error: any) {
        toast.error(`Failed to create job: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="w-full h-screen overflow-y-scroll p-4">
      <p className="mt-2 mb-10 text-2xl font-bold">Author's Information</p>
      <div className="flex items-center gap-4 mb-6">
        <img src={authorsInfo.profileImage} alt={authorsInfo.name} className="w-40 h-40 border-2 object-cover rounded-full" />
        <div>
          <h1 className="text-2xl font-bold">{authorsInfo.name}</h1>
          <p className="text-gray-600">{authorsInfo.about}</p>
          <div className="flex gap-2 mt-2">
            <Link
              href={authorsInfo.website || "#"}
              target={authorsInfo.website ? "_blank" : undefined}
              className={`${authorsInfo.website ? "text-green-500 underline" : "text-gray-400"}`}>
              Website
            </Link>
            <Link
              href={authorsInfo.twitter || "#"}
              target={authorsInfo.twitter ? "_blank" : undefined}
              className={`${authorsInfo.twitter ? "text-green-500 underline" : "text-gray-400"}`}>
              Twitter
            </Link>
            <Link
              href={authorsInfo.linkedin || "#"}
              target={authorsInfo.linkedin ? "_blank" : undefined}
              className={`${authorsInfo.linkedin ? "text-green-500 underline" : "text-gray-400"}`}>
              LinkedIn
            </Link>
            <Link
              href={authorsInfo.instagram || "#"}
              target={authorsInfo.instagram ? "_blank" : undefined}
              className={`${authorsInfo.instagram ? "text-green-500 underline" : "text-gray-400"}`}>
              Instagram
            </Link>
          </div>
          <div className="flex gap-2 mt-4">
            <Link
              href={isLoading ? "#" : "/heroshima/authors/1234/edit"}
              className="drop-shadow-secondary2-hover flex items-center transition-all group hover:rounded-mds bg-white text-base border-2 border-primary font-bold rounded-sm p-3 hover:rounded-md">
              <Edit className="w-6 h-6 mr-2 group-hover:scale-90" />
              Edit
            </Link>
            <button
              disabled={isLoading}
              className="drop-shadow-secondary2-hover flex items-center transition-all group hover:rounded-mds text-base border-2 border-red-900 font-bold rounded-sm p-1 bg-red-600 hover:rounded-md text-white"
              onClick={handleDeleteAuthor}>
              <Trash className="w-6 h-6 mr-2 group-hover:scale-90 text-red-300" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-4">Blogs by {authorsInfo.name}</h2>
      <div className="space-y-4">
        {blogs.length < 1 ? <p className="font-bold text-center my-6 text-xl">No blog yet</p> : null}
        {blogs.map((blog, index) => (
          <div key={index} className="p-4 border border-gray-300 rounded-md shadow-sm">
            <h3 className="text-lg font-bold">{blog.title}</h3>
            <p className="text-gray-600">{blog.description}</p>
            <Link href={`/blogs/${blog.slug}`} className="text-green-500 underline">
              Read More
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};
export default AuthorDetailsPage;
