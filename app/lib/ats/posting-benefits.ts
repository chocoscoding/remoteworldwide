/** Employer offers are not candidate qualifications. Mirrored in the website;
 * a contract test keeps stored-question filtering and extraction in agreement. */
const clean = (text: string) => text.replace(/<[^>]*>/g, ' ').replace(/[*_#]/g, '').replace(/^\s*[-•–]\s*/, '').replace(/\s+/g, ' ').trim();
const offerHeading = /^(?:(?:our |your |the |employee |full.time employee )?(?:benefits?|perks?)(?:\s+(?:and|&)\s+(?:benefits?|perks?))?|(?:what )?(?:do |can |will )?we (?:can |will )?(?:offer|provide)(?: you)?|what we(?:['’]re| are) offering|(?:our |the )?offer(?:ing)?|what(?:['’]s| is) on offer|what you can expect from us|in return(?:,? we offer)?|why you(?:['’]ll| will) love (?:working )?(?:here|with us|it here|us)|(?:total )?rewards?(?: (?:and|&) benefits)?|what you(?:['’]ll| will)? (?:get|receive)(?: with us| in return)?|what(?:['’]s| is) in it for you|why (?:join us|work (?:with|for) us)|how we take care of you|compensation(?: and benefits)?|(?:our |company )?culture|life at .+|what makes us different)[\s:?!.-]*$/i;
const candidateHeading = /^(?:(?:key |main |core |your |job )?(?:responsibilities|duties)|(?:minimum |basic |preferred )?(?:qualifications|requirements)|skills(?: and experience)?|what you(?:['’]ll| will)? (?:do|need)|what we(?:['’]re| are)? looking for|about you|who you are|your (?:role|profile|background|impact)|nice.to.haves?|bonus(?: points)?)(?:\s*:.*|[?!.-]*)$/i;
const benefit = /\b(?:paid time off|time.off policy|out of office days|unlimited (?:pto|vacation|leave|holidays)|pto|health insurance|(?:medical|dental|vision|life) (?:insurance|coverage)|wellness (?:compensations?|allowance|benefits?|budget)|team buildings?|offsites?|merch(?:andise)?|special occasions? (?:presents|gifts)|parental leave|pension|401\(?k\)?|gym membership|(?:learning|education|home office) (?:budget|stipend|allowance))\b/i;
// The same nouns are legitimate work for HR, insurance, retail and operations.
const candidateWork = /^(?:(?:you (?:will|must|should)|you['’]ll|responsible for|(?:proven |hands.on |prior |strong |solid )*(?:experience|knowledge|understanding|expertise|proficiency|familiarity|ability|skills) (?:with|in|of|to)|\d+\+? years (?:of )?experience (?:with|in))\s+)?(?:manage|administer|design|develop|build|implement|analy[sz]e|sell|advise|process|coordinate|organize|lead|support|deliver|audit|oversee|maintain|negotiate|create|handle|track|plan|work)(?:s|d|ed|ing)?\b/i;

export function isEmployerOffer(value: string): boolean {
  const text = clean(value).replace(/^add evidence for:\s*/i, '').replace(/^(?:have you(?: ever)?|did you|do you)\s+/i,'').replace(/,?\s*if you have used it[.!]?$/i, '').trim();
  if (offerHeading.test(text)) return true;
  // These describe the employer/environment, even when they start with "Work".
  if (/^work (?:in|for) (?:an? |the )?(?:business|company|organi[sz]ation)\b.*\b(?:fairly|transparent|transparently|ethical|inclusive)\b|^work with (?:an? )?(?:(?:immensely|highly|exceptionally|incredibly) )?(?:talented|amazing|great|world.class)\b.*\bteam\b|^we (?:lead by example|believe|value|celebrate|have fun)\b/i.test(text)) return true;
  if (/^(?:(?:proven|hands.on|prior|strong|solid|demonstrated)\s+)*(?:experience|knowledge|understanding|expertise|proficiency|familiarity)\s+(?:with|in|of)\b/i.test(text)) return false;
  if (/\b(?:industry experience|administration|claims processing|sales experience|management skills)\s*[.!]?$/i.test(text)) return false;
  if (/^(?:managing|administering|designing|developing|building|implementing|analy[sz]ing|selling|advising|processing|coordinating|organizing|leading|supporting|delivering|auditing|overseeing|maintaining|negotiating|creating|handling|tracking|planning)\b/i.test(text)) return false;
  if (candidateWork.test(text)) return false;
  if (/\b(?:competitive pay|(?:company|annual|team) retreats?|professional development (?:stipend|budget|allowance)|stock options|equity (?:package|grant)|(?:equipment|software|tech).{0,30}(?:you need|you'll need|you need to do your job))\b/i.test(text) || /^equity\s*[-–—:]|^(?:any |all |the )?equipment\/software\/tech\b/i.test(text)) return true;
  // Perks and the team on offer, even when no heading says so (owner, 2026-11-27: "What do we offer?"
  // lines such as a home-office budget and "a fun, driven, and multinational team" became questions).
  if (/^(?:an? |the )?(?:(?:exceptional|great|excellent|real|fast|clear|unique|amazing|exciting|rapid)\s+)?(?:career (?:growth|progression|development)|growth (?:and|&) (?:learning|development)|learning (?:and|&) (?:growth|development))(?:\s+(?:and|&)\s+(?:learning|development|growth))?(?:\s+(?:opportunit(?:y|ies)|path|plan|prospects))?\s*[.!]?$/i.test(text)
    || /^(?:an? |the )?(?:(?:unique|great|amazing|exciting|rare)\s+)?opportunit(?:y|ies) to (?:be (?:a )?part of|join|work (?:with|alongside)|grow|learn)\b/i.test(text)
    || /^an?\s+(?:(?:fun|friendly|driven|diverse|multinational|international|global|talented|supportive|young|dynamic|passionate|experienced|collaborative|distributed|ambitious)(?:,?\s+(?:and\s+)?))+team\b(?!\s*(?:lead|leader|leadership|player|management|manager|building))/i.test(text)
    || /^direct,?\s+(?:day.to.day\s+)?(?:work(?:ing)?\s+)?(?:(?:experience|exposure|contact|access|collaboration)\s+)?with (?:the )?(?:management|leadership|founders?|executives?|c.level)(?: team)?\s*[.!]?$/i.test(text)
    || /^(?:an? )?flexible\b.*\b(?:arrangement|hours|schedule|work.from.home|time off|holidays)\s*[.!]?$/i.test(text)
    || (!/^(?:own|set|allocate|control|forecast|track|manage|plan|oversee|administer)\b/i.test(text) && /\b(?:home.office|set.?up|learning(?: and| &)? development|l&d|training|conference|wellness|equipment|coworking|internet)\b[^.]{0,30}\b(?:budget|stipend|allowance)\b/i.test(text))) return true;
  return benefit.test(text) || /^(?:(?:fully |flexible )?(?:remote|hybrid|on.site)(?:\s+(?:or|and|\/)\s*(?:remote|hybrid|on.site))?\s+(?:work|working|workplace|options?)\b|(?:competitive|attractive|generous) (?:salary|compensation|benefits)|(?:we |you will |you['’]ll )?(?:offer|provide|receive|enjoy)\b.*\b(?:benefits|insurance|holidays|vacation|stipend|equipment)\b)/i.test(text);
}

/** Personality/culture fragments aren't skill names or evidence requests. */
export function isPostingTrait(value:string):boolean {
  const text=clean(value).replace(/^add evidence for:\s*/i,'').replace(/[.!?]+$/,'');
  return /^(?:motivated|self.motivated|solutions? driven|conscientious(?: person)?|be helpful|freedom and flexibility|autonomy and ownership|solve interesting problems|(?:have )?fun)(?:[,;]|\s+(?:and|person|who)\b.*|$)/i.test(text);
}

/** Identify copied imperative duties, including saved auto-generated checklist rows.
 * Real questions about specific work remain available. */
export function isPostingDuty(value:string):boolean {
  const text=clean(value).replace(/^add evidence for:\s*/i,'').replace(/^(?:proactively|closely|regularly)\s+/i,'');
  return candidateWork.test(text) || /^(?:own|hold|solve|ensure|produce|collaborate|identify|communicate|drive|act|report)\b/i.test(text);
}

/** Preserve newlines and subsequent qualifications, including bulleted headings.
 * Unknown perk wording is excluded by its section, not a keyword blacklist. */
export function withoutEmployerOffers(posting: string): string {
  let inBenefits = false;
  return posting.replace(/<\/(?:p|li|h[1-6]|div)>|<br\s*\/?>/gi, '\n').split(/\r?\n/).filter(raw => {
    const line = clean(raw);
    const head = line.split(':')[0].trim();
    if (offerHeading.test(head)) { inBenefits = true; return false; }
    if (candidateHeading.test(line)) { inBenefits = false; return true; }
    return !inBenefits && !isEmployerOffer(line) && !isPostingTrait(line);
  }).map(raw => candidateHeading.test(clean(raw)) ? clean(raw) : raw).join('\n');
}

/** Remove old saved suggestions whose wording came solely from a benefits section. */
export function isExcludedPostingText(value: string, posting: string): boolean {
  const key = (text: string) => clean(text).toLowerCase().replace(/^add evidence for:\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const target = key(value);
  return target.length > 2 && key(posting).includes(target) && !key(withoutEmployerOffers(posting)).includes(target);
}
