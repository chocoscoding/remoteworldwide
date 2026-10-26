import { test } from "node:test";
import assert from "node:assert/strict";
import { experienceDraft, suggestedExperienceRole } from "../app/lib/apply/experience-draft.ts";

test("recruiting gets a role-specific draft with unknown work and metrics bracketed", () => {
  const roles = [{ id: "a", label: "Engineer · Acme", company: "Acme", role: "Engineer" }, { id: "b", label: "Engineer · Rawura", company: "Rawura", role: "Engineer", context: "Supported recruiting" }];
  const selected = suggestedExperienceRole("Recruiting", roles);
  assert.equal(selected.id, "b");
  const draft = experienceDraft("Recruiting", selected);
  assert.match(draft, /Rawura/);
  assert.match(draft, /\[X\] roles/);
  assert.match(draft, /time-to-hire by \[X\]%/);
  assert.doesNotMatch(draft, /\d/);
  assert.equal(suggestedExperienceRole("Recruiting", []), undefined);
});
