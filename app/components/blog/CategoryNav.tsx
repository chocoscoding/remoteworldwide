import type { FC } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { BlogCategory } from "@/app/lib/blog/categories";

const CategoryNav: FC<{ categories: (BlogCategory & { count: number })[]; active: string | null; className?: string }> = ({ categories, active, className }) => {
  const chip = (isActive: boolean) =>
    cn(
      "inline-flex flex-none items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 text-sm font-bold transition-colors whitespace-nowrap",
      isActive ? "border-primary bg-primary text-secondary" : "border-primary/15 bg-white text-primary hover:border-primary",
    );
  return (
    <nav aria-label="Categories" className={cn("-mx-4 overflow-x-auto px-4 scrollbar-none", className)}>
      <ul className="flex items-center gap-2">
        <li>
          <Link href="/blogs" className={chip(active === null)}>
            All
          </Link>
        </li>
        {categories
          .filter((c) => c.count > 0 || c.slug === active)
          .map((c) => (
            <li key={c.slug}>
              <Link href={`/blogs/category/${c.slug}`} className={chip(active === c.slug)}>
                {c.name}
                <span className={cn("text-xs font-semibold", active === c.slug ? "text-secondary/70" : "text-primary/40")}>{c.count}</span>
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
};

export default CategoryNav;
