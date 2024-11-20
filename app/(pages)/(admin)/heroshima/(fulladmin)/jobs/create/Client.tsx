"use client";
import { FC, useState } from "react";
import dynamic from "next/dynamic";
import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { SelectField, TextField } from "@/app/components/inputs";
import { FilterData, FilterType, Option } from "@/types/main";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

interface FormValues {
  title: string;
  company: Option | null;
  link: string;
  category: Option | null;
  region: Option | null;
  job_type: Option | null;
  seniority: Option | null;
  body: string;
}

const GenerateNewOption = (title: string, href: string) => ({
  value: "add new",
  label: `Add new ${title}`,
  href,
});

const CreateJob: FC<{ allCompanies: FilterType[]; filters: FilterData }> = ({ allCompanies, filters }) => {
  const [formValues, setFormValues] = useState<FormValues>({
    title: "",
    company: null,
    link: "",
    category: null,
    region: null,
    job_type: null,
    seniority: null,
    body: "",
  });

  const router = useRouter();

  const handleSelectChange = (field: keyof FormValues, value: { value: string; label: string; href?: string }) => {
    if (value?.href) {
      router.push(value.href);
    } else {
      setFormValues((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleInputChange = (field: keyof FormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log(formValues);
    // Handle form submission
  };

  return (
    <div className="w-full h-screen overflow-y-scroll">
      <main className="p-4">
        <h1 className="text-2xl font-bold mb-4">Create New Job</h1>
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
            options={[...allCompanies, GenerateNewOption("Company", "/heroshima/companies/create")]}
            onChange={(value) => handleSelectChange("company", value)}
            placeholder="Select company"
            required
          />

          <SelectField
            label="Category"
            value={formValues.category}
            options={[...filters.category, GenerateNewOption("Category", "/heroshima/filters")]}
            onChange={(value) => handleSelectChange("category", value)}
            placeholder="Select category"
            required
          />

          <SelectField
            label="Region"
            value={formValues.region}
            options={[...filters.region, GenerateNewOption("Region", "/heroshima/filters")]}
            onChange={(value) => handleSelectChange("region", value)}
            placeholder="Select region"
            required
          />

          <SelectField
            label="Job Type"
            value={formValues.job_type}
            options={[...filters.job_type, GenerateNewOption("Job Type", "/heroshima/filters")]}
            onChange={(value) => handleSelectChange("job_type", value)}
            placeholder="Select job type"
            required
          />

          <SelectField
            label="Seniority"
            value={formValues.seniority}
            options={[...filters.seniority, GenerateNewOption("Seniority", "/heroshima/filters")]}
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

          <div className="flex justify-center">
            <button
              type="submit"
              className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3">
              <PlusCircle className="w-6 h-6 mr-2" />
              Create Job
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default CreateJob;
