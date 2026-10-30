"use client";
import { FC, useState } from "react";
import CategorySection from "./CategorySection";
import { FilterData, FilterType } from "@/types/main";
import { useRouter } from "next/navigation";
import { createFilter, deleteFilter } from "@/libs/query";

const FiltersClient: FC<{ initialData: FilterData }> = ({ initialData }) => {
  const [categories, setCategories] = useState<FilterData>(initialData);
  const router = useRouter();
  const addCategory = async (section: keyof FilterData, newCategory: FilterType) => {
    try {
      const result = await createFilter(section, newCategory.label);

      if ("error" in result) {
        throw new Error(result.error);
      }

      setCategories((prevCategories) => ({
        ...prevCategories,
        [section]: [...prevCategories[section], { label: result.data.name, value: result.data.id }],
      }));

      router.refresh();
    } catch {
      throw new Error("Error saving this filter");
    }
  };
  const removeCategory = async (section: keyof FilterData, categoryId: string) => {
    try {
      const result = await deleteFilter(section, categoryId);

      if ("error" in result) {
        throw new Error(result.error);
      }

      setCategories((prevCategories) => ({
        ...prevCategories,
        [section]: prevCategories[section].filter((category) => category.value !== categoryId),
      }));
      router.refresh();
    } catch {
      throw new Error("Error deleting this filter");
    }
  };

  return (
    <div className="w-full p-4">
      <h1 className="text-2xl font-bold mb-6">Manage Filters</h1>
      {Object.keys(categories).map((sectionKey) => {
        return (
          <CategorySection
            key={sectionKey}
            section={sectionKey as keyof FilterData}
            categories={categories[sectionKey as keyof FilterData]}
            onAddCategory={addCategory}
            onRemoveCategory={removeCategory}
          />
        );
      })}
    </div>
  );
};

export default FiltersClient;
