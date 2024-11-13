"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { PlusCircle } from "lucide-react";
import "react-quill/dist/quill.snow.css";
import Select from "react-select";
import { useRouter } from "next/navigation";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

interface Option {
  value: string;
  label: string;
  href?: string;
}

type Setter = (value: Option | null) => void;

const options = {
  companies: [
    { value: "Tech Corp", label: "Tech Corp" },
    { value: "Innovate Ltd", label: "Innovate Ltd" },
    { value: "addCompany", label: "Add Company", href: "/heroshima/company/create" },
  ],
  sectors: [
    { value: "Technology", label: "Technology" },
    { value: "Finance", label: "Finance" },
    { value: "addSector", label: "Add Sector", href: "/heroshima/categories" },
  ],
  roleTypes: [
    { value: "Full-time", label: "Full-time" },
    { value: "Part-time", label: "Part-time" },
    { value: "addRoleType", label: "Add Role Type", href: "/heroshima/categories" },
  ],
  seniorities: [
    { value: "Junior", label: "Junior" },
    { value: "Senior", label: "Senior" },
    { value: "addSeniority", label: "Add Seniority", href: "/heroshima/categories" },
  ],
};

export default function CreateJob() {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState(null);
  const [link, setLink] = useState("");
  const [sector, setSector] = useState(null);
  const [roleType, setRoleType] = useState(null);
  const [seniority, setSeniority] = useState(null);
  const [body, setBody] = useState("");

  const { push } = useRouter();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSelectChange = (setter: any, options: Option[], value: any) => {
    if (value.href) {
      push(value.href);
    } else {
      setter(value);
    }
  };

  interface FormValues {
    title: string;
    company: Option | null;
    link: string;
    sector: Option | null;
    roleType: Option | null;
    seniority: Option | null;
    body: string;
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formValues: FormValues = { title, company, link, sector, roleType, seniority, body };
    // Handle form submission
    console.log(formValues);
  };

  return (
    <div className="w-full h-screen overflow-y-scroll">
      <main className="p-4">
        <h1 className="text-2xl font-bold mb-4">Create New Job</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary">Job Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter job title"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary">Company</label>
            <Select
              theme={(theme) => ({
                ...theme,
                borderRadius: 6,
                colors: {
                  ...theme.colors,
                  primary25: "#e5e5e5",
                  primary: "black",
                },
              })}
              value={company}
              onChange={(value) => handleSelectChange(setCompany, options.companies, value)}
              options={options.companies}
              placeholder="Select company"
              className="mt-1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary">Link to Job</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Enter job link"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary">Sector</label>
            <Select
              theme={(theme) => ({
                ...theme,
                borderRadius: 6,
                colors: {
                  ...theme.colors,
                  primary25: "#e5e5e5",
                  primary: "black",
                },
              })}
              value={sector}
              onChange={(value) => handleSelectChange(setSector, options.sectors, value)}
              options={options.sectors}
              placeholder="Select sector"
              className="mt-1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary">Role Type</label>
            <Select
              theme={(theme) => ({
                ...theme,
                borderRadius: 6,
                colors: {
                  ...theme.colors,
                  primary25: "#e5e5e5",
                  primary: "black",
                },
              })}
              value={roleType}
              onChange={(value) => handleSelectChange(setRoleType, options.roleTypes, value)}
              options={options.roleTypes}
              placeholder="Select role type"
              className="mt-1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary">Seniority</label>
            <Select
              theme={(theme) => ({
                ...theme,
                borderRadius: 6,
                colors: {
                  ...theme.colors,
                  primary25: "#e5e5e5",
                  primary: "black",
                },
              })}
              value={seniority}
              onChange={(value) => handleSelectChange(setSeniority, options.seniorities, value)}
              options={options.seniorities}
              placeholder="Select seniority"
              className="mt-1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-primary">Job Description</label>
            <ReactQuill value={body} onChange={setBody} placeholder="Enter job description" className="mt-1" />
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
}
