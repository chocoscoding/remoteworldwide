// Compile-time tests for the job field spec in `./fields`.
//
// The frontend has no test runner, so these run inside the type check itself:
// `npx tsc --noEmit` and `next build` both include every `.ts` file, under
// strict mode. A failing `Expect`, or an `@ts-expect-error` line that stops
// erroring, fails the build.
//
// Never import this file. `pickJob` and `pickJobDynamic` are declared, not
// implemented, every import is type-only, and every call sits inside a function
// nothing calls, so the only reader of this code is the compiler.

/* eslint-disable @typescript-eslint/no-unused-vars -- every alias and function below exists only to be type-checked */

import type {
  JOB_FIELDS,
  LIST_JOB_FIELDS,
  REQUIRABLE_FIELDS,
  JobField,
  ListJobField,
  PickJob,
  PickJobDynamic,
  PickedJob,
  PickedJobDynamic,
  PickerStatus,
  RequirableJobField,
  ValidSpec,
} from "./fields";
import type { EmploymentType, JobDetails, JobFieldSource, JobSource, RemoteType, SalaryPeriod } from "./types";

// Exact equality, not mutual assignability: `string | null` must not pass for
// `string`, and an optional key must not pass for a required one.
type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

type JobOf<P> = Extract<Awaited<P>, { status: "picked" }> extends { job: infer J } ? J : never;
type Sources<F extends JobField> = Partial<Record<F, JobFieldSource>>;
type HasDuplicate<T extends readonly unknown[]> =
  T extends readonly [infer H, ...infer R] ? (H extends R[number] ? true : HasDuplicate<R>) : false;

declare const pickJob: PickJob;
declare const pickJobDynamic: PickJobDynamic;

// ---------------------------------------------------------------------------
// The vocabulary agrees with the contract
// ---------------------------------------------------------------------------

type VocabularyCases = [
  // Every key of `JobDetails` is askable, nothing else is, and each is listed once.
  Expect<Equal<JobField, keyof JobDetails>>,
  Expect<Equal<HasDuplicate<typeof JOB_FIELDS>, false>>,
  // The runtime lists name exactly the fields the types compute from the contract,
  // so a list field added to `JobDetails` cannot be required at compile time but
  // refused by `parseFieldSpec`.
  Expect<Equal<(typeof LIST_JOB_FIELDS)[number], ListJobField>>,
  Expect<Equal<(typeof REQUIRABLE_FIELDS)[number], RequirableJobField>>,
  Expect<Equal<HasDuplicate<typeof REQUIRABLE_FIELDS>, false>>,
];

// ---------------------------------------------------------------------------
// The seven caller specs
// ---------------------------------------------------------------------------

