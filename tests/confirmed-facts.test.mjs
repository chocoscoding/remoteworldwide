import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
    const isPath = target.startsWith(".") || target.startsWith("file:");
    if (isPath && !/\.[cm]?[jt]sx?$/.test(target)) {
      const base = new URL(target, context.parentURL);
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(target, context);
  },
});


const { confirmAsks, factsFor, appliedAsks, openConfirmedAsks, mergeReviewedAsks, confirmationPlacements } = await import('../app/lib/apply/confirmed-facts.ts');
const { readApplyState } = await import('../app/lib/apply/state.ts');
const { pendingTerms } = await import('../app/lib/apply/pending-asks.ts');
const { requirementProgress } = await import('../app/lib/apply/requirement-progress.ts');
const ask = (term, place = 'experience') => ({ term, place, ifTrue: `Have you used ${term}?`, fromStep: null, no: false, addedIn: null });
const skills = ask('Excel', 'skills');
const work = ask('Figma');
const line = 'Designed mobile onboarding in Figma.';
const content = { skills: ['Excel'], experience: [{ bullets: [line] }] };

it('bulk add preserves both destinations and the edited example', () => {
  const selected = { ...work, useSkills: true, useExperience: true, detail: line, entryId: 'role' };
  assert.deepEqual(confirmationPlacements(selected).map(item => item.place), ['skills', 'experience']);
  assert.ok(confirmationPlacements(selected).every(item => item.detail === line && item.entryId === 'role'));
  assert.deepEqual(confirmationPlacements({ ...selected, useSkills: false }).map(item => item.place), ['experience']);
  assert.deepEqual(confirmationPlacements({ ...selected, useSkills: false, useExperience: false }), []);
});

it('a Skills-only choice does not confirm an unused experience draft', () => {
  assert.deepEqual(factsFor([{ ...work, confirmed: true, useSkills: true, useExperience: false, detail: line, entryId: 'role' }]), [{ term: 'Figma' }]);
});

it('old saved fragment questions are hidden while complete activities remain', () => {
  assert.deepEqual(openConfirmedAsks(['Train', 'Trainer', 'Trainee', 'Center', 'Excellence', 'Customer training'].map(term => ask(term)), new Set()).map(item => item.term), ['Customer training']);
});

it('cached scan examples do not recreate fragment questions', async () => {
  const { exampleAsks } = await import('../app/lib/apply/fixes.ts');
  const report = { verdicts: [{ requirement: { id: 'training', type: 'required', proof: [] }, unnamed: ['Train', 'Trainer', 'Trainee', 'Center', 'Excellence', 'Salesforce'] }] };
  assert.deepEqual(exampleAsks(report, { skills: [] }, []).map(item => item.term), ['Salesforce']);
});

it('undo keeps unanswered questions and restores a question when its insertion is undone', () => {
  const question = { ...work, fromStep: 'tailor', addedIn: null };
  assert.deepEqual(openConfirmedAsks([question], new Set(['start'])), [question]);
  const added = { ...question, confirmed: true, addedIn: 'insert' };
  assert.deepEqual(openConfirmedAsks([added], new Set(['start', 'tailor', 'insert'])), []);
  assert.deepEqual(openConfirmedAsks([added], new Set(['start'])), [added]);
  assert.deepEqual(openConfirmedAsks([{ ...question, no: true }], new Set()), []);
});

it('retains confirmed facts and context through save/reload while failed insertions remain open', () => {
  const asks = confirmAsks([], [{ ...work, detail: 'Used Figma at Example for mobile onboarding.' }]);
  const restored = readApplyState(JSON.parse(JSON.stringify({ resume: { asks } }))).resume.asks;
  assert.deepEqual(factsFor(restored), [{ term: 'Figma', detail: 'Used Figma at Example for mobile onboarding.' }]);
  assert.equal(restored[0].addedIn, null);
  assert.deepEqual(pendingTerms(restored), []);
});
it('partial batch failure completes only the saved Skills item', () => {
  assert.deepEqual(appliedAsks([skills, work], content, null), [skills]);
});
it('only placements that survive frontend checks are completed', () => {
  const result = { placed: { Figma: [line] } };
  assert.deepEqual(appliedAsks([work], content, result), [work]);
  assert.deepEqual(appliedAsks([work], { ...content, experience: [{ bullets: ['Designed onboarding.'] }] }, result), []);
  assert.deepEqual(appliedAsks([work], content, { placed: { Figma: ['Skills'] } }), []);
});
it('a declined fact is no longer supplied to the writer', () => {
  assert.deepEqual(factsFor([{ ...work, confirmed: true, no: true }]), []);
});
it('shows improved evidence even with an unchanged overall score, never from unchecked results', () => {
  const v = state => ({ requirement: { id: 'r', text: 'Figma experience', label: 'Figma' }, state });
  const before = { score: 70, verdicts: [v('missing')] };
  const after = { score: 70, verdicts: [v('satisfied')] };
  assert.deepEqual(requirementProgress(before, after), ['Figma']);
  assert.deepEqual(requirementProgress({ ...before, degraded: true }, after), []);
  assert.deepEqual(requirementProgress({ ...before, verdicts: [v('undetermined')] }, after), []);
});

