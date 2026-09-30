import React from "react";

// Rendered only when the server-only DOWNTIME_MESSAGE is set, so an incident
// banner needs an env change plus a redeploy — never a code change, and never
// on by default. The text comes from the root layout: this file must stay a
// plain presentational component so nothing here reads the environment.
const Downtime = ({ message }: { message: string }) => {
  return (
    <div
      role="status"
      className="w-full py-2 text-center text-black bg-lime-500 font-bold">
      {message}
    </div>
  );
};

export default Downtime;