function callerSpecs() {
  // dashboard/ats/Client.tsx
  const ats = pickJob("company, role, description");
  type Ats = Expect<
    Equal<
      JobOf<typeof ats>,
      {
        id: string;
        source: JobSource;
        company: string;
        role: string;
        description: string;
        meta: {
          missing: Array<"company" | "role" | "description">;
          sources: Sources<"company" | "role" | "description">;
        };
      }
    >
  >;
  // The exported alias names exactly what a pick resolves with, so a screen can
  // type its state as `PickedJob<typeof SPEC>` (every caller does).
  type AtsIsPickedJob = Expect<Equal<JobOf<typeof ats>, PickedJob<"company, role, description">>>;

  // dashboard/cover/Client.tsx
  const cover = pickJob("company, role, description?, requirements?");
  type Cover = Expect<
    Equal<
      JobOf<typeof cover>,
      {
        id: string;
        source: JobSource;
        company: string;
        role: string;
        description: string | null;
        // An optional list is still never null: "none" is `[]`.
        requirements: string[];
        meta: {
          missing: Array<"company" | "role" | "description" | "requirements">;
          sources: Sources<"company" | "role" | "description" | "requirements">;
        };
      }
    >
  >;

  // dashboard/jdqa/Client.tsx
  const jdqa = pickJob(
    "company, role, description, summary?, salary?, location?, remoteType?, employmentType?, requirements?, url?, applyUrl?, companyLogo?",
  );
  type JdqaField =
    | "company"
    | "role"
    | "description"
    | "summary"
    | "salary"
    | "location"
    | "remoteType"
    | "employmentType"
    | "requirements"
    | "url"
    | "applyUrl"
    | "companyLogo";
  type Jdqa = Expect<
    Equal<
      JobOf<typeof jdqa>,
      {
        id: string;
        source: JobSource;
        company: string;
        role: string;
        description: string;
        summary: string | null;
        salary: string | null;
        location: string | null;
        remoteType: RemoteType | null;
        employmentType: EmploymentType | null;
        requirements: string[];
        // Requirable, but asked for with `?`, so nullable.
        url: string | null;
        applyUrl: string | null;
        companyLogo: string | null;
        meta: { missing: Array<JdqaField>; sources: Sources<JdqaField> };
      }
    >
  >;

  // dashboard/tracker/Client.tsx
  const tracker = pickJob("company, role, url?, location?, salary?");
  type Tracker = Expect<
    Equal<
      JobOf<typeof tracker>,
      {
        id: string;
        source: JobSource;
        company: string;
        role: string;
        url: string | null;
        location: string | null;
        salary: string | null;
        meta: {
          missing: Array<"company" | "role" | "url" | "location" | "salary">;
          sources: Sources<"company" | "role" | "url" | "location" | "salary">;
        };
      }
    >
  >;

  // dashboard/referrals/Client.tsx
  const referrals = pickJob("company, role");
  type Referrals = Expect<
    Equal<
      JobOf<typeof referrals>,
      {
        id: string;
        source: JobSource;
        company: string;
        role: string;
        meta: { missing: Array<"company" | "role">; sources: Sources<"company" | "role"> };
      }
    >
  >;

  // components/dashboard/resume/ResumeScreenBody.tsx
  const resume = pickJob("company, role, description, skills?, requirements?");
  type Resume = Expect<
    Equal<
      JobOf<typeof resume>,
      {
        id: string;
        source: JobSource;
        company: string;
        role: string;
        description: string;
        skills: string[];
        requirements: string[];
        meta: {
          missing: Array<"company" | "role" | "description" | "skills" | "requirements">;
          sources: Sources<"company" | "role" | "description" | "skills" | "requirements">;
        };
      }
    >
  >;

  // components/dashboard/win/WinLogDialog.tsx
  const win = pickJob("company, role");
  type Win = Expect<
    Equal<
      JobOf<typeof win>,
      {
        id: string;
        source: JobSource;
        company: string;
        role: string;
        meta: { missing: Array<"company" | "role">; sources: Sources<"company" | "role"> };
      }
    >
  >;
}

// ---------------------------------------------------------------------------
// What else a spec tolerates
// ---------------------------------------------------------------------------

function toleratedSpecs() {
  // One field per line with a trailing comma, and space before a `?`.
  const multiline = pickJob(`
    company,
    role,
    salaryMin ?,
  `);
  type Multiline = Expect<
    Equal<
      JobOf<typeof multiline>,
      {
        id: string;
        source: JobSource;
        company: string;
        role: string;
        salaryMin: number | null;
        meta: {
          missing: Array<"company" | "role" | "salaryMin">;
          sources: Sources<"company" | "role" | "salaryMin">;
        };
      }
    >
  >;

  // A const is still a literal.
  const spec = "company, role";
  const fromConst = pickJob(spec);
  type FromConst = Expect<Equal<keyof JobOf<typeof fromConst>, "id" | "source" | "company" | "role" | "meta">>;

  // A required list keeps its promise with `[]`.
  const lists = pickJob("company, role, requirements, skills");
  type Lists = Expect<Equal<JobOf<typeof lists>["requirements"], string[]>>;

  // `id` and `source` may be named, even with `?`; they stay non-null and never
  // appear in `missing`, but they do appear in `sources`.
  const ids = pickJob("id?, source, company");
  type Ids = Expect<
    Equal<
      JobOf<typeof ids>,
      {
        id: string;
        source: JobSource;
        company: string;
        meta: { missing: Array<"company">; sources: Sources<"id" | "source" | "company"> };
      }
    >
  >;

  // Closed enums keep their unions.
  const enums = pickJob("company, role, remoteType?, employmentType?, salaryPeriod?");
  type Enums = [
    Expect<Equal<JobOf<typeof enums>["remoteType"], RemoteType | null>>,
    Expect<Equal<JobOf<typeof enums>["employmentType"], EmploymentType | null>>,
    Expect<Equal<JobOf<typeof enums>["salaryPeriod"], SalaryPeriod | null>>,
  ];

  // Every field at once stays inside the compiler's recursion limit.
  const everything = pickJob(
    "id, source, company, role, description, url, salary?, platformJobId?, slug?, applyUrl?, category?, regions, seniority?, postedAt?, companyLogo?, companyWebsite?, companyAbout?, companyLinkedin?, descriptionHtml?, summary?, location?, remoteType?, employmentType?, salaryMin?, salaryMax?, salaryCurrency?, salaryPeriod?, requirements, responsibilities, niceToHaves, benefits, skills, yearsExperienceMin?, yearsExperienceMax?",
  );
  type Everything = [
    Expect<Equal<keyof JobOf<typeof everything>, JobField | "meta">>,
    Expect<Equal<JobOf<typeof everything>["url"], string>>,
    Expect<Equal<JobOf<typeof everything>["salaryMin"], number | null>>,
    Expect<Equal<JobOf<typeof everything>["benefits"], string[]>>,
    Expect<Equal<JobOf<typeof everything>["meta"]["missing"], Array<Exclude<JobField, "id" | "source">>>>,
  ];

  // Options are typed, and `onStatusChange` receives the picker's status union.
  void pickJob("company, role", {
    title: "Which job?",
    initialTab: "paste",
    onStatusChange: (status) => {
      type Status = Expect<Equal<typeof status, PickerStatus>>;
    },
  });
}

