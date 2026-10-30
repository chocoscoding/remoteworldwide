"use client";
import { Bookmark } from "lucide-react";
import React, { FC, useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { checkBookmarkForUser, createBookmarkForUser, deleteBookmarkForUser } from "@/libs/query";
import { toast } from "react-toastify";

const BookmarkStatus: FC<{ jobId: string; hasUserBookmarked?: boolean; onLogin?: () => void }> = ({ jobId, hasUserBookmarked, onLogin }) => {
  const [isBookmarked, setIsBookmarked] = useState(hasUserBookmarked ?? false);
  const [pendingAction, setPendingAction] = useState<boolean | null>(null); // To track the intended action
  const { status, data: session } = useSession();
  const touched = useRef(false);

  // No answer from the server (the public job page is cached, so it can't know who is looking):
  // ask once the session says they're signed in. A press made meanwhile wins over the answer.
  const signedInId = status === "authenticated" && !session?.user?.deletionDueAt ? session?.user?.id : undefined;
  useEffect(() => {
    if (hasUserBookmarked !== undefined || !signedInId) return;
    let live = true;
    checkBookmarkForUser(jobId)
      .then((res) => {
        if (live && !touched.current) setIsBookmarked(Boolean(res.data?.id));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [hasUserBookmarked, signedInId, jobId]);

  useEffect(() => {
    if (pendingAction === null) return;

    // Set a debounce timer
    const timer = setTimeout(async () => {
      try {
        // The actions take the user from the session, not from here.
        if (pendingAction) {
          await createBookmarkForUser(jobId);
        } else {
          await deleteBookmarkForUser(jobId);
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
  }, [pendingAction, jobId]);

  const toggleBookmark = () => {
    toast.dismiss("bookmarkErr");
    if (status === "unauthenticated") {
      if (onLogin) { onLogin(); return; }
      toast.error("Sign in to bookmark this job", {
        position: "top-center",
        style: { top: "0.5rem", width: "fit-content" },
        autoClose: 500,
        toastId: "bookmarkErr",
      });
      return;
    }
    if (status === "authenticated") {
      touched.current = true;
      const newBookmarkState = !isBookmarked;
      setIsBookmarked(newBookmarkState);
      setPendingAction(newBookmarkState); // Set the intended action
    }
  };

  return (
    <button
      type="button"
      aria-label={isBookmarked ? "Unsave job" : "Save job"}
      aria-pressed={isBookmarked}
      disabled={status === "loading"}
      className={` flex-0 flex-shrink-0 flex border h-8 w-8 rounded-md items-center justify-center cursor-pointer  ${
        isBookmarked ? "border-primary/30 bg-black" : "hover:bg-gray-50"
      }`}
      onClick={toggleBookmark}>
      <Bookmark
        fill={isBookmarked ? "#daec54" : "#ffffff"}
        className={`transition-all w-[1.2rem] ${isBookmarked ? "text-secondary" : "text-gray-500"}`}
      />
    </button>
  );
};

export default BookmarkStatus;
