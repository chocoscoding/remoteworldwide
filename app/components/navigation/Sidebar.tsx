"use client";
import { useState, useEffect, useMemo } from "react";
import { Menu, Home, Briefcase, Building, List, User, LogOut, ChevronDown, Book, Globe, LoaderCircle, BotIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { signOut } from "@/app/lib/authClient";

type SubItem = { label: string; path: string; disabled?: boolean; hint?: string };
type MenuItem = { name: string; icon: typeof Home; path: string; section: string; subItems?: SubItem[] };

const NO_PROFILE_HINT = "Create your author profile first";

const blogSubItems = (role: "ADMIN" | "AUTHOR", hasProfile: boolean): SubItem[] => [
  { label: "Create Blog", path: "/blogs/create", disabled: !hasProfile, hint: NO_PROFILE_HINT },
  { label: "Blogs", path: "/blogs" },
  hasProfile ? { label: "My profile", path: "/profile" } : { label: "Create my author profile", path: "/profile" },
  ...(role === "ADMIN" ? [{ label: "Authors", path: "/authors" }] : []),
  { label: "Conversions", path: "/conversions" },
  ...(role === "ADMIN" ? [{ label: "Blog settings", path: "/blog-settings" }, { label: "Subscribers", path: "/subscribers" }] : []),
];

const menuItemsForAdmin: MenuItem[] = [
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
  },
  {
    name: "Automation",
    icon: BotIcon,
    path: "/automation",
    section: "automation",
  },
];
const menuItemsForAuthor: MenuItem[] = [
  { name: "Home", icon: Home, path: "/", section: "home" },
  { name: "Blogs", icon: Book, path: "/blogs", section: "blog" },
];

const withBlogSubItems = (items: MenuItem[], role: "ADMIN" | "AUTHOR", hasProfile: boolean): MenuItem[] =>
  items.map((item) => (item.section === "blog" ? { ...item, subItems: blogSubItems(role, hasProfile) } : item));

const Sidebar = ({ hasAuthorProfile }: { hasAuthorProfile: boolean }) => {
  const { data: userData, status } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string>("home");
  const pathname = usePathname();
  const { push, replace } = useRouter();
  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleAccordion = (section: string) => setOpenAccordion(openAccordion === section ? "home" : section);

  useEffect(() => {
    setIsOpen(false);
    if (pathname.includes("/authors") || pathname.includes("/profile")) {
      setOpenAccordion("blog");
    } else if (pathname.includes("/conversions") || pathname.includes("/blog-settings") || pathname.includes("/subscribers")) {
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
    const role = userData?.user?.role;
    if (role === "ADMIN") return withBlogSubItems(menuItemsForAdmin, role, hasAuthorProfile);
    if (role === "AUTHOR") return withBlogSubItems(menuItemsForAuthor, role, hasAuthorProfile);
    return [];
  }, [userData, hasAuthorProfile]);

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
                    {item.subItems.map((subItem) =>
                      subItem.disabled ? (
                        <li key={subItem.path} aria-disabled="true" title={subItem.hint} className="mt-2 mb-2 cursor-not-allowed select-none text-gray-500">
                          {subItem.label}
                          {subItem.hint && <span className="block text-[10px] leading-tight text-gray-500/80">{subItem.hint}</span>}
                        </li>
                      ) : (
                        <Link key={subItem.path} href={`/heroshima${subItem.path}`}>
                          <li className="mt-2 mb-2">{subItem.label}</li>
                        </Link>
                      ),
                    )}
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
