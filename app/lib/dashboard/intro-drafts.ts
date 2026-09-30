// Intro message drafting.
//
// A draft is a function of (who you're asking, what you're asking about, how
// you know them, who you are). Pure and free — templates, not a model call.
//
// Honest by construction:
// - "How you know them" is only ever what the source says (TieKind): a
//   LinkedIn connection is someone you're connected to, not a friend; someone
//   you added yourself is someone you know; someone found online is a stranger
//   and the draft says how you found them.
// - "Who you are" is the signed-in user's own profile (Settings → Profile):
//   their name to sign with and their headline and summary to introduce
//   themselves. Nothing about the sender is invented — no years of experience,
//   no shared alma mater, no portfolio they may not have. With no name on the
//   profile, the draft is left unsigned for them to sign.

import type { ReferralContact } from "./types";

/** All a draft reads about the job: who is hiring, and for what. */
type IntroJob = { company: string; role: string };

/** The person writing, from their saved profile. Any field may be blank. */
export interface IntroSender {
  name: string;
  headline: string;
  summary: string;
}

export type DraftLength = "long" | "short";

const NO_SENDER: IntroSender = { name: "", headline: "", summary: "" };

/** What to greet them by: LinkedIn's own first-name field when there is one. */
export const greetingName = (contact: Pick<ReferralContact, "name" | "firstName">): string =>
  contact.firstName?.trim() || contact.name.trim().split(/\s+/)[0] || "there";

const clean = (value: string): string => value.replace(/\s+/g, " ").trim().replace(/[.!\s]+$/, "");

/** The summary's first sentence, when it is short enough to quote in an intro. */
function firstSentence(summary: string): string {
  const sentence = clean(summary.split(/(?<=[.!?])\s+/)[0] ?? "");
  return sentence.length > 0 && sentence.length <= 240 ? sentence : "";
}

/** "A bit about me: …" from the headline, plus the summary's opening line in a full draft. */
function aboutMe(sender: IntroSender, length: DraftLength): string {
  const headline = clean(sender.headline);
  const opener = length === "long" ? firstSentence(sender.summary) : "";
  if (headline && opener && !opener.toLowerCase().includes(headline.toLowerCase())) return `A bit about me: ${headline}. ${opener}.`;
  if (headline) return `A bit about me: ${headline}.`;
  return opener ? `${opener}.` : "";
}

const signOff = (sender: IntroSender, closing: string): string => (sender.name.trim() ? `${closing},\n${sender.name.trim()}` : `${closing},`);

const paragraphs = (...parts: string[]): string => parts.filter((p) => p.trim() !== "").join("\n\n");

/** "the Staff Engineer role at Stripe", or "a role at Stripe" when the posting named none. */
const theRole = (job: IntroJob): string => (job.role.trim() ? `the ${job.role.trim()} role at ${job.company}` : `a role at ${job.company}`);

/** The same, once the company has just been named: "the Staff Engineer role there". */
const theRoleThere = (job: IntroJob): string => (job.role.trim() ? `the ${job.role.trim()} role there` : "a role there");

/**
 * When the contact isn't at the company you're asking about — or you don't
 * know where they work — asking them to "refer you" is nonsense; you're asking
 * whether they know anyone. The screen decides which case applies; this is the
 * shape of the ask.
 */
function isAdjacent(contact: ReferralContact, job: IntroJob | undefined): boolean {
  return !!job && contact.company.trim().toLowerCase() !== job.company.trim().toLowerCase();
}

export function introSubject(contact: ReferralContact, job: IntroJob | undefined): string {
  if (!job) return `Quick question, ${greetingName(contact)}`;
  if (isAdjacent(contact, job)) return `Do you know anyone at ${job.company}?`;
  return job.role.trim() ? `${job.role.trim()} at ${job.company}: would you refer me?` : `A role at ${job.company}: would you refer me?`;
}

/** How the note opens, by how you actually know them. */
function opener(contact: ReferralContact): string {
  if (contact.tie === "connection") return "We're connected on LinkedIn, so I hope you don't mind a quick question.";
  if (contact.tie === "cold") return "I came across your profile and hoped you might be able to point me in the right direction.";
  return "Hope you're well.";
}

