// Mock profile photos, keyed by person name — the same convention the rest
// of the mock data uses for identity. Deliberately PARTIAL: a real userbase
// is never fully photographed, so surfaces must look right with initials and
// photos side by side. In production this becomes `user.avatarUrl` and the
// lookup disappears.

/** Square face crop off Unsplash, sized for avatar circles (2x for retina). */
const unsplash = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&crop=faces&w=160&h=160&q=80`;

const PERSON_PHOTOS: Record<string, string> = {
  // Yourself — the sidebar, "You" rows, community quotes.
  "Chocos coding": unsplash("photo-1531123897727-8f129e1688ce"),

  // Pod members.
  "Priya Sharma": unsplash("photo-1494790108377-be9c29b29330"),
  "Chidi Nwosu": unsplash("photo-1506794778202-cad84cf45f1d"),
  "Funmi Adeyemi": unsplash("photo-1573496359142-b8d87734a5a2"),
  "Ines Costa": unsplash("photo-1517841905240-472988babdf9"),
  "Daniel Osei": unsplash("photo-1547425260-76bcadfb4f2c"),

  // Referral contacts.
  "Priya Nair": unsplash("photo-1544005313-94ddf0286df2"),
  "Lena Fischer": unsplash("photo-1438761681033-6461ffad8d80"),
  "Marcus Webb": unsplash("photo-1472099645785-5658abf4ff4e"),
  "Tunde Adebayo": unsplash("photo-1539571696357-5a69c17a67c6"),

  // Invites.
  "Grace Mensah": unsplash("photo-1524504388940-b1c1722653e1"),
  "Dami Aluko": unsplash("photo-1500648767791-00dcc994a43e"),
  "Nadia Farouk": unsplash("photo-1534528741775-53994a69daeb"),
  "Kwame Boateng": unsplash("photo-1507003211169-0a1dd7228f2d"),
};

/**
 * The person's photo, or null — null is a real answer, not a miss: Marcus
 * Lee, Maria Kowalski, Tolu Bakare and friends simply never uploaded one,
 * and their surfaces render initials.
 */
export function photoOf(name: string): string | null {
  if (name === "You") return PERSON_PHOTOS["Chocos coding"];
  return PERSON_PHOTOS[name] ?? null;
}
