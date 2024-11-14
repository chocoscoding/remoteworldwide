// CategorySection.tsx
"use client";
import { useState } from "react";
import Select from "react-select";
import { PlusCircle, XCircle } from "lucide-react";
import { toast, Bounce } from "react-toastify";

interface Option {
  value: string;
  label: string;
}

interface CategorySectionProps {
  section: string;
  categories: Option[];
  onAddCategory: (section: keyof Categories, newCategory: Option) => Promise<void>;
}

export default function CategorySection({ section, categories, onAddCategory }: CategorySectionProps) {
  const [newCategory, setNewCategory] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleAdd = async () => {
    if (!newCategory.trim()) return;

    const trimmedCategory = newCategory.trim();
    const newOption: Option = { value: trimmedCategory, label: trimmedCategory };

    setIsLoading(true);
    toast.info(`Adding new ${section.slice(0, -1)}...`, { autoClose: 300 });

    try {
      await onAddCategory(section as keyof Categories, newOption);
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
    } catch (error: unknown) {
      toast.error(`Failed to add ${section.slice(0, -1)}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setNewCategory("");
  };

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold mb-2 capitalize">{section}</h2>

      {/* React Select Dropdown */}
      <Select
        options={categories}
        placeholder={`Select ${section.slice(0, -1)}`}
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
          placeholder={`Add new ${section.slice(0, -1)}`}
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