it('compares the scorer coverage when the coarse state has not changed', () => {
  const report = coverage => ({ verdicts: [{ requirement: { id: 'r', text: 'Affiliate management' }, state: 'partial', coverage }] });
  assert.deepEqual(requirementProgress(report(0.6), report(0.75)), ['Affiliate management']);
  assert.deepEqual(requirementProgress(report(0.75), report(0.6)), []);
});

it('both destinations complete together and retain the experience detail', () => {
  const skill = ask('Figma', 'skills');
  const experience = { ...work, detail: 'At Example, I designed mobile onboarding in Figma.' };
  const items = [skill, experience];
  const both = { ...content, skills: ['Excel', 'Figma'] };
  assert.deepEqual(appliedAsks(items, both, { placed: { Figma: [line] } }), items);
  assert.deepEqual(appliedAsks(items, both, null), []);
  assert.deepEqual(appliedAsks(items, content, { placed: { Figma: [line] } }), []);
  assert.deepEqual(factsFor(confirmAsks([], items)), [{ term: 'Figma', detail: experience.detail }]);
});

it('replaces reviewed overlaps without changing answers or work in progress', () => {
 const protectedRows=[{...ask('SQL'),no:true},{...ask('Python'),confirmed:true},{...ask('Research'),detail:'I interviewed users.'},{...ask('Figma'),entryId:'role-1'}];
 const original=[ask('HTML'),ask('HTML, CSS, JavaScript'),...protectedRows];
 const next=mergeReviewedAsks(original,[ask('HTML'),ask('CSS'),ask('JavaScript'),ask('SQL')],original.map(x=>x.term));
 assert.deepEqual(openConfirmedAsks(next,new Set()).map(x=>x.term),['Python','Research','Figma','HTML','CSS','JavaScript']);
 assert.deepEqual(next.slice(0,4),protectedRows);
 assert.deepEqual(openConfirmedAsks(mergeReviewedAsks([ask('Checkout design')],[],['Checkout design']),new Set()),[]);
});

it('reviewed labels stay retired after save/reload and cannot be revived by scan examples', async () => {
 const {exampleAsks}=await import('../app/lib/apply/fixes.ts');
 const retired=mergeReviewedAsks([],[],['one-page checkout']);
 const state=readApplyState({resume:{asks:retired}});
 assert.equal(state.resume.asks[0].superseded,true);
 assert.deepEqual(openConfirmedAsks(state.resume.asks,new Set()),[]);
 const report={verdicts:[{requirement:{id:'checkout',type:'required'},unnamed:['one-page checkout','HTML']}]};
 assert.deepEqual(exampleAsks(report,{skills:[]},state.resume.asks).map(x=>x.term),['HTML']);
});

it('retires an already-applied confirmation after rewriting without losing the user evidence', () => {
 const saved={...ask('Marketplace design'),confirmed:true,addedIn:'old-step',detail:'Designed comparison flows.',entryId:'role-1'};
 const next=mergeReviewedAsks([saved],[],['Marketplace design']);
 assert.deepEqual(openConfirmedAsks(next,new Set()),[]);
 assert.deepEqual(factsFor(next),[{term:'Marketplace design',detail:saved.detail,entryId:'role-1'}]);
});

it("adds only an applicant-supplied reach figure to the correct visible role",async()=>{
  const {confirmMarketingReach}=await import("../app/lib/apply/confirmed-facts.ts");
  const before="Led marketing for a brand serving customers in Europe and Asia.";
  const role={id:"marketing",bullets:[before]};
  const resume={experience:[{id:"other",bullets:["Other work."]},role]};
  const ask={entryId:"marketing",before,unit:"customers"};
  const question={term:"Marketing reach at Studio",ifTrue:"How many customers did your marketing reach?",place:"experience",addedIn:null,reach:ask};
  assert.deepEqual(openConfirmedAsks([question],new Set()),[]);
  for(const answer of ["","I don't know","1,2","200 contacts"]) assert.equal(confirmMarketingReach(resume,ask,answer),null);
  const result=confirmMarketingReach(resume,ask,"about 1,250 customers");
  assert.equal(result.content.experience[1].bullets[0],before+" Marketing reached about 1,250 customers.");
  assert.deepEqual(result.content.experience[0],resume.experience[0]);
  assert.equal(confirmMarketingReach(result.content,ask,"200000"),null);
  assert.equal(confirmMarketingReach(resume,{...ask,entryId:"other"},"200000"),null);
  assert.equal(confirmMarketingReach({...resume,hiddenParts:["exp:marketing:0"]},ask,"1250"),null);
});
