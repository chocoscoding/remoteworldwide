"use client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import CompanyForm from "@/app/components/ADMIN/CompanyForm";

export default function CreateCompany() {
  const { push } = useRouter();

  return (
    <div className="w-full h-screen overflow-y-scroll p-4 lg:pr-[5%]">
      <h1 className="text-2xl font-bold mb-4">Create New Company</h1>
      <CompanyForm
        onCreated={(company) => push("/heroshima/companies/" + company.slug)}
        renderActions={({ isLoading }) => (
          <div className="flex justify-center pt-4">
            <button
              disabled={isLoading}
              type="submit"
              className="drop-shadow-secondary2-hover hover:rounded-md flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3 disabled:opacity-50">
              <Plus className="w-6 h-6 mr-2" />
              Create Company
            </button>
          </div>
        )}
      />
    </div>
  );
}
