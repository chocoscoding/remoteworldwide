/** Employer offers are not candidate qualifications. Mirrored in the website;
 * a contract test keeps stored-question filtering and extraction in agreement. */
const clean = (text: string) => text.replace(/<[^>]*>/g, ' ').replace(/[*_#]/g, '').replace(/^\s*[-•–]\s*/, '').replace(/\s+/g, ' ').trim();
const offerHeading = /^(?:(?:our |your |employee |full.time employee )?(?:benefits?|perks?)(?:\s+(?:and|&)\s+(?:benefits?|perks?))?|(?:what )?we (?:can )?(?:offer|provide)(?: you)?|what you(?:['’]ll| will)? (?:get|receive)(?: with us| in return)?|what(?:['’]s| is) in it for you|why (?:join us|work (?:with|for) us)|how we take care of you|compensation(?: and benefits)?)[\s:?!.-]*$/i;
const candidateHeading = /^(?:(?:key |main |core |your |job )?(?:responsibilities|duties)|(?:minimum |basic |preferred )?(?:qualifications|requirements)|skills(?: and experience)?|what you(?:['’]ll| will)? (?:do|need)|what we(?:['’]re| are)? looking for|about you|who you are|your (?:role|profile|background|impact)|nice.to.haves?|bonus(?: points)?)(?:\s*:.*|[?!.-]*)$/i;
const benefit = /\b(?:paid time off|time.off policy|out of office days|unlimited (?:pto|vacation|leave|holidays)|pto|health insurance|(?:medical|dental|vision|life) (?:insurance|coverage)|wellness (?:compensations?|allowance|benefits?|budget)|team buildings?|offsites?|merch(?:andise)?|special occasions? (?:presents|gifts)|parental leave|pension|401\(?k\)?|gym membership|(?:learning|education|home office) (?:budget|stipend|allowance))\b/i;
// The same nouns are legitimate work for HR, insurance, retail and operations.
const candidateWork = /^(?:(?:you (?:will|must|should)|you['’]ll|responsible for|(?:proven |hands.on |prior |strong |solid )*(?:experience|knowledge|understanding|expertise|proficiency|familiarity|ability|skills) (?:with|in|of|to)|\d+\+? years (?:of )?experience (?:with|in))\s+)?(?:manage|administer|design|develop|build|implement|analy[sz]e|sell|advise|process|coordinate|organize|lead|support|deliver|audit|oversee|maintain|negotiate|create|handle|track|plan|work)(?:s|d|ed|ing)?\b/i;

export function isEmployerOffer(value: string): boolean {
  const text = clean(value).replace(/^add evidence for:\s*/i, '').replace(/,?\s*if you have used it[.!]?$/i, '').trim();
  if (offerHeading.test(text)) return true;
  if (/^(?:(?:proven|hands.on|prior|strong|solid|demonstrated)\s+)*(?:experience|knowledge|understanding|expertise|proficiency|familiarity)\s+(?:with|in|of)\b/i.test(text)) return false;
  if (/\b(?:industry experience|administration|claims processing|sales experience|management skills)\s*[.!]?$/i.test(text)) return false;
  if (/^(?:managing|administering|designing|developing|building|implementing|analy[sz]ing|selling|advising|processing|coordinating|organizing|leading|supporting|delivering|auditing|overseeing|maintaining|negotiating|creating|handling|tracking|planning)\b/i.test(text)) return false;
  if (candidateWork.test(text)) return false;
  return benefit.test(text) || /^(?:(?:fully |flexible )?(?:remote|hybrid|on.site)(?:\s+(?:or|and|\/)\s*(?:remote|hybrid|on.site))?\s+(?:work|working|workplace|options?)\b|(?:competitive|attractive|generous) (?:salary|compensation|benefits)|(?:we |you will |you['’]ll )?(?:offer|provide|receive|enjoy)\b.*\b(?:benefits|insurance|holidays|vacation|stipend|equipment)\b)/i.test(text);
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
    return !inBenefits && !isEmployerOffer(line);
  }).map(raw => candidateHeading.test(clean(raw)) ? clean(raw) : raw).join('\n');
}

/** Remove old saved suggestions whose wording came solely from a benefits section. */
export function isExcludedPostingText(value: string, posting: string): boolean {
  const key = (text: string) => clean(text).toLowerCase().replace(/^add evidence for:\s*/, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const target = key(value);
  return target.length > 2 && key(posting).includes(target) && !key(withoutEmployerOffers(posting)).includes(target);
}
