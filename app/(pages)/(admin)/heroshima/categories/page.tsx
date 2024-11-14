// CategoriesPage.tsx
"use client";
import { useState } from "react";
import { PlusCircle, XCircle } from "lucide-react";
import Select from "react-select";
import CategorySection from "./CategorySection";

interface Option {
  value: string;
  label: string;
}

export interface Categories {
  companies: Option[];
  sectors: Option[];
  roleTypes: Option[];
}

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

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Categories>(initialCategories);

  const addCategory = async (section: keyof Categories, newCategory: Option) => {
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
      <h1 className="text-2xl font-bold mb-6">Manage Categories</h1>

      {/* Render each category section */}
      {Object.keys(categories).map((sectionKey) => (
        <CategorySection
          key={sectionKey}
          section={sectionKey as keyof Categories}
          categories={categories[sectionKey as keyof Categories]}
          onAddCategory={addCategory}
        />
      ))}
    </div>
  );
}
