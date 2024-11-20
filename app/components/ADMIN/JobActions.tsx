"use client";
import { EyeOffIcon, LoaderCircle, Pencil, Trash } from "lucide-react";
import { useState } from "react";
import { deleteOneJob } from "@/libs/query";
import { toast } from "react-toastify";
import { useRouter } from "next/router";
const JobActions = () => {
  const [loading, setLoading] = useState(false);
  const { push } = useRouter();
  const deleteJob = async () => {
    try {
      setLoading(true);
      await deleteOneJob("skd");

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
      push("/heroshima/jobs");
    } catch (error: any) {
      toast.error(`Failed to delete job: ${error.message}`);
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
      ) : null}
      <div className="w-full border mb-2 h-14 flex justify-center items-center text-xl text-white bg-black rounded-md gap-2 cursor-pointer">
        <span>Edit job</span>
        <Pencil className="w-4 h-4" />
      </div>
      <div className="w-full border mb-2 h-14 flex justify-center items-center text-xl text-white bg-yellow-500 border-yellow-600 rounded-md gap-2 cursor-pointer">
        <span>Make Inactive</span>
        <EyeOffIcon className="w-4 h-4" />
      </div>
      <div className="w-full border mb-2 h-14 flex justify-center items-center text-xl bg-red-500 border-red-600 text-white rounded-md cursor-pointer gap-2">
        <span>Delete Job</span>
        <Trash className="w-4 h-4" />
      </div>
    </div>
  );
};

export default JobActions;
