/** A listed job title is already visible to the editor. */
export function asksForTitle(question: string, term = "") {
  if (/\b(?:title|titled)\b/i.test(term) && /\b(?:role|resume|position|official|candidate|source|confirm|held|hold|employer|manager|engineer|director)\b/i.test(term+" "+question)) return true;
  if (/^(?:(?:senior|junior|lead|principal|staff|associate|chief|head|vp|of|product|project|program|engineering|marketing|sales|success|people|growth|operations|software|backend|customer|technical|account|business|development)\s+)+(?:manager|director|officer|engineer|lead|executive|people)$/i.test(term.trim())) return true;
  if (/\b(?:manager|director|engineer|officer|executive|lead|analyst) title\b|\btitle\b.{0,80}\b(?:resume|listed positions|employers?)\b/i.test(question)) return true;
  return /\b(?:official(?:ly)? (?:job )?titl(?:e|ed)|(?:held?|hold|had|have|state|confirm)(?: the| an?| your| my| official| job)* title|title (?:was|of)|role (?:was |is )?titled)\b/i.test(question);
}

/** Extract the audience of the localization duty itself, ignoring locations in
 * benefits, office addresses and unrelated responsibilities. */
export function localizationQuestion(posting:string) {
  const markets = new Set<string>();
  for (const line of posting.split(/[.!?;\n]/)) {
    if (!/\b(?:locali[sz]\w*|adapt(?:ed|ing)?)\b/i.test(line) || !/\b(?:contents?|campaigns?|assets?|copy)\b/i.test(line)) continue;
    for (const match of line.matchAll(/\bfor (?:the )?([A-Z][a-z]+(?: [A-Z][a-z]+)?) (?:audiences?|customers?|markets?)\b/g)) markets.add(match[1]);
  }
  if (markets.size!==1) return undefined;
  const [market]=markets;
  const english=/adapt(?:ed|ing)? English[-‐‑ ]language content/i.test(posting);
  return {term:market+" content localization",place:"experience" as const,
    ifTrue:"Have you adapted "+(english ? "English-language " : "")+"content for "+market+" audiences?"};
}

/** Keep the confirmation attached to the work the posting describes. The short
 * label remains the identity of the question, including in saved applications. */
