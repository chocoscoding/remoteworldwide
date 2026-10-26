export const PROFILE_LINK_LABELS = { linkedin: "LinkedIn", github: "GitHub", portfolio: "Portfolio / website" } as const;
export type ProfileLinkKey = keyof typeof PROFILE_LINK_LABELS;
export type ProfileLinks = Partial<Record<ProfileLinkKey, string>>;

export function webLink(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** A project/repository link is not someone's GitHub profile, even on the same domain. */
export function profileLinkConflict(question: string, answer: string, profile: ProfileLinks): ProfileLinkKey | null {
  const link = webLink(answer);
  if (!link) return null;
  const q = question.toLowerCase();
  if (/\b(project|repository|repo|sample|article|published|specific|example|demo)\b/.test(q)) return null;
  if (/\blinked\s*in\b/.test(q)) return "linkedin";
  if (/\bgithub\b/.test(q)) return "github";
  if (/\b(portfolio|personal website|website url|website link)\b|^website[?\s]*$/.test(q)) return "portfolio";
  const normalized = (url: string) => webLink(url)?.replace(/\/$/, "");
  for (const key of Object.keys(PROFILE_LINK_LABELS) as ProfileLinkKey[]) {
    if (profile[key] && normalized(profile[key]!) === normalized(link)) return key;
  }
  const url = new URL(link);
  if (/^(www\.)?linkedin\.com$/.test(url.hostname) && /^\/in\/[^/]+\/?$/.test(url.pathname)) return "linkedin";
  if (/^(www\.)?github\.com$/.test(url.hostname) && /^\/[^/]+\/?$/.test(url.pathname)) return "github";
  return null;
}
