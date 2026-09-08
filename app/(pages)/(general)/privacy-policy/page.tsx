import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/app/lib/seo";

const COMPANY = "Remote Worldwide";
const CONTACT_EMAIL = "hello@remoteworldwide.net";
const JURISDICTION = "Nigeria";
const LAST_UPDATED = "8 September 2026";

const TITLE = `Privacy Policy — ${SITE_NAME}`;
const DESCRIPTION = `What ${SITE_NAME} collects, why we collect it, who we share it with, and how to get it deleted.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/privacy-policy") },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: absoluteUrl("/privacy-policy"), siteName: SITE_NAME },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

const Mail = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold">
    {CONTACT_EMAIL}
  </a>
);

const sections: { id: string; title: string; body: ReactNode }[] = [
  {
    id: "summary",
    title: "The short version",
    body: (
      <>
        <p>
          This policy explains what {COMPANY} does with your data across {SITE_URL} — the job board, the blog, and the career tools in your
          dashboard. In brief:
        </p>
        <ul>
          <li>We collect what you give us (your account, your resumes, your email) and a little about how you use the site.</li>
          <li>We use it to run the service, improve it, and send you the emails you asked for.</li>
          <li>We do not sell your data, and we do not send your resume to employers — you apply on their site, yourself.</li>
          <li>You can export or delete your data at any time by writing to <Mail />.</li>
        </ul>
        <p>
          The sections below are the detail. Our <Link href="/terms">Terms and Conditions</Link> cover the rest of the relationship.
        </p>
      </>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <p>
          <strong>Your account.</strong> Your name, email address and profile picture. If you sign in with Google or GitHub we receive those
          details from them; we never see your password for those accounts. If you sign up with an email address and password, we store the
          password only as a salted hash.
        </p>
        <p>
          <strong>What you create.</strong> Resumes and documents you build or upload, cover letters, interview notes, saved jobs, tracked
          applications, and anything else you enter into the dashboard. Files are stored with our media host.
        </p>
        <p>
          <strong>Email sign-ups.</strong> When you claim a free guide or checklist, we record your email address, which guide you claimed,
          which post you claimed it from, and when you consented.
        </p>
        <p>
          <strong>Usage.</strong> Pages viewed, which listings and calls-to-action you click, plus the technical data any web server
          receives: IP address, browser, device and approximate location derived from the IP.
        </p>
        <p>
          <strong>Sessions.</strong> To show you your signed-in devices and let you sign them out, we record the browser user-agent and IP
          for each active login.
        </p>
        <p>
          We do not ask for payment card details, government identity documents, or the special categories of data (health, religion,
          biometrics and so on). Please do not put them in a document you upload here.
        </p>
      </>
    ),
  },
  {
    id: "why",
    title: "Why we use it",
    body: (
      <>
        <ul>
          <li>
            <strong>To run your account</strong> — signing you in, keeping you signed in, showing your saved jobs and documents, and
            enforcing roles. Without this the service cannot work.
          </li>
          <li>
            <strong>To provide the tools</strong> — scoring a resume, drafting a cover letter, preparing interview answers, tracking your
            applications.
          </li>
          <li>
            <strong>To send you email</strong> — the guide you asked for, and job and product emails you opted into. Every one has an
            unsubscribe link.
          </li>
          <li>
            <strong>To improve the product</strong> — understanding which listings, posts and tools people actually use, in aggregate.
          </li>
          <li>
            <strong>To keep it safe and lawful</strong> — rate limiting, spam and fraud prevention, security investigations, and complying
            with legal obligations.
          </li>
        </ul>
        <p>
          Where the law requires a legal basis, ours is: performing our contract with you (your account and the tools), your consent
          (marketing email and non-essential cookies), our legitimate interests (security, and improving the product), and legal obligation
          where one applies.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <p>
        Some tools send the text you give them — a resume, a job description, your notes — to an AI provider so it can return a score or a
        draft. That happens only when you use the tool, we send the minimum needed, and we do not permit the provider to use your content to
        train its models. If you would rather not have your text processed this way, do not use those tools; the rest of the service works
        without them.
      </p>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>
          <strong>We do not sell your personal information, and we do not share it with advertisers.</strong> We also do not send your
          resume, profile or application history to employers — when you apply, you leave our site and deal with them directly.
        </p>
        <p>We do share data with the service providers that make the site work, and only for that purpose:</p>
        <ul>
          <li>hosting and infrastructure for the site and its database;</li>
          <li>Google and GitHub, if you choose to sign in with them;</li>
          <li>Cloudinary, which stores images and files you upload;</li>
          <li>our AI provider, for the tools described above;</li>
          <li>analytics, to understand aggregate usage;</li>
          <li>email delivery, when we send you a guide or a newsletter.</li>
        </ul>
        <p>
          We may also disclose data if the law requires it, to protect our rights or someone&rsquo;s safety, or to a buyer if the business is
          ever sold — in which case this policy continues to apply until it is replaced and you are told.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <>
        <p>
          <strong>Essential cookies</strong> keep you signed in and protect forms against cross-site request forgery. The site cannot work
          without them, so they are set whenever you use it.
        </p>
        <p>
          <strong>Analytics cookies</strong> tell us which pages and listings are useful, in aggregate. We also store small preferences in
          your browser (for example, a draft you have not submitted) — that data stays on your device.
        </p>
        <p>
          Your browser can block or delete cookies. If you block the essential ones, signing in will stop working. Links we send you may
          carry campaign tags (<code>utm_*</code>) so we know which post or email brought you here; they identify the campaign, not you.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <>
        <ul>
          <li>
            <strong>Account and content</strong> — until you delete it or close your account, then removed from live systems, with backups
            ageing out shortly after.
          </li>
          <li>
            <strong>Email subscriptions</strong> — until you unsubscribe. We keep a record that you unsubscribed so we do not email you
            again by accident.
          </li>
          <li>
            <strong>Login sessions</strong> — until they expire or you revoke them.
          </li>
          <li>
            <strong>Usage and security logs</strong> — a limited period, then deleted or aggregated so they no longer identify you.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>You can ask us to:</p>
        <ul>
          <li>give you a copy of the data we hold about you;</li>
          <li>correct anything that is wrong or incomplete;</li>
          <li>delete your account and its data;</li>
          <li>stop sending marketing email — or use the unsubscribe link, which is instant;</li>
          <li>restrict or object to a particular use, where the law gives you that right.</li>
        </ul>
        <p>
          Write to <Mail /> and we will respond within 30 days. We may need to confirm who you are first. If you are in a place with a data
          protection authority and you are unhappy with our answer, you may complain to it.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Traffic is encrypted in transit, passwords are stored as salted hashes, sessions can be revoked per device, and access to production
        data is limited to the people who need it. No system is perfectly secure, so we cannot guarantee absolute security — if a breach
        ever affects your data, we will tell you and the relevant authority as the law requires.
      </p>
    ),
  },
  {
    id: "transfers",
    title: "Where your data goes",
    body: (
      <p>
        We operate from {JURISDICTION} and our providers run in various countries, so your data may be processed outside where you live.
        When it is, we rely on the safeguards those providers offer, such as standard contractual clauses.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        The service is not for people under 16. We do not knowingly collect their data; if we learn that we have, we delete it. If you
        believe a child has given us information, tell us at <Mail />.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        We update this policy as the product and the law change; the date at the top shows the current version, and we will give reasonable
        notice of anything that materially affects you. Questions, requests or complaints: <Mail />.
      </p>
    ),
  },
];

const Page = () => (
  <div className="min-h-screen bg-white">
    <header
      className="relative overflow-hidden border-b-2 border-primary bg-primary2"
      style={{ backgroundImage: "radial-gradient(#222325 0.9px, transparent 0.9px)", backgroundSize: "22px 22px" }}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#f9f8f1_40%,_rgba(249,248,241,0.55)_75%,_rgba(249,248,241,0.2)_100%)]" />
      <div className="relative mx-auto max-w-[1120px] px-4 pb-10 pt-10 md:pb-14 md:pt-14">
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-primary bg-secondary px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary shadow-[3px_3px_0_0_#222325]">
          Legal
        </span>
        <h1 className="mt-5 text-[2.25rem] font-extrabold leading-[1.05] tracking-[-0.025em] text-primary md:text-[3.25rem]">
          Privacy Policy
        </h1>
        <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-primary/70 md:text-lg">
          What we collect, why we collect it, who we share it with, and how to get it back or get it deleted.
        </p>
        <p className="mt-4 text-sm font-semibold text-primary/55">Last updated {LAST_UPDATED}</p>
      </div>
    </header>

    <div className="mx-auto max-w-[1120px] px-4 py-10 md:py-14 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-14">
      <nav aria-label="On this page" className="mb-10 lg:sticky lg:top-24 lg:mb-0 lg:self-start">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary/55">On this page</p>
        <ol className="mt-3 space-y-1.5">
          {sections.map((section, i) => (
            <li key={section.id} className="flex gap-2 text-sm">
              <span className="w-4 flex-none text-right font-bold text-primary/35">{i + 1}</span>
              <a href={`#${section.id}`} className="text-primary/70 hover:text-primary hover:underline">
                {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <main className="post-prose min-w-0">
        {sections.map((section, i) => (
          <section key={section.id} aria-labelledby={section.id}>
            <h2 id={section.id} className="scroll-mt-24">
              {i + 1}. {section.title}
            </h2>
            {section.body}
          </section>
        ))}
      </main>
    </div>
  </div>
);

export default Page;