export function postingWorkflow(term: string, proposed: string, posting: string) {
  const job = posting.replace(/[‐‑–—]/g, "-");
  const topic = term + " " + proposed;
  if (/\bprocurement\b/i.test(topic) && /procurement processes typical of Japanese enterprise and government accounts/i.test(job))
    return {term:"Procurement in Japan",place:"experience" as const,ifTrue:"Have you guided an enterprise or government customer in Japan through procurement? Which step did you own?"};
  const language=job.match(/\bnative[- ]level\s+((?:Brazilian |European )?Portuguese|(?:Canadian )?French|Spanish|English|German|Japanese)\b/i);
  if (language && new RegExp("\\b"+language[1].split(" ").pop()+"\\b","i").test(term))
    return {term:language[1],place:"skills" as const,ifTrue:"Can you use "+language[1]+" at a native level at work?"};
  if (/locali[sz]\w*|non[- ]English (?:markets|audiences)|adapt(?:ing|ed)? (?:content|campaigns)/i.test(topic)) {
    const localization=localizationQuestion(posting);
    if (localization) return localization;
  }
  const format = /\b(?:PSD|Photoshop)\b/i.test(topic) ? "PSD" : /\bFigma\b/i.test(topic) ? "Figma" : "";
  if (format && new RegExp("\\bimport(?:s|ing)?\\b[^.;\\n]{0,100}\\b" + format + "\\b", "i").test(job)) {
    const editable = /edit[- ]ready|without manual repair|high[- ]fidelity import/i.test(job);
    return {term:format+" file imports", place:"experience" as const, ifTrue:editable ? "Did you ship an import that brought " + format + " files into an editor ready to edit?"
      : "Did you build or ship a way to import " + format + " files?"};
  }
  if (/\b(?:AI|ML|agentic|artificial intelligence|editor integrations?)\b/i.test(topic) && /templates that agents can populate/i.test(job) && /review-and-refine|humans in control/i.test(job))
    return {term:"AI template workflows",place:"experience" as const,ifTrue:"Did you ship a workflow where AI filled a template and a person could review and edit the result?"};
  if (/\bHTML5\b/i.test(topic) && /\bexport\b[^.;\n]{0,120}\bad servers?\b/i.test(job) && /\bHTML5 ads?\b/i.test(job))
    return {term:"HTML5 ad export",place:"experience" as const,ifTrue:"Did you ship an HTML5 ad export that met an ad server’s requirements?"};
  if (/design systems?|shared (?:editor )?foundations?|peer (?:lead |senior )?(?:PM|product manager)/i.test(topic) && /partner with .*peer lead PM on shared editor foundations/i.test(job))
    return {term:"Shared editor components",place:"experience" as const,ifTrue:"Did you work with another lead product manager on editor components shared across formats?"};
  if (/design craft|design quality|craft[- ]focused design/i.test(topic) && /design craft was the differentiator/i.test(job))
    return {term:"Product design craft",place:"experience" as const,ifTrue:"Did you ship a product where a specific design decision was a reason people chose or used it?"};
  if (/product data|customer feedback|validat(?:ing|e) priorities/i.test(topic) && /product data and structured customer feedback to validate priorities/i.test(job))
    return /customer feedback/i.test(term) ? {term:"Customer feedback prioritization",place:"experience" as const,ifTrue:"Did you use structured customer feedback to decide which product change to prioritize?"}
      : {term:"Data-informed prioritization",place:"experience" as const,ifTrue:"Did you use product metrics to decide which product change to prioritize?"};
  if (/post[- ]launch (?:audit|review)|release review/i.test(topic) && /(?:L\+14|14 days (?:after|post[- ]))/.test(job))
    return {term:"Post-launch reviews",place:"experience" as const,ifTrue:"Did you review a release against its original hypothesis 14 days after launch?"};
  return undefined;
}

