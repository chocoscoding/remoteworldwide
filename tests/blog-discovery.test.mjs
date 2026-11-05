import assert from "node:assert/strict";
import { it } from "node:test";
import { relevantLinks } from "../app/lib/blog/discovery.ts";
it("blog discovery matches complete phrases and prefers specific tools", () => {
  const links = [
    { title: "Data jobs", href: "/jobs/data", terms: ["data"] },
    { title: "Resume", href: "/tools/resume", terms: ["resume"] },
    {
      title: "Resume builder",
      href: "/tools/builder",
      terms: ["resume builder"],
    },
  ];
  assert.deepEqual(
    relevantLinks("Metadata and resume builder advice", links, 1).map(
      (l) => l.href,
    ),
    ["/tools/builder"],
  );
  assert.deepEqual(relevantLinks("Unrelated", links, 2), []);
});
