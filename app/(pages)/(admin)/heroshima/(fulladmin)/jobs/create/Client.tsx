"use client";
import { FC, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { SelectField, TextField } from "@/app/components/inputs";
import { FilterData, FilterType, FormValues, Option } from "@/types/main";
import { toast } from "react-toastify";
import AIJobParser from "./AIJobParser";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

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

interface SelectRef {
  inputRef?: HTMLInputElement;
}

const CreateJob: FC<{ allCompanies: FilterType[]; filters: FilterData }> = ({ allCompanies, filters }) => {
  const [formValues, setFormValues] = useState<FormValues>({
    title: "",
    company: null,
    link: "",
    category: null,
    region: [],
    seniority: null,
    body: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  const companyRef = useRef<SelectRef>(null);
  const categoryRef = useRef<SelectRef>(null);
  const regionRef = useRef<SelectRef>(null);
  const seniorityRef = useRef<SelectRef>(null);

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

  const setReactInputValue = (input: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;

    if (setter) {
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  const simulateTyping = (selectRef: React.RefObject<SelectRef>, value: string) => {
    if (selectRef.current?.inputRef) {
      const input = selectRef.current.inputRef;
      setReactInputValue(input, value);
    }
  };

  const handleParseComplete = (parsedData: {
    jobTitle: string;
    jobLink: string;
    jobDescription: string;
    companyName: string;
    category: string;
    regions: string[];
    seniorityLevel: string;
  }) => {
    const { jobTitle, companyName, jobDescription, seniorityLevel, category, regions, jobLink } = parsedData;

    setFormValues((prev) => ({
      ...prev,
      title: jobTitle,
      link: jobLink,
      body: jobDescription,
    }));

    if (companyName) {
      setTimeout(() => simulateTyping(companyRef, companyName), 100);
    }

    if (category) {
      const matchingCategory = filters.category.find((c) => c.label === category);
      if (matchingCategory) {
        setFormValues((prev) => ({ ...prev, category: matchingCategory }));
      }
    }

    if (regions?.length) {
      const matchingRegions = filters.region.filter((r) => regions.includes(r.label));
      if (matchingRegions.length > 0) {
        setFormValues((prev) => ({ ...prev, region: matchingRegions }));
      }
    }

    if (seniorityLevel) {
      const matchingSeniority = filters.seniority.find((s) => s.label === seniorityLevel);
      if (matchingSeniority) {
        setFormValues((prev) => ({ ...prev, seniority: matchingSeniority }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const finalValue = {
      title: formValues.title,
      description: formValues.body,
      companyId: formValues.company?.value,
      applicationUrl: formValues.link,
      category: formValues.category?.label,
      region: formValues.region.map((option) => option.label),
      seniority: formValues.seniority?.label,
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
        const response = await fetch("/api/jobs", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(finalValue),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message);
        }

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
        push("/heroshima/jobs/" + data.data.slug);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create job";
        toast.error(`Failed to create job: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="w-full h-screen overflow-y-scroll">
      <main className="p-4 mb-3">
        <h1 className="text-2xl font-bold mb-4">Create New Job</h1>

        <AIJobParser filters={filters} allCompanies={allCompanies} onParseComplete={handleParseComplete} />

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-gray-300"></div>
          <span className="text-gray-500 font-medium">or create manually</span>
          <div className="flex-1 h-px bg-gray-300"></div>
        </div>

        {/* Manual Form */}
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
            ref={companyRef}
            label="Company"
            value={formValues.company}
            options={[GenerateNewOption("Company", "/heroshima/companies/create"), ...allCompanies]}
            onChange={(value) => handleSingleSelectChange("company", value as Option | null)}
            placeholder="Select company"
            required
          />

          <SelectField
            ref={categoryRef}
            label="Category"
            value={formValues.category}
            options={[GenerateNewOption("Category", "/heroshima/filters"), ...filters.category]}
            onChange={(value) => handleSingleSelectChange("category", value as Option | null)}
            placeholder="Select category"
            required
          />

          <SelectField
            ref={regionRef}
            label="Region"
            value={formValues.region}
            options={getRegionOptions(filters.region, formValues.region)}
            onChange={(value) => handleRegionChange(value as Option[] | null)}
            placeholder="Select region(s)"
            required
            isMulti
          />

          <SelectField
            ref={seniorityRef}
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

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isLoading}
              className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm group p-3 hover:rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
              <PlusCircle className="w-6 h-6 mr-2 group-hover:scale-90 transition-all" />
              {isLoading ? "Creating..." : "Create Job"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default CreateJob;
