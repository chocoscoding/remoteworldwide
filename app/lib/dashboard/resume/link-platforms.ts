// Brand marks for header links — one registry that both the Content tab's
// link editor and the paper's header read, so a LinkedIn URL gets the LinkedIn
// mark in both places. Detection goes by hostname first (the URL is the
// truth), then by label (a freshly added "GitHub" row with no URL yet still
// shows the GitHub mark), then falls back to the globe.

import type { IconType } from "react-icons";
import {
  FaBehance,
  FaBluesky,
  FaCodepen,
  FaDev,
  FaDiscord,
  FaDribbble,
  FaFacebook,
  FaFigma,
  FaGithub,
  FaGitlab,
  FaGlobe,
  FaGoodreads,
  FaGoogleScholar,
  FaInstagram,
  FaKaggle,
  FaLinkedin,
  FaMastodon,
  FaMedium,
  FaOrcid,
  FaPinterest,
  FaProductHunt,
  FaResearchgate,
  FaSoundcloud,
  FaSpotify,
  FaStackOverflow,
  FaTelegram,
  FaThreads,
  FaTiktok,
  FaTwitch,
  FaVimeo,
  FaWhatsapp,
  FaXTwitter,
  FaYoutube,
} from "react-icons/fa6";
import { SiCalendly, SiHashnode, SiLeetcode, SiLinktree, SiNotion, SiPolywork, SiSubstack } from "react-icons/si";

export interface LinkPlatform {
  id: string;
  label: string;
  Icon: IconType;
  /** Hostname suffixes that identify the platform — "linkedin.com" also matches "www.linkedin.com". */
  hosts: readonly string[];
  /** URL placeholder the editor shows once this platform is picked. */
  placeholder: string;
}

/** The fallback: any site we don't recognise is a portfolio / personal site. */
export const WEBSITE: LinkPlatform = { id: "website", label: "Portfolio", Icon: FaGlobe, hosts: [], placeholder: "yourname.design" };

