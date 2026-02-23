"use client";
import { Bookmark } from "lucide-react";
import React, { FC, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { createBookmarkForUser, deleteBookmarkForUser } from "@/libs/query";
import { toast } from "react-toastify";

const BookmarkStatus: FC<{ jobId: string; hasUserBookmarked?: boolean }> = ({ jobId, hasUserBookmarked }) => {
  const [isBookmarked, setIsBookmarked] = useState(hasUserBookmarked ?? false);
  const [pendingAction, setPendingAction] = useState<boolean | null>(null); // To track the intended action
  const { status, data: sessionData } = useSession();
  const userId = sessionData?.user?.id;

  useEffect(() => {
    if (pendingAction === null) return;

    // Set a debounce timer
    const timer = setTimeout(async () => {
      try {
        if (pendingAction) {
          await createBookmarkForUser(userId!, jobId);
        } else {
          await deleteBookmarkForUser(userId!, jobId);
        }
      } catch {
        toast.error("An error occurred. Please try again.");
        // Revert state if API call fails
        setIsBookmarked(!pendingAction);
      }
      setPendingAction(null);
    }, 550);

    // Clear the timer if the component unmounts or the action changes
    return () => clearTimeout(timer);
  }, [pendingAction, userId, jobId]);

  const toggleBookmark = () => {
    toast.dismiss("bookmarkErr");
    if (status === "unauthenticated") {
      toast.error("Sign in to bookmark this job", {
        position: "top-center",
        style: { top: "0.5rem", width: "fit-content" },
        autoClose: 500,
        toastId: "bookmarkErr",
      });
      return;
    }
    if (status === "authenticated") {
      const newBookmarkState = !isBookmarked;
      setIsBookmarked(newBookmarkState);
      setPendingAction(newBookmarkState); // Set the intended action
    }
  };

  return (
    <div
      className={` flex-0 flex-shrink-0 flex border h-8 w-8 rounded-md items-center justify-center cursor-pointer  ${
        isBookmarked ? "border-primary/30 bg-black" : "hover:bg-gray-50"
      }`}
      onClick={toggleBookmark}>
      <Bookmark
        fill={isBookmarked ? "#daec54" : "#ffffff"}
        className={`transition-all w-[1.2rem] ${isBookmarked ? "text-secondary" : "text-gray-500"}`}
      />
    </div>
  );
};

export default BookmarkStatus;
