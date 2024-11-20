import { Option } from "@/types/main";
import { FC } from "react";
import Select from "react-select";

interface SelectFieldProps {
  label: string;
  value: Option | null;
  options: { value: string; label: string; href?: string }[];
  onChange: (value: any) => void;
  placeholder: string;
  required?: boolean;
  theme?: any;
}

export const SelectField: FC<SelectFieldProps> = ({ label, value, options, onChange, placeholder, required, theme }) => (
  <div>
    <label className="block text-sm font-medium text-primary">{label}</label>
    <Select
      value={value}
      options={options}
      onChange={onChange}
      placeholder={placeholder}
      theme={theme || ((theme) => ({ ...theme, borderRadius: 6, colors: { ...theme.colors, primary25: "#e5e5e5", primary: "black" } }))}
      className="mt-1"
      required={required}
    />
  </div>
);

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
}

export const TextField: FC<TextFieldProps> = ({ label, value, onChange, placeholder, required, type = "text" }) => (
  <div>
    <label className="block text-sm font-medium text-primary">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
      required={required}
    />
  </div>
);
