import { test } from "node:test";
import assert from "node:assert/strict";
import { experienceDraft, suggestedExperienceRole } from "../app/lib/apply/experience-draft.ts";

test("experience suggestions are ready to edit with at most one simple amount", () => {
  const role = { id: "csm", label: "Senior Customer Success Manager", role: "Senior Customer Success Manager", company: "Contractor Foreman" };
  for (const skill of ["Customer training", "Recruiting", "Account management", "Python", "Customer success"]) {
    const draft = experienceDraft(skill, role);
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

test("a skill alone does not establish a recruiting outcome", () => {
  assert.equal(experienceDraft('Recruiting', { id: 'a', label: 'Recruiter' }), '');
});

test("a shared generic word is not enough to recycle unrelated work", () => {
  const role = { id: 'a', label: 'Customer Success Manager', context: 'Managed customer accounts and renewals.\nDelivered customer training for new users.' };
  assert.equal(experienceDraft('Customer training', role), 'Delivered customer training for new users.');
});
