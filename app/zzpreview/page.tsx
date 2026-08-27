"use client";
import { useState } from "react";
import { toast } from "react-toastify";
import CreateCompanyModal from "@/app/components/ADMIN/CreateCompanyModal";
import { SelectField } from "@/app/components/inputs";

export default function Preview() {
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState([
    { value: "1", label: "Acme" },
    { value: "2", label: "Globex" },
  ]);
  const [value, setValue] = useState<any>(null);

  return (
    <div className="p-8 space-y-4 max-w-xl">
      <SelectField
        label="Company"
        value={value}
        options={[{ value: "add new", label: "Add new Company", href: "/heroshima/companies/create" }, ...companies]}
        onChange={(v: any) => {
          if (v?.href) {
            setOpen(true);
            return;
          }
          setValue(v);
        }}
        placeholder="Select company"
      />
      <button id="fire-toast" className="border p-2" onClick={() => toast.error("toast visible above modal?")}>
        fire toast
      </button>
      <p id="selected">selected: {value ? value.label : "none"}</p>
      <p id="count">options: {companies.length}</p>
      <CreateCompanyModal
        open={open}
        onOpenChange={setOpen}
        onCreated={(c: any) => {
          setCompanies((p) => [{ value: c.id, label: c.name }, ...p]);
          setOpen(false);
        }}
      />
    </div>
  );
}
