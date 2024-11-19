// CategorySection.tsx
"use client";
import { useState } from "react";
import Select, { components, GroupBase, OptionProps } from "react-select";
import { PlusCircle, Trash } from "lucide-react";
import { toast } from "react-toastify";
import { FilterData, FilterType } from "@/types/main";

interface CategorySectionProps {
  section: string;
  categories: FilterType[];
  onAddCategory: (section: keyof FilterData, newCategory: FilterType) => Promise<void>;
  onRemoveCategory: (section: keyof FilterData, categoryId: string) => Promise<void>;
}

const Option = (setter: (categoryId: string) => Promise<void>, props: OptionProps<FilterType, false, GroupBase<FilterType>>) => {
  return (
    <div className="w-full pr-4 flex items-center gap-2 flex-row-reverse">
      <Trash className="text-red-300 peer hover:text-red-600 cursor-pointer" onClick={() => setter(props.data.value)} />
      <components.Option {...props} className=" peer-hover:text-red-500" />
    </div>
  );
};
export default function CategorySection({ section, categories, onAddCategory, onRemoveCategory }: CategorySectionProps) {
  const [newCategory, setNewCategory] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // const Delete;

  const handleAdd = async () => {
    if (!newCategory.trim()) return;
    const doesExist = categories.filter((cate) => cate.label === newCategory);
    if (doesExist.length > 0) {
      toast.error(`${newCategory} already exist as a ${section.replace("_", " ")}`);
      return;
    }

    const trimmedCategory = newCategory.trim();
    const newOption: FilterType = { value: trimmedCategory, label: trimmedCategory };

    setIsLoading(true);
    toast.info(`Adding new ${section.replace("_", " ")}...`, { autoClose: 300 });

    try {
      await onAddCategory(section as keyof FilterData, newOption);
      toast(`➕ New ${section} added!`, {
        position: "bottom-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      setNewCategory("");
    } catch (error: any) {
      toast.error(`Failed to add ${section.replace("_", " ")}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    setIsLoading(true);
    toast.info(`Removing ${section.replace("_", " ")}...`, { autoClose: 300 });

    try {
      await onRemoveCategory(section as keyof FilterData, categoryId);
      toast(`🗑️ ${section} removed!`, {
        position: "bottom-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
    } catch (error: any) {
      toast.error(`Failed to remove ${section.replace("_", " ")}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setNewCategory("");
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-2 capitalize">{section.replace("_", " ")}</h2>

      {/* React Select Dropdown */}
      <Select
        options={categories}
        components={{ Option: (props) => Option(handleDelete, props) }}
        placeholder={`Select ${section.replace("_", " ")}`}
        className="w-full mb-2"
        theme={(theme) => ({
          ...theme,
          borderRadius: 6,
          colors: {
            ...theme.colors,
            primary25: "#e5e5e5",
            primary: "black",
          },
        })}
      />

      {/* Input field with Add and Clear icons */}
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          placeholder={`Add new ${section.replace("_", " ")}`}
          className="flex-1 border p-2 rounded outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={!newCategory.trim() || isLoading}
          className={`flex items-center justify-center p-2 rounded text-white ${
            !newCategory.trim() || isLoading ? "bg-gray-600 cursor-not-allowed" : "bg-black"
          }`}>
          <span className="mr-2">Add</span>
          <PlusCircle className="w-5 h-5" />
        </button>
        <button
          onClick={handleClear}
          disabled={!newCategory.trim()}
          className={`flex items-center justify-center p-2 rounded ${
            !newCategory.trim() ? "bg-gray-300 cursor-not-allowed" : "bg-red-500 hover:bg-red-600 text-white"
          }`}>
          Cancel
        </button>
      </div>
    </div>
  );
}
