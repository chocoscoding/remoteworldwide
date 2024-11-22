"use client";
import { useRouter } from "next/navigation";
export default function Error() {
  const { refresh } = useRouter();
  return (
    <main className="flex h-full flex-col items-center justify-center">
      <h2 className="text-center text-xl">Something went wrong!</h2>
      <button
        className="my-3 drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3"
        onClick={refresh}>
        Try again
      </button>
    </main>
  );
}
