import { Option } from "@/types/main";
import { FC, forwardRef } from "react";
import Select, { ActionMeta, MultiValue, SingleValue, createFilter } from "react-select";

/**
 * Options carrying an `href` are the "Add new …" shortcuts at the top of each
 * select. They're painted green so they read as an action rather than as one
 * more thing to pick, and they survive filtering — typing a company that
 * doesn't exist yet is exactly when you need the shortcut.
 */
// The design system's green family: brand lime for the hovered row, the deeper
// lime for the press, and the olive/tint pair used everywhere else for green
// text on a light surface.
const ADD_NEW_GREEN = "#e1f073";
const ADD_NEW_GREEN_DARK = "#cddd54";
const ADD_NEW_GREEN_TINT = "#f6faea";
const ADD_NEW_GREEN_TEXT = "#6c7a1e";
const ADD_NEW_GREEN_ON_GREEN = "#222325";

const isAddNewOption = (option: any) => Boolean(option?.href);

const defaultFilter = createFilter<any>();

const addNewOptionStyles = {
  option: (base: any, state: any) => {
    if (!isAddNewOption(state.data)) return base;
    return {
      ...base,
      backgroundColor: state.isFocused ? ADD_NEW_GREEN : ADD_NEW_GREEN_TINT,
      color: state.isFocused ? ADD_NEW_GREEN_ON_GREEN : ADD_NEW_GREEN_TEXT,
      fontWeight: 700,
      cursor: "pointer",
      ":active": {
        ...(base as any)[":active"],
        backgroundColor: ADD_NEW_GREEN_DARK,
        color: ADD_NEW_GREEN_ON_GREEN,
      },
    };
  },
};

interface SelectFieldProps {
  label: string;
  value: Option | Option[] | null;
  options: { value: string; label: string; href?: string }[];
  onChange: (value: MultiValue<Option> | SingleValue<Option>, actionMeta: ActionMeta<Option>) => void;
  placeholder: string;
  required?: boolean;
  isMulti?: boolean;
  theme?: any;
  isOptionDisabled?: (option: any, selectValue: any) => boolean;
}

export const SelectField = forwardRef<any, SelectFieldProps>(
  ({ label, value, options, onChange, placeholder, required, isMulti, theme, isOptionDisabled }, ref) => (
    <div>
      <label className="block text-sm font-medium text-primary">{label}</label>
      <Select
        ref={ref}
        value={value}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
        theme={theme || ((theme) => ({ ...theme, borderRadius: 6, colors: { ...theme.colors, primary25: "#e5e5e5", primary: "black" } }))}
        styles={addNewOptionStyles}
        filterOption={(option, input) => isAddNewOption(option.data) || defaultFilter(option, input)}
        className="mt-1"
        required={required}
        isMulti={isMulti}
        isOptionDisabled={isOptionDisabled}
      />
    </div>
  ),
);

SelectField.displayName = "SelectField";

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
