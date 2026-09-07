"use client";

import { useEffect } from "react";
import ErrorScreen from "@/app/components/ErrorScreen";

const Error = ({ error }: { error: Error & { digest?: string } }) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorScreen fit="screen" digits={["5", "0"]} title="Something went wrong" message={error.message || "An unexpected error occurred. Try again in a moment."} />;
};

export default Error;
