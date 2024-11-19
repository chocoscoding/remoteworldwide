"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";
import { FcEmptyTrash } from "react-icons/fc";

const NotFound: React.FC<{ title: string; link?: string; buttonType: "link" | "back" }> = ({ title, link, buttonType }) => {
  const router = useRouter();
  return (
    <div className="w-full h-screen flex flex-col justify-center items-center">
      <div>
        <FcEmptyTrash className="w-[10rem] h-[10rem] icon-empty" /> {/* Replace with your icon */}
      </div>
      <div className="font-bold text-4xl mb-3">{title} not found</div>
      {buttonType === "link" ? (
        <Link
          href={link!}
          className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3">
          Create new {title}
        </Link>
      ) : (
        <div>
          <button
            className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3"
            onClick={() => router.back()}>
            Go back
          </button>
          <Link
            href={link?.includes("heroshima") ? "/heroshima" : "/"}
            className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3 mt-2">
            Go Home
          </Link>
        </div>
      )}
    </div>
  );
};

export default NotFound;
