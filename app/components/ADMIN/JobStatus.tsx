"use client";
import React, { FC } from "react";

const JobStatus: FC<{ currentStatus: "active" | "inactive" }> = ({ currentStatus }) => {
  return (
    <div>
      {currentStatus === "inactive" ? (
        <div className="p-1.5 bg-red-100 border border-red-200 text-red-600 text-sm rounded-lg">Inactive</div>
      ) : null}
      {currentStatus === "active" ? (
        <div className="p-1.5 bg-green-100 border border-green-200 text-green-600 text-sm rounded-lg">Active</div>
      ) : null}
    </div>
  );
};

export default JobStatus;