export function draftIntro(contact: ReferralContact, job: IntroJob | undefined, length: DraftLength, sender: IntroSender = NO_SENDER): string {
  const name = greetingName(contact);
  const about = aboutMe(sender, length);

  if (!job) {
    // Nothing picked: a general ask about their company, or for their advice.
    const where = contact.company.trim();
    if (length === "short") {
      return where
        ? `Hi ${name}, I'm looking for my next role and wondered whether ${where} is hiring for anything that might fit me. Would you be open to a quick chat?`
        : `Hi ${name}, I'm looking for my next role and would really value your advice. Would you be open to a quick chat?`;
    }
    return paragraphs(
      `Hi ${name},`,
      `${opener(contact)} I'm looking for my next role, and ${where ? `I'd love to hear what it's like at ${where} and whether anything there might fit me` : "I'd really value your advice on where to look"}.`,
      about,
      `Would you be open to a quick chat? I can send my CV beforehand so it takes almost none of your time.`,
      signOff(sender, "Thanks"),
    );
  }

  const role = theRole(job);

  if (isAdjacent(contact, job)) {
    // Not a referral ask — a "who do you know" ask.
    if (length === "short") {
      return `Hi ${name}, I'm applying for ${role}. Do you know anyone there who'd be worth talking to? Happy to send my CV over if it helps.`;
    }
    return paragraphs(
      `Hi ${name},`,
      `${opener(contact)} I'm applying for ${role}, and I'm trying to find someone on the inside before I apply cold.`,
      `Do you know anyone there, or anyone who might know someone? Even a name I could look up would help.`,
      about,
      `I'm happy to send my CV and a two-line summary you could pass on.`,
      signOff(sender, "Thanks"),
    );
  }

  if (contact.tie === "cold") {
    // Found online: they have never heard of you, so the draft says how you
    // found them and asks for something small before it asks for a referral.
    const recruiter = /recruit|talent|people|\bhr\b|human resources/i.test(contact.role);
    if (recruiter) {
      if (length === "short") {
        return `Hi ${name}, I'm applying for ${role} and saw you're on the recruiting side. Could I send you a two-line summary of why I'm a strong fit, or ask who the hiring manager is?`;
      }
      return paragraphs(
        `Hi ${name},`,
        `I'm applying for ${role} and saw that you work on the recruiting side there, so I hoped you'd be the right person to ask.`,
        about,
        `Could I send you a short summary of my background for the role? If you're not the recruiter for it, I'd be grateful for the name of whoever is.`,
        signOff(sender, "Thanks for considering it"),
      );
    }
    if (length === "short") {
      return `Hi ${name}, I came across your profile while looking into ${role}. Would you be open to a quick chat about the team, and to referring me if it feels like a fit?`;
    }
    return paragraphs(
      `Hi ${name},`,
      `I came across your profile while looking into ${role}${contact.role.trim() ? `, and saw you work there as ${contact.role.trim()}` : ""}.`,
      about,
      `I'm applying for the role, and before I do I'd really value ten minutes of your read on the team and what they look for. If after that you felt comfortable referring me, I'd be very grateful, but the context alone would help a lot.`,
      `I can send over my CV and a two-line summary, so it takes almost none of your time.`,
      signOff(sender, "Thanks for considering it"),
    );
  }

  if (contact.tie === "connection") {
    // Connected on LinkedIn: maybe a colleague, maybe someone met once. The
    // draft asks for their read first and the referral second.
    if (length === "short") {
      return `Hi ${name}, we're connected on LinkedIn and I saw you're at ${job.company}. I'm applying for ${theRoleThere(job)}. Would you be open to a quick chat about the team, or to referring me if it feels right?`;
    }
    return paragraphs(
      `Hi ${name},`,
      `We're connected on LinkedIn, and I noticed you're at ${job.company}${contact.role.trim() ? ` as ${contact.role.trim()}` : ""}. I'm applying for ${theRoleThere(job)} and would really value your take before I do.`,
      about,
      `Would you be open to a ten-minute chat about the team? And if it feels like a fit afterwards, a referral from you would mean a lot. I'll send my CV and a short summary you can paste straight in, so it takes almost none of your time.`,
      signOff(sender, "Thanks"),
    );
  }

  // Someone you added yourself: you know them, so the ask can be direct.
  if (length === "short") {
    return `Hi ${name}, I saw ${role} is open and I'd love a shot at it. Would you be up for referring me? I can send my CV and a short summary.`;
  }
  return paragraphs(
    `Hi ${name},`,
    `Hope you're well. I saw ${role} is open, and it's exactly the kind of work I want to be doing next.`,
    about,
    `Would you be willing to put a referral in for me? A referral from someone on the inside carries a lot more weight than an application from the pile, and I wouldn't ask if I didn't think I could do the job well.`,
    `I'll send my CV and a short summary you can paste straight in, so it's five minutes of your time at most.`,
    signOff(sender, "Thank you either way"),
  );
}
