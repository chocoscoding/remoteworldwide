import { EyeOffIcon, Pencil, Trash } from "lucide-react";
import React from "react";

const JobActions = () => {
  return (
    <div className="mt-6">
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
