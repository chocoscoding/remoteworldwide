"use client";

import { FC, useState } from "react";
import { LoaderCircle, LoaderPinwheel, PencilIcon, Trash } from "lucide-react";
import AdminJobTile from "@/app/components/ADMIN/AdminJobTile";
import CompanySection from "@/app/components/main/job/CompanySection";
import Link from "next/link";
import { Company } from "@prisma/client";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

const CompanyClient: FC<{ companyData: Company }> = ({ companyData }) => {
  const [loading, setIsLoading] = useState(false);
  const { push } = useRouter();
  const deleteCompany = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/companies/" + companyData.id, {
        method: "DELETE",
      });
      const data = (await response.json()) as { data: Company; message: string };

      if (!response.ok) {
        throw new Error(data.message);
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
      const NOT_FOUND_ERROR = error.message === `company doesn't exist` ? `: company doesn't exist` : "";
      toast.dismiss("deleteError");
      toast.error(`Failed to delete company ${NOT_FOUND_ERROR}`, {
        toastId: "deleteError",
      });
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <main className="relative w-full">
      {loading ? (
        <div className="fixed w-full h-full backdrop-blur bg-black/40 flex items-center justify-center flex-col text-white">
          <LoaderCircle className="w-[20vw] h-[20vh] animate-spin" />
          <p className="text-xl">Processing...</p>
        </div>
      ) : null}
      <div className="px-10 pt-10 w-full">
        <h1 className="text-2xl font-bold mb-6">Company Information</h1>
        <div className="w-[550px] gap-6 flex">
          <CompanySection showFullDetails {...companyData} />
          <div className="w-[6rem]">
            <Link
              href={`/heroshima/companies/${companyData.name}/edit`}
              className="drop-shadow-secondary2-hover transition-all rounded-md w-full aspect-square border border-primary mb-3 grid place-items-center">
              <PencilIcon />
            </Link>
            <button className="drop-shadow-secondary2-hover transition-all rounded-md w-full aspect-square border border-primary mb-3 bg-red-500 text-white grid place-items-center ">
              <Trash onClick={deleteCompany} />
            </button>
          </div>
        </div>
        <br />
        <h2 className="font-bold text-xl my-2">Jobs</h2>
        <div className="grid grid-cols-1 w-full">
          {/* main */}
          {Array(20)
            .fill(0)
            .map((_, index) => (
              <AdminJobTile key={index} />
            ))}
        </div>
      </div>
    </main>
  );
};
export default CompanyClient;