export const LINK_PLATFORMS: readonly LinkPlatform[] = [
  WEBSITE,
  { id: "linkedin", label: "LinkedIn", Icon: FaLinkedin, hosts: ["linkedin.com", "lnkd.in"], placeholder: "linkedin.com/in/you" },
  { id: "github", label: "GitHub", Icon: FaGithub, hosts: ["github.com"], placeholder: "github.com/you" },
  { id: "gitlab", label: "GitLab", Icon: FaGitlab, hosts: ["gitlab.com"], placeholder: "gitlab.com/you" },
  { id: "dribbble", label: "Dribbble", Icon: FaDribbble, hosts: ["dribbble.com"], placeholder: "dribbble.com/you" },
  { id: "behance", label: "Behance", Icon: FaBehance, hosts: ["behance.net"], placeholder: "behance.net/you" },
  { id: "figma", label: "Figma", Icon: FaFigma, hosts: ["figma.com"], placeholder: "figma.com/@you" },
  { id: "x", label: "X", Icon: FaXTwitter, hosts: ["x.com", "twitter.com"], placeholder: "x.com/you" },
  { id: "bluesky", label: "Bluesky", Icon: FaBluesky, hosts: ["bsky.app"], placeholder: "bsky.app/profile/you" },
  { id: "threads", label: "Threads", Icon: FaThreads, hosts: ["threads.net", "threads.com"], placeholder: "threads.net/@you" },
  { id: "instagram", label: "Instagram", Icon: FaInstagram, hosts: ["instagram.com"], placeholder: "instagram.com/you" },
  { id: "tiktok", label: "TikTok", Icon: FaTiktok, hosts: ["tiktok.com"], placeholder: "tiktok.com/@you" },
  { id: "youtube", label: "YouTube", Icon: FaYoutube, hosts: ["youtube.com", "youtu.be"], placeholder: "youtube.com/@you" },
  { id: "twitch", label: "Twitch", Icon: FaTwitch, hosts: ["twitch.tv"], placeholder: "twitch.tv/you" },
  { id: "medium", label: "Medium", Icon: FaMedium, hosts: ["medium.com"], placeholder: "medium.com/@you" },
  { id: "substack", label: "Substack", Icon: SiSubstack, hosts: ["substack.com"], placeholder: "you.substack.com" },
  { id: "hashnode", label: "Hashnode", Icon: SiHashnode, hosts: ["hashnode.dev", "hashnode.com"], placeholder: "you.hashnode.dev" },
  { id: "devto", label: "DEV", Icon: FaDev, hosts: ["dev.to"], placeholder: "dev.to/you" },
  { id: "stackoverflow", label: "Stack Overflow", Icon: FaStackOverflow, hosts: ["stackoverflow.com", "stackexchange.com"], placeholder: "stackoverflow.com/users/you" },
  { id: "leetcode", label: "LeetCode", Icon: SiLeetcode, hosts: ["leetcode.com"], placeholder: "leetcode.com/you" },
  { id: "kaggle", label: "Kaggle", Icon: FaKaggle, hosts: ["kaggle.com"], placeholder: "kaggle.com/you" },
  { id: "codepen", label: "CodePen", Icon: FaCodepen, hosts: ["codepen.io"], placeholder: "codepen.io/you" },
  { id: "producthunt", label: "Product Hunt", Icon: FaProductHunt, hosts: ["producthunt.com"], placeholder: "producthunt.com/@you" },
  { id: "polywork", label: "Polywork", Icon: SiPolywork, hosts: ["polywork.com"], placeholder: "polywork.com/you" },
  { id: "linktree", label: "Linktree", Icon: SiLinktree, hosts: ["linktr.ee"], placeholder: "linktr.ee/you" },
  { id: "notion", label: "Notion", Icon: SiNotion, hosts: ["notion.so", "notion.site"], placeholder: "you.notion.site" },
  { id: "calendly", label: "Calendly", Icon: SiCalendly, hosts: ["calendly.com"], placeholder: "calendly.com/you" },
  { id: "googlescholar", label: "Google Scholar", Icon: FaGoogleScholar, hosts: ["scholar.google.com"], placeholder: "scholar.google.com/citations?user=you" },
  { id: "researchgate", label: "ResearchGate", Icon: FaResearchgate, hosts: ["researchgate.net"], placeholder: "researchgate.net/profile/you" },
  { id: "orcid", label: "ORCID", Icon: FaOrcid, hosts: ["orcid.org"], placeholder: "orcid.org/0000-0000-0000-0000" },
  { id: "goodreads", label: "Goodreads", Icon: FaGoodreads, hosts: ["goodreads.com"], placeholder: "goodreads.com/you" },
  { id: "spotify", label: "Spotify", Icon: FaSpotify, hosts: ["spotify.com"], placeholder: "open.spotify.com/user/you" },
  { id: "soundcloud", label: "SoundCloud", Icon: FaSoundcloud, hosts: ["soundcloud.com"], placeholder: "soundcloud.com/you" },
  { id: "vimeo", label: "Vimeo", Icon: FaVimeo, hosts: ["vimeo.com"], placeholder: "vimeo.com/you" },
  { id: "pinterest", label: "Pinterest", Icon: FaPinterest, hosts: ["pinterest.com"], placeholder: "pinterest.com/you" },
  { id: "facebook", label: "Facebook", Icon: FaFacebook, hosts: ["facebook.com", "fb.com"], placeholder: "facebook.com/you" },
  { id: "mastodon", label: "Mastodon", Icon: FaMastodon, hosts: ["mastodon.social", "mastodon.online", "hachyderm.io", "fosstodon.org"], placeholder: "mastodon.social/@you" },
  { id: "discord", label: "Discord", Icon: FaDiscord, hosts: ["discord.gg", "discord.com"], placeholder: "discord.gg/you" },
  { id: "telegram", label: "Telegram", Icon: FaTelegram, hosts: ["t.me", "telegram.me"], placeholder: "t.me/you" },
  { id: "whatsapp", label: "WhatsApp", Icon: FaWhatsapp, hosts: ["wa.me", "whatsapp.com"], placeholder: "wa.me/234..." },
];

/** Hostname of a loosely typed URL: "linkedin.com/in/x", "https://www.x.com/y", "X.com" all resolve. */
export function hostOf(url: string): string {
  const bare = url.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "");
  return bare.split(/[/?#]/)[0] ?? "";
}

export function detectPlatform(url: string, label = ""): LinkPlatform {
  const host = hostOf(url);
  if (host) {
    const byHost = LINK_PLATFORMS.find((p) => p.hosts.some((h) => host === h || host.endsWith(`.${h}`)));
    if (byHost) return byHost;
  }
  const key = label.trim().toLowerCase();
  if (key) {
    const byLabel = LINK_PLATFORMS.find((p) => p.label.toLowerCase() === key || p.id === key);
    if (byLabel) return byLabel;
  }
  return WEBSITE;
}
