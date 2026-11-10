import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { it } from "node:test";
import { fileURLToPath } from "node:url";
const ROOT = new URL("../", import.meta.url);
registerHooks({resolve(specifier,context,nextResolve) {
  const target=specifier.startsWith("@/") ? new URL(specifier.slice(2),ROOT).href : specifier;
  if ((target.startsWith(".") || target.startsWith("file:")) && !/\.[cm]?[jt]sx?$/.test(target)) {
    const base=new URL(target,context.parentURL);
    for(const ext of [".ts",".tsx","/index.ts"]) {const candidate=new URL(base.href+ext);if(existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href,context);}
  }
  return nextResolve(target,context);
}});
const {jobExpiresAt,isJobLive,isJobIndexable,canStillApply,expiredJobMessage}=await import("../app/lib/jobs/jobLifetime.ts");
const {jobFactChips,jobLocations,salaryLabel}=await import("../app/lib/jobs/publicJobFacts.ts");
const {jobFacts}=await import("../app/lib/jobs/jobFacts.ts");
const {jobPostingJsonLd}=await import("../app/lib/jobs/jobPostingJsonLd.ts");
const posted="2026-01-01T12:00:00.000Z";
const expiry="2026-04-01T12:00:00.000Z";
const lifecycle={status:"open",postedAt:posted,expiresAt:expiry,closedAt:null,closureReason:null,archiveIndexable:false};
const job={id:"1",slug:"engineer",title:"Engineer",description:"<p>A role</p>",isActive:true,createdAt:posted,region:["United States"],company:{name:"Example",website:"https://example.com",logo:""},lifecycle};
const facts={salaryBands:[],visaSponsorship:"unknown",visaTypes:[],sponsorshipConditions:null,countries:[],regions:[],worldwideEligible:null,workLocation:null,timezoneOverlap:null,roleCategory:null,seniority:null,employmentType:null,contractModel:null,remotePolicy:null,relocationSupport:null,relocationConditions:null,languages:[],benefits:[],skills:[],education:null,experienceMin:null,experienceMax:null,requiredQualifications:[],preferredQualifications:[]};
it("expires at exactly 90 days and an employer deadline only shortens the maximum",()=>{
  assert.equal(jobExpiresAt(posted).toISOString(),expiry);
  assert.equal(jobExpiresAt(posted,"2026-01-15T00:00:00Z").toISOString(),"2026-01-15T00:00:00.000Z");
  assert.equal(jobExpiresAt(posted,"2027-01-01T00:00:00Z").toISOString(),expiry);
  assert.equal(isJobLive(job,Date.parse(expiry)-1),true);
  assert.equal(isJobLive(job,Date.parse(expiry)),false);
  assert.equal(isJobLive({...job,isActive:false},Date.parse(posted)),false);
});
it("keeps every expired or closed listing indexable unless marked Don't index",()=>{
  const after=Date.parse(expiry)+1;
  const expired=(archiveIndexable)=>({...job,lifecycle:{...lifecycle,status:"expired",archiveIndexable}});
  assert.equal(isJobIndexable(expired(true),after),true);
  assert.equal(isJobIndexable(expired(false),after),false);
  assert.equal(isJobIndexable({...job,lifecycle:{...lifecycle,status:"closed",archiveIndexable:true}},after),true);
  assert.equal(isJobIndexable({...job,lifecycle:{...lifecycle,status:"unpublished",archiveIndexable:true}},after),false);
  // Read while open, ran out since: the raw mark decides.
  assert.equal(isJobIndexable(job,after),true);
  assert.equal(isJobIndexable({...job,archiveIndexable:null},after),true);
  assert.equal(isJobIndexable({...job,archiveIndexable:false},after),false);
  // Before the backend sent a lifecycle.
  const {lifecycle:_,...legacy}=job;
  assert.equal(isJobIndexable(legacy,after),true);
  assert.equal(isJobIndexable({...legacy,archiveIndexable:false},after),false);
  assert.equal(isJobIndexable({...legacy,isActive:false},after),false);
});
it("keeps the apply link on expired listings, never on closed or unpublished ones",()=>{
  const after=Date.parse(expiry)+1;
  assert.equal(canStillApply(job,Date.parse(posted)),true);
  assert.equal(canStillApply({...job,lifecycle:{...lifecycle,status:"expired"}},after),true);
  // Read while open, ran out since.
  assert.equal(canStillApply(job,after),true);
  assert.equal(canStillApply({...job,lifecycle:{...lifecycle,status:"closed"}},after),false);
  assert.equal(canStillApply({...job,lifecycle:{...lifecycle,status:"unpublished"}},after),false);
  const {lifecycle:_,...legacy}=job;
  assert.equal(canStillApply(legacy,after),true);
  assert.equal(canStillApply({...legacy,isActive:false},after),false);
});
it("keeps useful archives indexable without treating them as live",()=>{
  const archive={...job,lifecycle:{...lifecycle,status:"expired",archiveIndexable:true}};
  assert.equal(isJobLive(archive,Date.parse(expiry)+1),false);
  assert.equal(isJobIndexable(archive,Date.parse(expiry)+1),true);
  assert.equal(isJobIndexable({...archive,isActive:false},Date.parse(expiry)+1),false);
  assert.match(expiredJobMessage(archive),/employer's current hiring status has not been confirmed/);
  assert.match(expiredJobMessage({...archive,lifecycle:{...archive.lifecycle,status:"closed"}}),/employer has closed/);
});
it("does not invent chips, salary or worldwide eligibility, and shows an unknown employment type as full-time",async()=>{
  assert.deepEqual(jobFactChips(null),[{kind:"employment",label:"Full-time"}]);
  assert.deepEqual(jobLocations(null,[]),["Location not specified"]);
  assert.deepEqual(await jobFacts({}),{employmentType:"FULL_TIME",salary:null});
  assert.deepEqual(jobFactChips(facts),[{kind:"employment",label:"Full-time"}]);
  assert.equal(jobFactChips({...facts,employmentType:"contract"})[0].label,"Contract");
});
it("salary chips preserve currency, period and conditional bands",()=>{
  const salary={min:100000,max:140000,currency:"USD",period:"year",kind:"base",conditions:"US applicants"};
  assert.equal(salaryLabel(salary),"USD 100,000–140,000/year (US applicants)");
  assert.equal(salaryLabel({...salary,currency:null}),null);
  const single=jobFactChips({...facts,salaryBands:[salary]})[0];
  assert.equal(single.label,"USD 100,000–140,000/year");
  assert.match(single.detail,/US applicants/);
  const chips=jobFactChips({...facts,salaryBands:[salary,{...salary,currency:"GBP",conditions:"UK applicants"}]});
  assert.equal(chips[0].label,"Multiple salary bands");
  assert.match(chips[0].detail,/UK applicants/);
});
it("does not claim sponsorship merely because a visa type is mentioned",()=>{
  assert.deepEqual(jobFactChips({...facts,visaTypes:["H1B"]}).map(chip=>chip.kind),["employment"]);
  assert.equal(jobFactChips({...facts,visaTypes:["H1B"],visaSponsorship:"yes"})[0].label,"Visa sponsorship");
  assert.equal(jobFactChips({...facts,visaTypes:["H1B"],visaSponsorship:"yes",sponsorshipConditions:"We offer visa sponsorship."})[0].label,"Visa sponsorship");
  const conditional=jobFactChips({...facts,visaTypes:["H1B"],visaSponsorship:"yes",sponsorshipConditions:"Transfers only"})[0];
  assert.equal(conditional.label,"Visa sponsorship");
  assert.equal(conditional.detail,"Transfers only");
});
it("only emits supported base pay and employment in structured data",async()=>{
  const resolved=await jobFacts({facts:{...facts,salaryBands:[{min:100000,max:120000,currency:"USD",period:"year",kind:"ote",conditions:null}]}});
  const schema=jobPostingJsonLd(job,resolved);
  assert.equal(schema.employmentType,"FULL_TIME");
  assert.equal("baseSalary" in schema,false);
  assert.equal(schema.validThrough,expiry);
  const salary=await jobFacts({facts:{...facts,employmentType:"part-time",salaryBands:[{min:40,max:50,currency:"USD",period:"hour",kind:"base",conditions:null}]}});
  assert.equal(salary.employmentType,"PART_TIME");
  assert.equal(jobPostingJsonLd(job,salary).baseSalary.value.unitText,"HOUR");
});
