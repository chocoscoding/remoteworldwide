"use client";
import { FC, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import { FaSpinner } from "react-icons/fa6";
import { FilterData, FilterType } from "@/types/main";

interface SelectRef {
  inputRef?: HTMLInputElement;
}

interface AIJobParserProps {
  filters: FilterData;
  allCompanies: FilterType[];
  onParseComplete: (parsedData: {
    jobTitle: string;
    jobLink: string;
    jobDescription: string;
    companyName: string;
    category: string;
    regions: string[];
    seniorityLevel: string;
  }) => void;
}

const AIJobParser: FC<AIJobParserProps> = ({ filters, allCompanies, onParseComplete }) => {
  const [parseUrl, setParseUrl] = useState("");
  const [isParsing, setIsParsing] = useState(false);

  const handleParseJob = async () => {
    if (!parseUrl.trim()) {
      toast.error("Please enter a job URL");
      return;
    }

    setIsParsing(true);
    toast.info("Parsing job posting...", { autoClose: 2000 });

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/jobs/parse`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": process.env.NEXT_PUBLIC_BACKEND_TOKEN || "",
        },
        body: JSON.stringify({ jobUrl: parseUrl }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to parse job");
      }

      const { jobTitle, companyName, jobDescription, seniorityLevel, category, regions, region } = data.data;
      const normalizedRegions = Array.isArray(regions) ? regions : region ? [region] : [];

      // Pass the parsed data back to parent component
      onParseComplete({
        jobTitle: jobTitle || "",
        jobLink: data.data.jobLink || parseUrl,
        jobDescription: jobDescription || "",
        companyName: companyName || "",
        category: category || "",
        regions: normalizedRegions,
        seniorityLevel: seniorityLevel || "",
      });

      toast.success("Job parsed successfully! Review and submit.", {
        position: "bottom-right",
        autoClose: 3000,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to parse job";
      toast.error(errorMessage);
      console.error("Parse error:", error);
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-lime-100 to-secondary border-2 border-neutral-200 rounded-md p-6 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold text-lime-900">Create jobs faster with AI</h2>
      </div>
      <p className="text-sm text-gray-600 mb-4">
        Paste a job URL and let AI parse all the details for you
        <span className="italic text-xs">{`(Verify information as AI is subject to errors)`}</span>
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          value={parseUrl}
          onChange={(e) => setParseUrl(e.target.value)}
          placeholder="https://example.com/careers/job-posting"
          className="flex-1 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-2 focus:ring-lime-500 focus:border-transparent outline-none"
          disabled={isParsing}
        />
        <button
          type="button"
          onClick={handleParseJob}
          disabled={isParsing}
          className="
          drop-shadow-secondary2-hover flex items-center transition-all text-white text-base bg-primary font-bold group p-3 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:text-secondary gap-2
          ">
          {isParsing ? (
            <>
              <FaSpinner className="animate-spin h-4 w-4 " />
              Parsing...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Parse Job
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default AIJobParser;