// ---------------------------------------------------------------------------
// What a spec refuses, and the words it uses
// ---------------------------------------------------------------------------

function rejectedSpecs(widened: string, either: boolean) {
  // @ts-expect-error -- "rol" is not a job field
  void pickJob("company, rol");
  // @ts-expect-error -- "company" is listed twice
  void pickJob("company, role, company");
  // @ts-expect-error -- listed twice even when one copy is optional
  void pickJob("company, company?");
  // @ts-expect-error -- salaryMin is not guaranteed for every job, so it needs "?"
  void pickJob("company, salaryMin");
  // @ts-expect-error -- a widened string cannot be checked; runtime lists use pickJobDynamic
  void pickJob(widened);
  // @ts-expect-error -- a spec of nothing but separators is empty
  void pickJob(" , ");
  // @ts-expect-error -- the empty string is empty too
  void pickJob("");
  // @ts-expect-error -- a union of specs would promise every member's fields at once
  void pickJob(either ? "company" : "company, role");
  // @ts-expect-error -- "salary?" with a second "?" is not a field name
  void pickJob("company, salary??");
  // @ts-expect-error -- initialTab is "platform" or "paste"
  void pickJob("company, role", { initialTab: "saved" });
}

type MessageCases = [
  Expect<Equal<ValidSpec<"company, rol">, 'Unknown job field "rol"'>>,
  Expect<Equal<ValidSpec<"company, role, company">, 'Job field "company" is listed twice'>>,
  Expect<
    Equal<ValidSpec<"company, salaryMin">, 'Job field "salaryMin" is not guaranteed for every job, ask for "salaryMin?"'>
  >,
  Expect<Equal<ValidSpec<" , ">, "The field spec is empty">>,
  Expect<
    Equal<ValidSpec<string>, 'Pass a literal field spec like "company, role" (for a runtime list use pickJobDynamic)'>
  >,
  Expect<Equal<ValidSpec<"company" | "company, role">, "Pass one literal field spec per call, not a union of specs">>,
  // The first problem wins, checked in the same order as `parseFieldSpec`.
  Expect<
    Equal<
      ValidSpec<"company, salaryMin, rol">,
      'Job field "salaryMin" is not guaranteed for every job, ask for "salaryMin?"'
    >
  >,
  // A valid spec is itself.
  Expect<Equal<ValidSpec<"company, role, salary?">, "company, role, salary?">>,
];

// ---------------------------------------------------------------------------
// pickJobDynamic: honest about knowing nothing at compile time
// ---------------------------------------------------------------------------

function dynamicSpecs(fields: readonly JobField[]) {
  const picked = pickJobDynamic(fields);
  type Dynamic = [
    Expect<Equal<JobOf<typeof picked>, PickedJobDynamic>>,
    Expect<Equal<keyof PickedJobDynamic, JobField | "meta">>,
    Expect<Equal<PickedJobDynamic["id"], string>>,
    Expect<Equal<PickedJobDynamic["source"], JobSource>>,
    Expect<Equal<PickedJobDynamic["company"], string | null>>,
    Expect<Equal<PickedJobDynamic["salaryMin"], number | null>>,
    Expect<Equal<PickedJobDynamic["requirements"], string[]>>,
    Expect<Equal<PickedJobDynamic["meta"]["missing"], Array<Exclude<JobField, "id" | "source">>>>,
    Expect<Equal<PickedJobDynamic["meta"]["sources"], Partial<Record<JobField, JobFieldSource>>>>,
  ];

  // @ts-expect-error -- a runtime list is still a list of real field names
  void pickJobDynamic(["company", "rol"]);
}
