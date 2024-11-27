"use client";
import React, { FC, Suspense } from "react";
import { Calendar, ChartNoAxesColumnIncreasing, Link as LinkIcon, MapPinned, Zap } from "lucide-react";
import Link from "next/link";
import BookmarkStatus from "../BookmarkStatus";
import { Job } from "@prisma/client";
import { toast } from "react-toastify";
import ReactQuill from "react-quill";

const JobDescription: FC<{ data: Job; hasUserBookmarked?: boolean; showBookmark?: boolean }> = ({
  data,
  showBookmark = true,
  hasUserBookmarked,
}) => {
  const { title, description, region, createdAt, jobType, seniority, applicationUrl } = data;

  const copyJobLink = () => {
    navigator.clipboard
      .writeText(window.location.origin + "/jobs/" + data.slug)
      .then(() => {
        toast.dismiss("copied");
        toast.success("🔗 Link Copied", {
          position: "top-center",
          style: { top: "0.05rem", width: "fit-content" },
          autoClose: 500,
          toastId: "copied",
        });
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };
  return (
    <div className="bg-white w-full min-h-screen rounded-lg drop-shadow-primary outline outline-2 outline-black p-3 sm:p-5 md:p-10 overflow-hidden">
      <p className="text-gray-500 text-sm">Job Description</p>

      <section className="mt-5 flex w-full flex-wrap xs:flex-row flex-col">
        <div className="w-full flex-1">
          <p className="font-semibold text-2xl md:text-3xl mb-1 sm:mb-3 w-full break-words text-pretty">{title}</p>
          <p className="text-gray-500 mb-1.5">Posted: {new Date(createdAt).toLocaleDateString("en-GB")}</p>
          <div className="w-full flex flex-wrap gap-3 md:gap-5 mb-3">
            <p className="text-gray-500 text-sm md:text-lg flex flex-shrink-0 items-center gap-1 md:gap-1.5">
              <MapPinned className="w-3 md:w-4 text-gray-400" />
              <span>Remote, {region}</span>
            </p>
            <p className="text-gray-500 text-sm md:text-lg flex flex-shrink-0 items-center gap-1 md:gap-1.5">
              <Calendar className="w-3 md:w-4 text-gray-400" />
              <span>{jobType}</span>
            </p>
            <p className="text-gray-500 text-sm md:text-lg flex flex-shrink-0 items-center gap-1 md:gap-1.5">
              <ChartNoAxesColumnIncreasing className="w-3 md:w-4 text-gray-400" />
              <span>{seniority}</span>
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 flex-shrink-0 w-fit ">
          <button className="h-8 w-8 rounded-lg border hover:bg-gray-50 flex items-center justify-center" onClick={copyJobLink}>
            <LinkIcon className="text-gray-500 w-[1.2rem]" />
          </button>
          {showBookmark && <BookmarkStatus hasUserBookmarked={hasUserBookmarked} jobId={data.id} />}
        </div>
      </section>
      <hr className="bg-gray-500 my-6" />
      <section className="middle min-h-[50vh]">
        <Suspense fallback={<p>Loading...</p>}>
          <ReactQuill value={description} readOnly={true} theme={"bubble"} />
        </Suspense>
      </section>
      <Link
        href={applicationUrl}
        target="_blank"
        className="bg-primary text-white w-full h-12 text-lg flex justify-center gap-3 items-center hover:rounded-lg transition-all mt-5">
        <Zap />
        <span className="font-bold">Apply Now</span>
      </Link>
    </div>
  );
};

export default JobDescription;
