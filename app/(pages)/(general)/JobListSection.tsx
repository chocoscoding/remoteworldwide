"use client";
import React, { useState, useEffect } from "react";
import JobTile from "@/app/components/main/JobTile";
import { fetchLatestJobs } from "@/libs/query";
import { JobTileType } from "@/types/main";
import JobTileSkeletonList from "@/app/components/main/JobTileSkeletonList";

const JobListSection = () => {
  const [jobs, setJobs] = useState<JobTileType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const jobs = await fetchLatestJobs(10);
        setJobs(jobs.data);
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchJobs();
  }, []);

  if (loading) {
    return <JobTileSkeletonList amount={6} />;
  }

  if (error) {
    return <p>Error loading jobs: {error}</p>;
  }

  return (
    <div>
      {jobs.map((job, index) => (
        <JobTile key={index} {...job} />
      ))}
    </div>
  );
};

export default JobListSection;
