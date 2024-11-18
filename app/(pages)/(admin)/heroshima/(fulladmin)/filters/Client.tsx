"use client";
import { FC, useState } from "react";
import CategorySection from "./CategorySection";
import { Categories, FilterData, FilterType, Option } from "@/types/main";

const initialCategories: Categories = {
  companies: [
    { value: "Tech Corp", label: "Tech Corp" },
    { value: "Innovate Ltd", label: "Innovate Ltd" },
  ],
  sectors: [
    { value: "Technology", label: "Technology" },
    { value: "Finance", label: "Finance" },
  ],
  roleTypes: [
    { value: "Full-time", label: "Full-time" },
    { value: "Part-time", label: "Part-time" },
  ],
};

const FiltersClient: FC<{ initialData: FilterData }> = ({ initialData }) => {
  const [categories, setCategories] = useState<FilterData>(initialData);

  const addCategory = async (section: keyof FilterData, newCategory: FilterType) => {
    // Simulate API call
    // Replace this with your actual API request
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        // Simulate success
        setCategories((prevCategories) => ({
          ...prevCategories,
          [section]: [...prevCategories[section], newCategory],
        }));
        resolve();
        // To simulate an error, uncomment the following line:
        // reject(new Error("Failed to add category"));
      }, 1000);
    });
  };

  return (
    <div className="w-full h-screen overflow-y-scroll p-4">
      <h1 className="text-2xl font-bold mb-6">Manage Filters</h1>

      {/* Render each category section */}
      {Object.keys(categories).map((sectionKey) => (
        <CategorySection
          key={sectionKey}
          section={sectionKey as keyof FilterData}
          categories={categories[sectionKey as keyof FilterData]}
          onAddCategory={addCategory}
          // sectionTitle={''}
        />
      ))}
    </div>
  );
};

export default FiltersClient;
