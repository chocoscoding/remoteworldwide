"use client";
import { FC, useState } from "react";
import dynamic from "next/dynamic";
import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { SelectField, TextField } from "@/app/components/inputs";
import { FilterData, FilterType, FormValues, Option } from "@/types/main";
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

const hasHref = (option: Option) => Boolean(option.href);

const dedupeByLabel = (options: Option[]) => Array.from(new Map(options.map((item) => [item.label, item])).values());

const getRegionOptions = (regions: Option[], selected: Option[]) => [
  GenerateNewOption("Region", "/heroshima/filters"),
  ...regions.filter((region) => !selected.some((s) => s.label === region.label)),
];

const UpdateJob: FC<UpdateJobType> = ({ allCompanies, filters, job }) => {
  const [formValues, setFormValues] = useState<FormValues>({
    title: job.title,
    company: { label: job.company.name, value: job.companyId },
    link: job.applicationUrl,
    category: { label: job.category, value: job.category },
    region: job.region.map((value) => ({ label: value, value })),
    seniority: { label: job.seniority, value: job.seniority },
    body: job.description,
  });
  const [isLoading, setIsLoading] = useState(false);

  const { push } = useRouter();

  const handleSingleSelectChange = (field: "company" | "category" | "seniority", value: Option | null) => {
    if (value?.href) {
      push(value.href);
    } else {
      setFormValues((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleRegionChange = (value: Option[] | null) => {
    if (!value) {
      setFormValues((prev) => ({ ...prev, region: [] }));
      return;
    }

    const hrefOption = value.find(hasHref);
    if (hrefOption?.href) {
      push(hrefOption.href);
    }

    const filtered = value.filter((option) => !option.href);
    setFormValues((prev) => ({ ...prev, region: dedupeByLabel(filtered) }));
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
      region: formValues.region.map((option) => option.label),
      seniority: formValues.seniority!.label,
      slug: job.slug,
    };
    const regionValues = new Set(finalValue.region);
    const hasDuplicateRegions = regionValues.size !== finalValue.region.length;

    const checkAllValues = [
      !finalValue.title && "title",
      !finalValue.description && "description",
      !finalValue.companyId && "companyId",
      !finalValue.applicationUrl && "applicationUrl",
      !finalValue.category && "category",
      finalValue.region.length === 0 && "region",
      !finalValue.seniority && "seniority",
      hasDuplicateRegions && "duplicate regions",
    ].filter(Boolean) as string[];
    if (isLoading) return;
    if (checkAllValues.length > 0) {
      toast.error(`fill all required details: ${checkAllValues.join(", ")}`);
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
            onChange={(value) => handleSingleSelectChange("company", value as Option | null)}
            placeholder="Select company"
            required
          />

          <SelectField
            label="Category"
            value={formValues.category}
            options={[GenerateNewOption("Category", "/heroshima/filters"), ...filters.category]}
            onChange={(value) => handleSingleSelectChange("category", value as Option | null)}
            placeholder="Select category"
            required
          />

          <SelectField
            label="Region"
            value={formValues.region}
            options={getRegionOptions(filters.region, formValues.region)}
            onChange={(value) => handleRegionChange(value as Option[] | null)}
            placeholder="Select region(s)"
            required
            isMulti
          />

          <SelectField
            label="Seniority"
            value={formValues.seniority}
            options={[GenerateNewOption("Seniority", "/heroshima/filters"), ...filters.seniority]}
            onChange={(value) => handleSingleSelectChange("seniority", value as Option | null)}
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
