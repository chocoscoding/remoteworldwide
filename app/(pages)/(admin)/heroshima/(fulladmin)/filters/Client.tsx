"use client";
import { FC, useState } from "react";
import CategorySection from "./CategorySection";
import { FilterData, FilterType } from "@/types/main";

const FiltersClient: FC<{ initialData: FilterData }> = ({ initialData }) => {
  const [categories, setCategories] = useState<FilterData>(initialData);

  const addCategory = async (section: keyof FilterData, newCategory: FilterType) => {
    console.log(section, newCategory);
    try {
      const response = await fetch("/api/filters/" + section, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newCategory.label }),
      });

      if (!response.ok) {
        throw new Error("Failed to save category");
      }
      const result = await response.json();
      console.log(result);

      setCategories((prevCategories) => ({
        ...prevCategories,
        [section]: [...prevCategories[section], { label: result.data.name, value: result.data.id }],
      }));
    } catch (error) {
      throw new Error("Error saving category");
    }
  };

  return (
    <div className="w-full h-screen overflow-y-scroll p-4">
      <h1 className="text-2xl font-bold mb-6">Manage Filters</h1>
      {Object.keys(categories).map((sectionKey) => {
        return (
          <CategorySection
            key={sectionKey}
            section={sectionKey as keyof FilterData}
            categories={categories[sectionKey as keyof FilterData]}
            onAddCategory={addCategory}
            // sectionTitle={''}
          />
        );
      })}
    </div>
  );
};

export default FiltersClient;