export function postingQuestion(term: string, proposed: string, posting: string): string {
  const workflow = postingWorkflow(term,proposed,posting);
  if (workflow) return workflow.ifTrue;
  const languageOptions = posting.split(/\r?\n/).find(line => /\b(?:polyglot|languages?|programming)\b/i.test(line) &&
    /\bat least \d+ (?:out )?of\b/i.test(line));
  if (languageOptions && term.trim() && /^(?:.{1,50}, if you have used it[?.!]?|Have you (?:ever )?used [^?]{1,50}\?)$/i.test(proposed.trim())) {
    const escaped = term.trim().replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    if (new RegExp("(?:^|[^a-z0-9])"+escaped+"(?=$|[^a-z0-9])","i").test(languageOptions))
      return "What service or tool, if any, have you built or maintained with "+term.trim()+"?";
  }
  // Some saved follow-ups describe what the reader wants confirmed in the third person.
  const statement = /^(?:the )?(?:candidate|applicant) has (.+?)[.!]?$/i.exec(proposed.trim());
  if (statement) {
    const experience = /^(?:demonstrated )?experience (?:in|with) (.+)$/i.exec(statement[1]);
    if (experience) return "What experience, if any, do you have with " + experience[1] + "?";
    const verb = /^(?:[a-z]+ed|built|led|run|held|grown|written|won|spoken|taught)\b/i.test(statement[1]);
    return (verb ? "Have you " : "Do you have ") + statement[1] + "?";
  }
  const condition = /^(.+?),\s*if you (have used it|hold one|have led it|speak it|have worked in one)[.!]?$/i.exec(proposed.trim());
  if (condition) {
    const subject = condition[1].replace(/^A /, "a ");
    switch (condition[2].toLowerCase()) {
      case "hold one": return "Do you hold " + subject + "?";
      case "speak it": return "What level of " + subject + " can you use at work?";
      case "have led it": return "Have you led " + subject + "? What did you change?";
      case "have worked in one": return "Have you worked with " + subject + "? Which part of delivery did you own?";
      case "have used it": {
        const audience = /\bhow its products serve ([^.!?\n]{3,100})/i.exec(posting);
        if (subject === term && audience && posting.includes(term))
          return "Have you used " + term + " to support " + audience[1].trim() + "? What did you use it for?";
        break;
      }
    }
  }
  // A stored model answer can end halfway through a purpose clause. Preserve the complete question.
  if (/^(?:have|did|do|can|are) you\b/i.test(proposed) && !/[?!.]$/.test(proposed)) {
    if (/\bcompensation$/i.test(proposed) && /\bcompensation frameworks\b/i.test(posting)) return proposed + " frameworks?";
    return proposed.replace(/\s+(?:and|or|to validate|to manage|including|such as)$/i, "").trimEnd() + "?";
  }
  // A posting may name a duty in a short heading, then explain the actual task.
  // Use the first action in its explanation when a question simply repeats the heading.
  const heading = /^did you (.{3,45})\?$/i.exec(proposed.trim())?.[1]?.toLowerCase();
  if (heading) {
    for (const line of posting.split(/\n/)) {
      const task = /^\s*[-*•]?\s*([^.!?:]{3,60})[.:]\s*(Create|Build|Lead|Manage|Design|Develop|Run|Implement|Deliver)\s+([^.,;!?]{8,120})/i.exec(line);
      if (task && task[1].toLowerCase() === heading)
        return "Did you " + task[2].toLowerCase() + " " + task[3].trim() + "?";
    }
  }
  if (!/^(?:have you (?:ever )?(?:used|worked with|applied|had experience (?:with|using))|(?:are you|how) familiar|do you (?:use|have experience (?:with|using)))\b/i.test(proposed) &&
      !/if you have used it\b/i.test(proposed) && proposed.trim() && proposed !== term) return proposed;
  const lines = posting.split(/\n|[.!?]\s+/).map(s => s.trim().replace(/^[-*•]\s*/, ""));
  const word = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const named = new RegExp("(?:^|[^a-z0-9])" + word + "(?=$|[^a-z0-9])", "i");
  const action = /^(?:build|develop|implement|lead|use|analy[sz]e|design|maintain|create|automate|manage|integrate|deliver|monitor|publish|test|support|report)\b/i;
  for (const line of lines) {
    const task = line.replace(/^(?:[^:]{2,40}:\s+|(?:you will|you’ll|you'll)\s+)/i, "").replace(/[.!?;]+$/, "");
    if (task.length > 12 && task.length <= 165 && action.test(task) && named.test(task) && !/\b(?:our|your|you|we)\b/i.test(task))
      return "Did you " + task[0].toLowerCase() + task.slice(1) + "?";
  }
  const conditional = proposed.match(/^(.{2,60}?) for (.{3,100}?),\s*if you have used it[.!]?$/i);
  if (conditional && named.test(conditional[1]) && named.test(posting))
    return "Have you used " + conditional[1] + " for " + conditional[2] + "?";
  return proposed;
}

/** Apply the same presentation checks to stored and newly returned follow-ups. */
export function displayPostingQuestions<T extends {term:string;ifTrue:string;place?:string;reach?:unknown}>(items:T[], posting:string) {
  return items.flatMap(item=>{
    if (item.reach) return [item];
    if (asksForTitle(item.ifTrue,item.term) || /\b(?:employed|worked|served)\b.{0,50}\b(?:job )?title\b/i.test(item.ifTrue)) return [];
    const task=postingWorkflow(item.term,item.ifTrue,posting);
    const question=task?.ifTrue ?? postingQuestion(item.term,item.ifTrue,posting);
    // A clipped modifier leaves the applicant guessing which deliverable is meant.
    if (question.length>=115 && !/[?.!]$/.test(question)) return [];
    if (/\b(?:to|from|with|for|external|internal|such as|including)\s*$/i.test(question)) return [];
    return [{...item,ifTrue:question,place:task?.place ?? item.place}];
  });
}
