"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Home, RotateCcw } from "lucide-react";
import ErrorScreen, { ERROR_BUTTON } from "@/app/components/ErrorScreen";

const Error = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      digits={["5", "0"]}
      title="Something went wrong"
      message={error.message || "An unexpected error occurred."}
      action={
        <>
          <button type="button" onClick={reset} className={`${ERROR_BUTTON} bg-white text-primary hover:bg-secondary`}>
            <RotateCcw className="h-4 w-4" />
            Try again
          </button>
          <Link href="/heroshima" className={`${ERROR_BUTTON} bg-primary text-white`}>
            <Home className="h-4 w-4" />
            Go home
          </Link>
        </>
      }
    />
  );
};

export default Error;
