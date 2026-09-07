export interface BlogCategory {
  slug: string;
  name: string;
  tagline: string;
  tagHints: string[];
}

export const BLOG_CATEGORIES: BlogCategory[] = [
  {
    slug: "resumes-ats",
    name: "Resumes & ATS",
    tagline: "Get past the software and in front of a human.",
    tagHints: ["resume", "cv", "ats", "keywords", "cover letter"],
  },
  {
    slug: "interviews",
    name: "Interviews",
    tagline: "Walk in prepared. Walk out with an offer.",
    tagHints: ["interview", "questions", "prep", "offer", "negotiat"],
  },
  {
    slug: "job-search",
    name: "Job search",
    tagline: "Find the remote roles worth your time.",
    tagHints: ["job", "jobs", "search", "apply", "application", "hiring", "recruit"],
  },
  {
    slug: "remote-life",
    name: "Remote life",
    tagline: "Working well from anywhere.",
    tagHints: ["remote", "work from home", "wfh", "async", "timezone", "digital nomad", "global", "local"],
  },
  {
    slug: "career-growth",
    name: "Career growth",
    tagline: "Skills, salaries and the next step up.",
    tagHints: ["career", "salary", "growth", "skills", "promotion", "freelance"],
  },
];

export const DEFAULT_CATEGORY_SLUG = "job-search";

export function categoryBySlug(slug: string | null | undefined): BlogCategory | undefined {
  return BLOG_CATEGORIES.find((c) => c.slug === slug);
}

export function inferCategory(tags: string[]): BlogCategory {
  const haystack = tags.map((t) => t.toLowerCase());
  let best: { cat: BlogCategory; score: number } | null = null;
  for (const cat of BLOG_CATEGORIES) {
    const score = cat.tagHints.reduce((n, hint) => n + haystack.filter((t) => t.includes(hint)).length, 0);
    if (score > 0 && (!best || score > best.score)) best = { cat, score };
  }
  return best?.cat ?? categoryBySlug(DEFAULT_CATEGORY_SLUG)!;
}
