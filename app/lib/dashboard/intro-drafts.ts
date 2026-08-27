// Intro message drafting.
//
// Replaces the three hand-written strings the referrals screen used to keep in
// a `DRAFT_MESSAGES` map keyed by contact id — which meant only those three
// contacts could ever be drafted for, and no draft ever mentioned the job.
//
// A draft is a function of (who you're asking, what you're asking about, how
// warm they are). Pure — a real generator replaces these templates.

import type { JobOption } from "./job-options";
import type { ReferralContact } from "./types";

export type DraftLength = "long" | "short";

const firstName = (name: string) => name.split(" ")[0];

/**
 * When the contact isn't at the company you're asking about, asking them to
 * "refer you" is nonsense — you're asking whether they know anyone. The screen
 * decides which case applies; this is the shape of the ask.
 */
function isAdjacent(contact: ReferralContact, job: JobOption | undefined): boolean {
  return !!job && contact.company.toLowerCase() !== job.company.toLowerCase();
}

export function introSubject(contact: ReferralContact, job: JobOption | undefined): string {
  if (!job) return `Quick question, ${firstName(contact.name)}`;
  if (isAdjacent(contact, job)) return `Do you know anyone at ${job.company}?`;
  return `${job.role} at ${job.company} — would you refer me?`;
}

export function draftIntro(contact: ReferralContact, job: JobOption | undefined, length: DraftLength): string {
  const name = firstName(contact.name);
  const role = job?.role ?? contact.targetRole;
  const company = job?.company ?? contact.company;
  const adjacent = isAdjacent(contact, job);

  if (adjacent) {
    // Not a referral ask — a "who do you know" ask.
    return length === "short"
      ? `Hi ${name} — I'm going for the ${role} role at ${company}. Do you know anyone there who'd be worth talking to? Happy to send my portfolio over if it helps.`
      : `Hi ${name},

Hope you're well. I'm putting my name in for the ${role} role at ${company} and I'm trying to find someone on the inside before I apply cold.

Do you know anyone there, or anyone who'd know someone? Even a name I could look up would help. I'm happy to send over my portfolio and a two-line summary you could forward on.

Either way, good to be back in touch.

Amara`;
  }

  if (contact.tie === "strong") {
    const shared = contact.lastInteraction ? ` ${contact.lastInteraction}.` : "";
    return length === "short"
      ? `Hi ${name} — ${company} has a ${role} role open and I'd love a shot at it. Would you be up for referring me? Portfolio's ready to send.`
      : `Hi ${name},

Good to see ${company} hiring for ${role} — it's exactly the work I want to be doing next.${shared}

Would you be willing to put a referral in for me? I know a referral from someone on the inside carries a lot more weight than an application from the pile, and I wouldn't ask if I didn't think I could do the job well.

I'll send my portfolio and a short summary you can paste straight in, so it's five minutes of your time at most.

Thank you either way,
Amara`;
  }

  if (contact.tie === "second") {
    const via = contact.via ?? "a mutual connection";
    return length === "short"
      ? `Hi ${name} — ${via} suggested I reach out. I'm applying for the ${role} role at ${company} and would love your read on it before I do.`
      : `Hi ${name},

${via} suggested I get in touch — I hope that's alright.

I'm applying for the ${role} role at ${company}, and before I do I'd really value ten minutes of your read on the team and what they're actually looking for. I've spent the last six years on design systems and developer-facing products, so I think there's a genuine fit here.

If a referral feels right after that, wonderful. If not, the context alone would be a big help.

Thanks for considering it,
Amara`;
  }

  // alumni
  return length === "short"
    ? `Hi ${name} — fellow Andela alum here. I'm going for the ${role} role at ${company}. Any chance you'd point me in the right direction internally?`
    : `Hi ${name},

Reaching out as a fellow Andela alum — I still lean on that network more than any other.

I'm applying for the ${role} role at ${company}. Would you be open to pointing me toward the right person internally, or letting me know how the team actually evaluates people? Anything from the inside beats guessing from the job post.

Happy to return the favour any time — I keep an eye out for people in the alumni channel.

Thanks,
Amara`;
}
