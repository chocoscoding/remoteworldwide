import Link from "next/link";
import { TOOLS } from "@/app/lib/tools/catalogue";
import {
  JOB_LANDINGS,
  ROLES,
  REGIONS,
  landingPath,
} from "@/app/lib/landing/catalogue";
import { relevantLinks } from "@/app/lib/blog/discovery";
import type { ArticlePost } from "./Article";

export default function ArticleDiscovery({ post }: { post: ArticlePost }) {
  const text = [post.title, post.description, ...post.tags].join(" ");
  const tools = relevantLinks(
    text,
    TOOLS.map((tool) => ({
      title: tool.name,
      href: `/tools/${tool.slug}`,
      terms: [tool.name, ...tool.keywords],
    })),
    1,
  );
  const candidates = JOB_LANDINGS.filter(
    (landing) => !landing.missing && !landing.slug.includes("/"),
  ).map((landing) => ({
    title: landing.name,
    href: landingPath(landing),
    terms: [
      landing.slug.replaceAll("-", " "),
      ...(ROLES.find(([slug]) => slug === landing.slug)?.slice(1) ?? []),
      ...(REGIONS.find((region) => region.slug === landing.slug)
        ? [REGIONS.find((region) => region.slug === landing.slug)!.name]
        : []),
    ],
  }));
  const jobs = relevantLinks(text, candidates, 2);
  for (const slug of ["latest", "worldwide"]) {
    if (jobs.length >= 2) break;
    const landing = JOB_LANDINGS.find((landing) => landing.slug === slug)!;
    if (!jobs.some((link) => link.href === landingPath(landing)))
      jobs.push({ title: landing.name, href: landingPath(landing), terms: [] });
  }
  return (
    <nav
      aria-label="Explore jobs and tools"
      className="mt-10 rounded-xl border border-border bg-muted/30 p-5"
    >
      <h2 className="text-lg font-semibold">Explore jobs and tools</h2>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {[...tools, ...jobs].map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-primary underline underline-offset-4"
            >
              {link.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
