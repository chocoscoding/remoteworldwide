import { isEmployerOffer, isPostingTrait } from '../ats/posting-benefits';

/** Reject isolated fragments, while retaining complete concepts such as
 * train-the-trainer programs and customer education. Mirrored in the AI service. */
export function actionableSkillLabel(value: string): boolean {
  const label = value.trim().toLowerCase().replace(/[.!?:]+$/, '');
  return Boolean(label) && !/^(?:language polyglot|polyglot|growth opportunities|analytics tools?|content|train|trainer|trainee|center|centre|excellence|team|teams|brand|product|business|company|candidate|ability|proficiency|experience|skills?|strong|excellent)$/.test(label);
}

/** Convert posting wording into names, never a sentence pasted into Skills. */
export function skillNames(value: string): string[] {
  const text=value.replace(/[\p{Extended_Pictographic}\uFE0F★✓✔•]/gu,' ').replace(/\s+/g,' ').trim();
  if(isEmployerOffer(text) || isPostingTrait(text))return [];
  const toolAttribution=/^(Meta(?: Ads)?|Google Ads|Amplitude|AppsFlyer)\s+attribution$/i.exec(text);
  if(toolAttribution)return [toolAttribution[1]];
  const concepts:Array<[RegExp,string]>=[
    [/\bSQL\b/i,'SQL'],[/\bBigQuery\b/i,'BigQuery'],[/\bTableau\b/i,'Tableau'],[/\bPower BI\b/i,'Power BI'],[/\bLooker\b/i,'Looker'],
    [/\bMeta(?: Ads)?\b/i,'Meta'],[/\bGoogle Ads\b/i,'Google Ads'],[/\bAmplitude\b/i,'Amplitude'],[/\bAppsFlyer\b/i,'AppsFlyer'],
    [/\bStripe\b/i,'Stripe'],[/\bPayPal\b/i,'PayPal'],[/\bPython\b/i,'Python'],
    [/\bJavaScript\b/i,'JavaScript'],[/\bHTML\b/i,'HTML'],[/\bCSS\b/i,'CSS'],
    [/\bSalesforce\b/i,'Salesforce'],[/\b(?:Salesforce|SFDC) implementation\b/i,'Salesforce implementation'],[/\bdata model(?:ing|ling)?\b/i,'Data modeling'],
    [/\bcommunicat(?:e|ion)\b/i,'Communication'],
    [/\b(?:analytical thinking|translate data|data analysis)\b/i,'Data analysis'],
    [/\bfunnel (?:performance|analysis|analytics)\b/i,'Funnel analysis'],[/\bdata quality\b/i,'Data quality'],
    [/\b(?:attribution data|marketing attribution)\b/i,'Marketing attribution'],
    [/\b(?:large.scale datasets|data management|core datasets)\b/i,'Data management'],
    [/\b(?:ML models?|machine learning)\b/i,'Machine learning'],[/\bdata science\b/i,'Data science'],
    [/\bA\/B test(?:ing)?(?: analysis)?\b/i,'A/B testing'],[/\bmarketing (?:performance|analytics|metrics)\b/i,'Marketing analytics'],
    [/\bLTV\b/i,'LTV analysis'],[/\bCAC\b/i,'CAC analysis'],[/\bROI(?:\/ROMI)?\b/i,'ROI analysis'],[/\bpayback\b/i,'Payback analysis'],
    [/\b(?:reports and dashboards|reporting dashboards|business intelligence)\b/i,'Business intelligence'],
    [/\bcustomer onboarding\b/i,'Customer onboarding'],[/\bstakeholder management\b/i,'Stakeholder management'],
    [/\bproject management\b/i,'Project management'],[/\brecruit(?:ing|ment)\b/i,'Recruiting'],
    [/\bfinancial (?:analysis|modeling|modelling)\b/i,'Financial analysis'],[/\bpayment data\b/i,'Payment analytics'],
  ];
  const namedConcepts=concepts.filter(([pattern])=>pattern.test(text));
  if (/\b(?:understanding of|proficiency (?:in|with|and)|experience (?:using|is required)|communicate effectively|person who)\b/i.test(text))return [...new Set(namedConcepts.map(([,name])=>name))];
  const toolList=/\s+(?:and|or)\s+/i.test(text) && (namedConcepts.length>1 || /^[A-Z][\w.+#-]*(?:\s+(?:and|or)\s+[A-Z][\w.+#-]*)+$/.test(text));
  if(!isSkillSentence(text) && !/[,;|:]/.test(text) && !/^(?:BI tools?|marketing metrics|tools|technologies)\b/i.test(text) && !toolList && actionableSkillLabel(text))return [text];
  const simple=text.replace(/^Add evidence for:\s*/i,'').replace(/^You have (?:used|worked with)\s+/i,'')
    .replace(/^(?:(?:strong|solid|excellent|proven|demonstrated|hands.on|extensive|working|deep)\s+)*(?:experience (?:working )?(?:with|in)|knowledge of|understanding of|familiarity with|proficiency in|ability to)\s+/i,'')
    .replace(/^(?:strong|solid|excellent)\s+/i,'').replace(/\s+skills\b/gi,'').replace(/\bor (?:similar|equivalent)\b/gi,'')
    .replace(/^(?:marketing metrics|tools|technologies|BI tools)\s*:\s*/i,'')
    .replace(/[.!?]+$/,'').trim();
  const duty=/^(?:work(?:ed|ing)?|analy[sz]e|identify|support|assist|prepare|develop|build|manage|lead|collaborate|coordinate|ensure|maintain|deliver|implement|create|drive|monitor|responsible)\b/i;
  const sentence=duty.test(simple) || /\b(?:ability to|experience working|and ability|to support|to translate)\b/i.test(simple) || /[→←↔⇒]/.test(simple) || simple.split(/\s+/).length>7;
  const found=concepts.filter(([pattern])=>pattern.test(text)).map(([,name])=>name);
  if(sentence) return [...new Set(found)];
  const parts=simple.replace(/[()]/g,',').split(/\s*[,;|]\s*|\s+(?:and|or)\s+/i).map(s=>s.trim()).filter(Boolean);
  const out:string[]=[];
  for(const part of parts){
    if(isPostingTrait(part))continue;
    if(/^(?:BI tools?|marketing metrics|tools?|skills?|similar|equivalent|transaction.level|event.level)$/i.test(part))continue;
    if(!actionableSkillLabel(part) || duty.test(part) || part.split(/\s+/).length>6 || /[:→←↔⇒]/.test(part))continue;
    const matches=concepts.filter(([pattern])=>pattern.test(part));
    // Preserve complete existing names (e.g. SQL Server, Meta Ads, English - fluent).
    const exact=matches.find(([pattern])=>part.match(pattern)?.[0]?.length===part.length);
    out.push(exact?.[1] ?? part);
  }
  return [...new Set(out.length ? out : found)];
}

export function isSkillSentence(value:string):boolean {
  if(isEmployerOffer(value) || isPostingTrait(value) || /\b(?:understanding of|proficiency (?:in|with|and)|experience (?:using|is required)|communicate effectively|person who)\b/i.test(value))return true;
  return /^(?:strong|solid|excellent|experience (?:with|in|working)|familiarity with|knowledge of|understanding of|ability to|work(?:ed|ing)?|analy[sz]e|identify|support|assist|prepare|develop|build|manage|lead|collaborate|ensure|maintain|deliver|implement|create|drive|monitor)\b|\bor similar\b|[→←↔⇒★✓✔]|\p{Extended_Pictographic}/iu.test(value) || value.split(/\s+/).length>7;
}
