"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import BookmarkTile from "../../../components/main/BookmarkTile";
import { useSession } from "next-auth/react";
import { LoaderCircle } from "lucide-react";
import { OneBookmarkType } from "@/types/main";
import { deleteBookmarkForUser, getAllBookmarksForUser } from "@/libs/query";
import { toast } from "react-toastify";
import JobTileSkeletonList from "@/app/components/main/JobTileSkeletonList";
import PaginationControl from "@/app/components/main/PaginationControl";

const BookmarkClient = () => {
  const { status, data } = useSession();
  const [bookmark, setBookmarks] = useState<OneBookmarkType[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalBookmarks, setTotalBookmarks] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const jobsPerPage = 30;
  const totalPages = useMemo(() => Math.ceil(totalBookmarks / jobsPerPage), [totalBookmarks]);
  console.log(totalPages);

  useEffect(() => {
    if (status !== "authenticated") return;
    const fetchBookmarks = async () => {
      setLoading(true); // Set loading to true before fetching data
      try {
        const { data: fetchedJobs, count: total } = await getAllBookmarksForUser(data.user!.id, currentPage);
        setBookmarks(fetchedJobs);
        console.log(total);
        setTotalBookmarks(total);
      } catch {
        toast.error("Failed to fetch jobs:");
      } finally {
        setLoading(false); // Set loading to false after the fetch completes (success or error)
      }
    };
    fetchBookmarks();
  }, [currentPage]);

  // Handlers for pagination buttons
  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage((prevPage) => prevPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  const removeBookmark = async (id: string) => {
    try {
      setBookmarks((prevJobs) => prevJobs.filter((bookmark) => bookmark.job.id !== id));
      setTotalBookmarks((prevTotal) => prevTotal - 1);
      await deleteBookmarkForUser(data!.user!.id, id);
    } catch {
      toast.error("Error encountered removing bookmark");
    }
  };

  // Display range for jobs on the current page
  const startJobIndex = (currentPage - 1) * jobsPerPage;
  const endJobIndex = startJobIndex + jobsPerPage;

  if (status === "unauthenticated") {
    return <h1>Login to view bookmarks</h1>;
  }
  if (status === "loading") {
    return (
      <div className="h-[80vh] w-full relative overflow-hidden flex justify-center items-center flex-col">
        <LoaderCircle className="w-[10vw] h-[10vh] animate-spin" />
        <p className="text-xl">Fetching Bookmarks...</p>
      </div>
    );
  }
  return (
    <div className="p-1 xl:p-10 w-full max-w-[1400px] m-auto">
      <section className="w-full md:px-1 flex gap-12 relative">
        <section className="w-full  m-auto px-2 lg:px-0">
          <p className="font-bold text-primary text-3xl mb-2">Hello {data?.user?.name}</p>
          <p className="text-primary text-lg font-light">Did you saved some jobs? Do apply to them before they get stale 🤝</p>
          <div className="mb-5 my-10">
            <p className="text-xl mb-2">
              <span className="font-bold text-primary">My bookmarks</span>{" "}
              <span className="font-extralight text-gray-400 italic text-lg">{`(${totalBookmarks})`}</span>
            </p>
            <hr />
          </div>
          <div className="grid grid-cols-1 ">
            {/* main */}
            {loading ? (
              <JobTileSkeletonList amount={6} />
            ) : (
              bookmark.map((bookmark, index) => <BookmarkTile job={bookmark.job} removeBookmark={removeBookmark} key={index} />)
            )}
            {bookmark.length < 1 ? (
              <div className="h-[30vh] flex items-center justify-center">
                <p className="text-center text-xl text-gray-700">No bookmarks yet</p>
              </div>
            ) : null}
          </div>

          {/* pagination */}
          <PaginationControl
            handlePrevious={handlePrevious}
            handleNext={handleNext}
            currentPage={currentPage}
            totalPages={totalPages}
            dataTotal={totalBookmarks}
            startIndex={startJobIndex}
            endIndex={endJobIndex}
          />
        </section>
      </section>
      <br />
    </div>
  );
};

export default BookmarkClient;
