"use client";
import { EyeOffIcon, LoaderCircle, Pencil, Trash } from "lucide-react";
import { FC, useState } from "react";
import { deleteOneJob, toggleJobActiveState } from "@/libs/query";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import Link from "next/link";
const JobActions: FC<{ id: string; isJobActive: boolean; slug: string }> = ({ id, isJobActive, slug }) => {
  const [loading, setLoading] = useState(false);
  const [isActive, setIsActive] = useState(isJobActive);
  const { push } = useRouter();
  const deleteJob = async () => {
    try {
      setLoading(true);
      await deleteOneJob(id);

      toast.success("Job delete successfully!", {
        position: "bottom-right",
        autoClose: 3500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      await push("/heroshima/jobs");
    } catch (error: any) {
      toast.error(`Failed to delete job: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  const toggleActive = async () => {
    try {
      setLoading(true);
      await toggleJobActiveState(id, !isActive);

      toast.success("Job updated successfully!", {
        position: "bottom-right",
        autoClose: 3500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      setIsActive((prev) => !prev);
    } catch (error: any) {
      toast.error(`Failed to update job: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mt-6">
      {loading ? (
        <div className="h-[60vh] flex flex-col items-center justify-center">
          <LoaderCircle className="w-[10vw] h-[10vh] animate-spin" />
          <p className="text-xl">Loading...</p>
        </div>
      ) : (
        <>
          <Link
            href={`/heroshima/jobs/${slug}/edit `}
            className="w-full border mb-2 h-14 flex justify-center items-center text-xl text-white bg-black rounded-md gap-2 cursor-pointer">
            <span>Edit job</span>
            <Pencil className="w-4 h-4" />
          </Link>
          <button
            disabled={loading}
            onClick={toggleActive}
            className={`w-full border mb-2 h-14 flex justify-center items-center text-xl text-white ${
              isActive ? "bg-yellow-500 border-yellow-600" : "bg-green-500 border-green-600"
            } rounded-md gap-2 cursor-pointer`}>
            <span>{isActive ? "Make Inactive" : "Make Active"}</span>
            <EyeOffIcon className="w-4 h-4" />
          </button>
          <button
            disabled={loading}
            className="w-full border mb-2 h-14 flex justify-center items-center text-xl bg-red-500 border-red-600 text-white rounded-md cursor-pointer gap-2"
            onClick={deleteJob}>
            <span>Delete Job</span>
            <Trash className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
};

export default JobActions;
