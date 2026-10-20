"use client";

import { FC, useState } from "react";
import { PencilIcon, Trash } from "lucide-react";
import CompanySection from "@/app/components/main/job/CompanySection";
import Link from "next/link";
import type { Company } from "@/types/main";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import OverlayLoader from "@/app/components/OverlayLoader";
import { OneJobListType } from "@/types/main";
import { deleteCompany as deleteCompanyAction, findCompanyJobs } from "@/libs/query";
import withPagination from "@/app/components/main/withPagination";

const CompanyClient: FC<{ companyData: Company; initialJobs: OneJobListType[]; initialCount: number }> = ({
  companyData,
  initialJobs,
  initialCount,
}) => {
  const [loading, setIsLoading] = useState(false);
  const { push } = useRouter();
  const deleteCompany = async () => {
    try {
      setIsLoading(true);
      const data = await deleteCompanyAction(companyData.id);
      if ("error" in data) {
        throw new Error(data.error);
      }

      toast.success("Company deleted successfully!", {
        position: "bottom-right",
        autoClose: 3500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      push("/heroshima/companies/");
    } catch (error: any) {
      toast.dismiss("deleteError");
      toast.error(`Failed to delete company: ${error.message}`, {
        toastId: "deleteError",
      });
    } finally {
      setIsLoading(false);
    }
  };
  const fetchJobs = async (currentPage: number) => {
    try {
      const response = await findCompanyJobs(companyData.id, currentPage);
      return { jobs: response.data, total: response.count };
    } catch (error) {
      throw new Error("Something went wrong");
    }
  };

  const PaginatedActiveJobsComp = withPagination(null, fetchJobs, 50, initialJobs, initialCount);
  return (
    <main className="relative w-full">
      {loading ? <OverlayLoader /> : null}
      <div className="px-10 pt-10 w-full">
        <h1 className="text-2xl font-bold mb-6">Company Information</h1>
        <div className="w-[550px] gap-6 flex">
          <CompanySection showFullDetails companyDetails={companyData} />
          <div className="w-[3rem] flex-shrink-0">
            <Link
              href={`/heroshima/companies/${companyData.slug}/edit`}
              className="drop-shadow-secondary2-hover transition-all rounded-md w-full aspect-square border border-primary mb-3 grid place-items-center">
              <PencilIcon />
            </Link>
            <button className="drop-shadow-secondary2-hover transition-all rounded-md w-full aspect-square border border-primary mb-3 bg-red-500 text-white grid place-items-center ">
              <Trash onClick={deleteCompany} />
            </button>
          </div>
        </div>
        <br />
        <div className="grid grid-cols-1 w-full">
          {/* main */}
          <PaginatedActiveJobsComp />
        </div>
        <br />
      </div>
    </main>
  );
};
export default CompanyClient;
