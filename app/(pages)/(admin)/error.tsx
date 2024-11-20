"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <main className="flex h-full flex-col items-center justify-center">
      <h2 className="text-center text-xl">{error.message ?? 'Something went wrong!'}</h2>
      <button
        className="my-3 drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3"
        onClick={
          // Attempt to recover by trying to re-render the invoices route
          () => reset()
        }>
        Try again
      </button>
    </main>
  );
}
