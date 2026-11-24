import { test } from "node:test";
import assert from "node:assert/strict";
import { experienceDraft, experiencePlacement, suggestedExperienceRole } from "../app/lib/apply/experience-draft.ts";

test("experience suggestions are ready to edit with at most one simple amount", () => {
  const role = { id: "csm", label: "Senior Customer Success Manager", role: "Senior Customer Success Manager", company: "Contractor Foreman" };
  for (const skill of ["Customer training", "Recruiting", "Account management", "Python", "Customer success"]) {
    const draft = experienceDraft(skill, role);
    assert.ok(draft.trim().length > 20, `${skill} needs a ready-to-add example`);
    assert.ok((draft.match(/\[[^\]]+\]/g) ?? []).length <= 1, draft);
    assert.doesNotMatch(draft, /process \/ deliverable|measurable outcome|Applied \[/);
    assert.ok(draft.length <= 160, draft);
  }
});

test("recruiting reuses an existing example from the selected role", () => {
  const roles = [{ id: "a", label: "Engineer · Acme", company: "Acme", role: "Engineer" }, { id: "b", label: "Engineer · Rawura", company: "Rawura", role: "Engineer", context: "Supported recruiting" }];
  const selected = suggestedExperienceRole("Recruiting", roles);
  assert.equal(selected.id, "b");
  const draft = experienceDraft("Recruiting", selected);
  assert.equal(draft, "Supported recruiting");
  assert.doesNotMatch(draft, /\d/);
  assert.equal(suggestedExperienceRole("Recruiting", []), undefined);
});

test("a proposed recruiting example does not invent a measured outcome", () => {
  const draft = experienceDraft('Recruiting', { id: 'a', label: 'Recruiter' });
  assert.match(draft, /recruit|candidate|interview/i);
  assert.doesNotMatch(draft, /\d|increased|reduced|improved/i);
});

test("full requirement wording produces usable examples without placeholder homework", () => {
  const role = {id:'a',label:'Developer',context:'Built internal analytics dashboards.'};
  for (const requirement of ['Strong SQL skills (BigQuery or similar)', 'Solid understanding of marketing metrics: CAC, LTV, ROI/ROMI, payback', 'Collaborate with design and product teams', 'Experience with Amplitude, AppsFlyer']) {
    const draft = experienceDraft(requirement,role);
    assert.ok(draft.length > 25, requirement);
    assert.doesNotMatch(draft, /\[|Strong SQL skills|Solid understanding|Applied .*process/);
  }
});

test("a shared generic word is not enough to recycle unrelated work", () => {
  const role = { id: 'a', label: 'Customer Success Manager', context: 'Managed customer accounts and renewals.\nDelivered customer training for new users.' };
  assert.equal(experienceDraft('Customer training', role), 'Delivered customer training for new users.');
});

test('single and bulk placement get the same editable default and preserve intentional edits',()=>{
  const roles=[{id:'a',label:'Engineer',context:'Wrote SQL queries to audit transaction data.'},{id:'b',label:'Analyst',context:'Wrote SQL queries to prepare weekly marketing reports.'}];
  const single=experiencePlacement('SQL',roles);
  assert.equal(single.detail,roles[0].context);
  assert.equal(single.entryId,'a');
  assert.deepEqual(experiencePlacement('SQL',roles,{detail:'',useExperience:true}),single);
  assert.equal(experiencePlacement('SQL',roles,{entryId:'b'}).detail,roles[1].context);
  assert.equal(experiencePlacement('SQL',roles,{detail:'My own wording',entryId:'b',detailEdited:true}).detail,'My own wording');
  assert.equal(experiencePlacement('SQL',roles,{detail:'',detailEdited:true}).detail,'');
  assert.equal(experiencePlacement('SQL',[]).entryId,'');
});
