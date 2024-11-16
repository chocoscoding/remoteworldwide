"use client";
import { useState, useEffect } from "react";
import { Menu, Home, Briefcase, Building, List, User, LogOut, ChevronDown, Book } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const menuItems = [
  { name: "Home", icon: Home, path: "/", section: "home" },
  {
    name: "Company",
    icon: Building,
    path: "/companies",
    section: "companies",
    subItems: [
      { label: "Create compnay", path: "/companies/create" },
      { label: "Companies", path: "/companies" },
    ],
  },
  {
    name: "Job",
    icon: Briefcase,
    path: "/jobs",
    section: "jobs",
    subItems: [
      { label: "Create Job", path: "/jobs/create" },
      { label: "Jobs", path: "/jobs" },
      { label: "Inactive", path: "/jobs/inactive" },
    ],
  },
  {
    name: "Categories",
    icon: List,
    path: "/categories",
    section: "categories",
  },
  {
    name: "Blogs",
    icon: Book,
    path: "/blogs",
    section: "blog",
    subItems: [
      { label: "Create Blog", path: "/blogs/create" },
      { label: "Create Author", path: "/authors/create" },
      { label: "Blogs", path: "/blogs" },
      { label: "Authors", path: "/blogs/authors" },
    ],
  },
];

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string>("home");
  const pathname = usePathname();

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleAccordion = (section: string) => setOpenAccordion(openAccordion === section ? "home" : section);

  useEffect(() => setIsOpen(false), [pathname]);

  const isActive = (route: string) => pathname === "/heroshima" + route;

  return (
    <div className={`flex flex-col h-screen bg-gray-900 text-white ${isOpen ? "w-64" : "w-16"} transition-width duration-300 sticky top-0`}>
      <div className={`flex items-center ${isOpen ? "justify-between" : "justify-center"} p-4 bg-gray-900 border-b border-b-white/10`}>
        {isOpen && <div className="text-lg font-bold">WWR</div>}
        <button onClick={toggleSidebar} className="focus:outline-none">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <div className={`flex-1 p-4 space-y-4 flex flex-col gap-4 ${isOpen ? "" : "items-center"}`}>
        {menuItems.map((item) => {
          if (!item.subItems) {
            return (
              <Link key={item.section} href={`/heroshima${item.path}`} className={`space-y-1 ${isOpen ? "w-full" : "w-fit"}`}>
                <div
                  className={`flex items-center justify-between cursor-pointer ${
                    openAccordion === item.section ? "text-secondary" : "text-gray-300"
                  }`}
                  onClick={() => toggleAccordion(item.section)}>
                  <div className="flex items-center space-x-4">
                    <item.icon className="w-5 h-5" />
                    {isOpen && <span>{item.name}</span>}
                  </div>
                </div>
              </Link>
            );
          }
          return (
            <div key={item.section} className={`space-y-1 ${isOpen ? "w-full" : "w-fit"}`}>
              <div
                className={`flex items-center justify-between cursor-pointer ${
                  openAccordion === item.section ? "text-secondary" : "text-gray-300"
                }`}
                onClick={() => toggleAccordion(item.section)}>
                <div className="flex items-center space-x-4">
                  <item.icon onClick={() => setIsOpen(true)} className="w-5 h-5" />
                  {isOpen && <span>{item.name}</span>}
                </div>
                {isOpen && item.subItems && (
                  <ChevronDown className={`transition-all duration-500 w-5 h-5 ${openAccordion === item.section ? "rotate-180" : ""}`} />
                )}
              </div>
              {isOpen && item.subItems && (
                <ul
                  className={`pl-10 space-y-1 overflow-hidden transition-all duration-500 ${
                    isOpen && openAccordion === item.section ? "max-h-screen" : "max-h-0"
                  }`}>
                  {item.subItems.map((subItem, index) => (
                    <Link key={index} href={`/heroshima${subItem.path}`}>
                      <li className="mt-2 mb-2">{subItem.label}</li>
                    </Link>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-gray-900">
        <div className={`flex items-center space-x-4 ${isActive("/user") ? "text-secondary" : "text-gray-300"}`}>
          <User className="w-5 h-5" />
          {isOpen && <span>User</span>}
        </div>
        <div className={`flex items-center space-x-4 mt-4 ${isActive("/logout") ? "text-secondary" : "text-gray-300"}`}>
          <LogOut className="w-5 h-5" />
          {isOpen && <span>Logout</span>}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
