"use client";

// Any page that throws lands here. The message is fixed rather than the error's own: in production a
// server error's message is a generic placeholder anyway, and a client error's can be anything. The
// digest is what matches a report to the server logs, so it is shown small for anyone writing in.

import { useEffect } from "react";
import ErrorScreen from "@/app/components/ErrorScreen";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Next 16: refreshes the route's data, then re-renders. Preferred over `reset` when present. */
  retry?: () => void;
};

const RouteError = ({ error, reset, retry }: RouteErrorProps) => {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      fit="screen"
      digits={["5", "0"]}
      title="Something went wrong"
      message="This page hit a problem on our side. Try again, and if it keeps happening, write to contact@remoteworldwide.net."
      onRetry={retry ?? reset}
      reference={error.digest}
    />
  );
};

export default RouteError;
