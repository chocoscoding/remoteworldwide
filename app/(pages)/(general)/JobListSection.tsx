"use client";
import React, { useState, useEffect, FC } from "react";
import JobTileV2 from "@/app/components/main/JobTileV2";
import { fetchLatestJobs } from "@/libs/query";
import { JobTileType } from "@/types/main";
import JobTileSkeletonList from "@/app/components/main/JobTileSkeletonList";

const JobListSection: FC<{ latestJobs: JobTileType[] }> = ({ latestJobs }) => {
  const [jobs, setJobs] = useState<JobTileType[]>(latestJobs);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  //function to fetch 10 jobs
  const fetchJobs = async () => {
    setLoading(true);
    try {
      const jobs = await fetchLatestJobs(10);
      setJobs(jobs.data);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    //fetch jobs only if the data returned from serverside is empty
    if (jobs.length < 1) {
      fetchJobs();
    }
  }, []);

  // loading skeleton
  if (loading) {
    return <JobTileSkeletonList amount={6} />;
  }

  // on error
  if (error) {
    return <p className="text-center font-bold my-3 text-red-500"> Error loading jobs</p>;
  }

  return (
    <div>
      {jobs.map((job, index) => (
        <JobTileV2 key={index} {...job} />
      ))}
    </div>
  );
};

export default JobListSection;
