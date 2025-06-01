"use client";
import { useState, useEffect, useMemo } from "react";
import { Menu, Home, Briefcase, Building, List, User, LogOut, ChevronDown, Book, Globe, LoaderCircle, BotIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

const menuItemsForAdmin = [
  { name: "Home", icon: Home, path: "/", section: "home" },
  {
    name: "Company",
    icon: Building,
    path: "/companies",
    section: "companies",
    subItems: [
      { label: "Create company", path: "/companies/create" },
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
      { label: "All Jobs", path: "/jobs" },
      { label: "Inactive Jobs", path: "/jobs/inactive" },
    ],
  },
  {
    name: "Filters",
    icon: List,
    path: "/filters",
    section: "filters",
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
      { label: "Authors", path: "/authors" },
    ],
  },
  {
    name: "Automation",
    icon: BotIcon,
    path: "/automation",
    section: "automation",
  },
];
const menuItemsForAuthor = [
  { name: "Home", icon: Home, path: "/", section: "home" },
  {
    name: "Blogs",
    icon: Book,
    path: "/blogs",
    section: "blog",
    subItems: [
      { label: "Create Blog", path: "/blogs/create" },
      { label: "Create Author", path: "/authors/create" },
      { label: "Blogs", path: "/blogs" },
      { label: "Authors", path: "/authors" },
    ],
  },
];

const Sidebar = () => {
  const { data: userData, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string>("home");
  const pathname = usePathname();
  const { push, replace } = useRouter();
  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleAccordion = (section: string) => setOpenAccordion(openAccordion === section ? "home" : section);

  useEffect(() => {
    setIsOpen(false);
    if (pathname.includes("/authors")) {
      setOpenAccordion("blog");
    } else if (pathname.includes("/blogs")) {
      setOpenAccordion("blog");
    } else if (pathname.includes("/jobs")) {
      setOpenAccordion("jobs");
    } else if (pathname.includes("/filters")) {
      setOpenAccordion("filters");
    } else if (pathname.includes("/companies")) {
      setOpenAccordion("companies");
    } else {
      setOpenAccordion("home");
    }
  }, [pathname]);

  const isActive = (route: string) => pathname === "/heroshima" + route;

  const menuItems = useMemo(() => {
    if (userData?.user?.role === "ADMIN") return menuItemsForAdmin;
    if (userData?.user?.role === "AUTHOR") return menuItemsForAuthor;
    else return [];
  }, [userData]);

  return (
    <div className={`flex flex-col h-screen bg-primary text-white ${isOpen ? "w-64" : "w-16"} transition-width duration-300 sticky top-0`}>
      <div className={`flex items-center ${isOpen ? "justify-between" : "justify-center"} p-4 bg-primary border-b border-b-white/10`}>
        {isOpen && <div className="text-lg font-bold">WWR</div>}
        <button onClick={toggleSidebar} className="focus:outline-none">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {status === "loading" ? (
        <>
          <div className="h-full flex justify-center">
            <LoaderCircle className=" animate-spin mt-3" />
          </div>
        </>
      ) : (
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
      )}

      <div className="p-4 bg-primary">
        <Link href={"/"} className={`flex items-center space-x-4 ${isActive("/user") ? "text-secondary" : "text-gray-300"}`}>
          <Globe className="w-5 h-5" />
          {isOpen && <span>Main Website</span>}
        </Link>
        <div className={`flex items-center space-x-4 mt-4 ${isActive("/user") ? "text-secondary" : "text-gray-300"}`}>
          <User className="w-5 h-5" />
          {isOpen && <span>User</span>}
        </div>
        <div
          className={`flex items-center space-x-4 mt-4 cursor-pointer hover:text-white ${
            isActive("/logout") ? "text-secondary" : "text-gray-300"
          }`}
          onClick={async () => {
            await signOut();
            replace("/", {});
          }}>
          <LogOut className="w-5 h-5" />
          {isOpen && <span>Logout</span>}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
