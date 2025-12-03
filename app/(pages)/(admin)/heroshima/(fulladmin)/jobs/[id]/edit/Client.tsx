"use client";
import { FC, useState } from "react";
import dynamic from "next/dynamic";
import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { SelectField, TextField } from "@/app/components/inputs";
import { FilterData, FilterType, FormValues } from "@/types/main";
import { toast } from "react-toastify";
import { Job } from "@prisma/client";
import { updateOneJob } from "@/libs/query";
import OverlayLoader from "@/app/components/OverlayLoader";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

type UpdateJobType = { job: Job & { company: { name: string } }; allCompanies: FilterType[]; filters: FilterData };

const GenerateNewOption = (title: string, href: string) => ({
  value: "add new",
  label: `Add new ${title}`,
  href,
});

const UpdateJob: FC<UpdateJobType> = ({ allCompanies, filters, job }) => {
  const [formValues, setFormValues] = useState<FormValues>({
    title: job.title,
    company: { label: job.company.name, value: job.companyId },
    link: job.applicationUrl,
    category: { label: job.category, value: job.category },
    region: { label: job.region, value: job.region },
    seniority: { label: job.seniority, value: job.seniority },
    body: job.description,
  });
  const [isLoading, setIsLoading] = useState(false);

  const { push } = useRouter();

  const handleSelectChange = (field: keyof FormValues, value: { value: string; label: string; href?: string }) => {
    if (value?.href) {
      push(value.href);
    } else {
      setFormValues((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleInputChange = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const finalValue = {
      title: formValues.title,
      description: formValues.body,
      companyId: formValues.company!.value,
      applicationUrl: formValues.link,
      category: formValues.category!.label,
      region: formValues.region!.label,
      seniority: formValues.seniority!.label,
      slug: job.slug,
    };
    const checkAllValues = Object.entries(finalValue).filter(([key, value]) => !value);
    if (isLoading) return;
    if (checkAllValues.length > 1) {
      toast.error(`fill all required details: ${checkAllValues.map(([key, val]) => key).join(", ")}`);
    } else {
      setIsLoading(true);
      toast.info("Creating new Job...", { autoClose: 300 });

      try {
        const response = await updateOneJob(job.id, finalValue);

        const data = response.data;

        toast.success("Job updated successfully!", {
          position: "bottom-right",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "dark",
        });
        push("/heroshima/jobs/" + data.slug);
      } catch (error: any) {
        toast.error(`Failed to create job: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="w-full h-screen overflow-y-scroll ">
      {isLoading ? <OverlayLoader /> : null}

      <main className="p-4 mb-4">
        <h1 className="text-2xl font-bold mb-4">Update Job</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField
            label="Job Title"
            value={formValues.title}
            onChange={handleInputChange("title")}
            placeholder="Enter job title"
            required
          />

          <TextField
            label="Link to Job"
            value={formValues.link}
            onChange={handleInputChange("link")}
            placeholder="Enter job link"
            required
            type="url"
          />

          <SelectField
            label="Company"
            value={formValues.company}
            options={[GenerateNewOption("Company", "/heroshima/companies/create"), ...allCompanies]}
            onChange={(value) => handleSelectChange("company", value)}
            placeholder="Select company"
            required
          />

          <SelectField
            label="Category"
            value={formValues.category}
            options={[GenerateNewOption("Category", "/heroshima/filters"), ...filters.category]}
            onChange={(value) => handleSelectChange("category", value)}
            placeholder="Select category"
            required
          />

          <SelectField
            label="Region"
            value={formValues.region}
            options={[GenerateNewOption("Region", "/heroshima/filters"), ...filters.region]}
            onChange={(value) => handleSelectChange("region", value)}
            placeholder="Select region"
            required
          />

          <SelectField
            label="Seniority"
            value={formValues.seniority}
            options={[GenerateNewOption("Seniority", "/heroshima/filters"), ...filters.seniority]}
            onChange={(value) => handleSelectChange("seniority", value)}
            placeholder="Select seniority"
            required
          />

          <div>
            <label className="block text-sm font-medium text-primary">Job Description</label>
            <ReactQuill
              value={formValues.body}
              onChange={(value) => setFormValues((prev) => ({ ...prev, body: value }))}
              placeholder="Enter job description"
              className="mt-1"
            />
          </div>

          <div className="flex justify-center ">
            <button
              type="submit"
              className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm group p-3 hover:rounded-md">
              <PlusCircle className="w-6 h-6 mr-2 group-hover:scale-90 transition-all" />
              Update Job
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default UpdateJob;
