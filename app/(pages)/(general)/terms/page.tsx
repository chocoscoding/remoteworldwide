import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/app/lib/seo";

const COMPANY = "Remote Worldwide";
const CONTACT_EMAIL = "hello@remoteworldwide.net";
const JURISDICTION = "the Federal Republic of Nigeria";
const COURTS = "the courts of Lagos State, Nigeria";
const LAST_UPDATED = "8 September 2026";

const TITLE = `Terms and Conditions — ${SITE_NAME}`;
const DESCRIPTION = `The terms you agree to when you use ${SITE_NAME}: the job board, the career tools, and the emails we send.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/terms") },
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, url: absoluteUrl("/terms"), siteName: SITE_NAME },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

const Mail = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold">
    {CONTACT_EMAIL}
  </a>
);

const sections: { id: string; title: string; body: ReactNode }[] = [
  {
    id: "agreement",
    title: "The agreement",
    body: (
      <>
        <p>
          These terms are a contract between you and {COMPANY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). They cover everything at {SITE_URL}:
          the job board, the company directory, the blog and its downloads, the career tools in your dashboard, and the emails we send you.
        </p>
        <p>
          By using the site or creating an account you accept these terms. If you do not accept them, please do not use the site. If you use
          the site on behalf of an organisation, you confirm you may bind that organisation to these terms.
        </p>
        <p>
          Our <Link href="/privacy-policy">Privacy Policy</Link> explains what we do with your data and forms part of this agreement.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Your account",
    body: (
      <>
        <p>
          You need an account to use the dashboard, save jobs, or claim some downloads. You must be at least 16 years old and able to enter
          a contract. You can sign in with Google or GitHub, or with an email address and password.
        </p>
        <p>
          Keep your sign-in details private — anything done through your account is treated as done by you. Tell us at <Mail /> if you think
          someone else has access. Give us accurate information and keep it current; we may suspend an account we believe is fake,
          impersonating someone, or shared across people.
        </p>
        <p>
          Some accounts carry elevated roles (for example, authors who publish to our blog). Those roles are granted by us, may be changed
          or withdrawn at any time, and come with the extra rules we give you at the time.
        </p>
      </>
    ),
  },
  {
    id: "job-listings",
    title: "Job listings: what we do and do not do",
    body: (
      <>
        <p>
          We collect, check and publish remote job listings, and we link you to the employer&rsquo;s own application page. That is the whole
          of our role. We are not the employer, the recruiter, or an employment agency, and we are not a party to anything that happens
          between you and an employer.
        </p>
        <p>
          Listings come from employers and public sources. We try to keep them accurate and to remove roles that are filled, expired or
          misleading, but we cannot promise a listing is current, complete, genuine, or that the role exists on the terms described. Salary,
          location, seniority and eligibility details are the employer&rsquo;s claims, not ours.
        </p>
        <p>
          Check any employer before you apply, and never send money, banking details or identity documents to someone because of a listing
          you found here. If something looks fraudulent, report it to <Mail /> and we will look into it.
        </p>
        <p>
          We do not guarantee that you will find work, get an interview, or receive an offer. Nothing here is a promise of employment or of
          any particular outcome.
        </p>
      </>
    ),
  },
  {
    id: "tools",
    title: "Career tools and AI output",
    body: (
      <>
        <p>
          The dashboard includes tools such as resume building and ATS scoring, cover letters, interview preparation, application tracking
          and job-specific answers. Several of them produce output using artificial intelligence.
        </p>
        <p>
          AI output can be wrong, outdated, biased or nonsensical, and scores are our own estimate — no employer or applicant tracking system
          uses our scoring. Treat everything these tools produce as a draft: read it, correct it, and take responsibility for it before you
          send it to anyone. Do not rely on it as legal, financial, immigration or professional advice.
        </p>
        <p>
          You are responsible for what you submit to an employer, including anything a tool here helped you write. Usage limits, quotas and
          the mix of available tools may change as the product develops.
        </p>
      </>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    body: (
      <>
        <p>
          Your resumes, documents, notes, application records and anything else you upload or write remain yours. You give us a limited,
          worldwide, royalty-free licence to host, store, copy, process and display that content for one purpose only: running the service
          for you — for example, storing a file so you can download it later, or sending your text to a processor so a tool can return a
          result.
        </p>
        <p>
          That licence ends when you delete the content or your account, other than copies kept in routine backups for a limited period or
          where the law requires us to keep them.
        </p>
        <p>
          Only upload content you have the right to upload, and do not include other people&rsquo;s personal data unless you are allowed to
          share it. We do not routinely review what you store, but we may remove content that breaks these terms or the law.
        </p>
        <p>
          If you post publicly — a comment, a blog contribution, or anything else visible to others — you also let us publish, display and
          distribute it as part of the site, with attribution where appropriate.
        </p>
      </>
    ),
  },
  {
    id: "emails",
    title: "Downloads and emails",
    body: (
      <>
        <p>
          Some guides and checklists are free in exchange for your email address. When you claim one, you get the file and you agree to
          receive related emails from us — new jobs, guides and product updates. Every one of those emails has an unsubscribe link, and
          unsubscribing does not affect your account or anything you already downloaded.
        </p>
        <p>
          The downloads are for your personal use. Do not resell them, republish them, or pass them off as your own.
        </p>
      </>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>While using the site, you agree not to:</p>
        <ul>
          <li>scrape, crawl, harvest or bulk-copy listings, company records or blog content, or build a competing product from them;</li>
          <li>resell, sublicense or redistribute any part of the service or its content;</li>
          <li>use bots or automation to apply to jobs, create accounts, or submit forms at scale;</li>
          <li>upload malware, attempt to breach security, probe our systems, or interfere with other people&rsquo;s use of the site;</li>
          <li>post anything unlawful, deceptive, harassing, hateful, or infringing someone else&rsquo;s rights;</li>
          <li>impersonate anyone, or misrepresent your identity, experience or right to work when applying through a listing;</li>
          <li>reverse-engineer the service or circumvent limits, gates or paywalls;</li>
          <li>use the service in a way that breaks any law that applies to you.</li>
        </ul>
        <p>We may investigate, remove content, throttle usage, or suspend accounts where we reasonably believe this section has been broken.</p>
      </>
    ),
  },
  {
    id: "our-content",
    title: "Our intellectual property",
    body: (
      <p>
        The site, its design, code, brand, logos, written guides and the way we organise our listings belong to {COMPANY} or our licensors.
        You may read, share links to, and personally use our content. You may not copy, adapt, sell or redistribute it beyond what these
        terms allow or what the law permits, and you may not use our name or logo without written permission.
      </p>
    ),
  },
  {
    id: "third-parties",
    title: "Third-party services and links",
    body: (
      <p>
        We rely on third parties to run the service — sign-in providers, hosting, file storage, email and AI processing — and the site links
        out to employers and other websites. Those services have their own terms and privacy practices. We do not control them and we are
        not responsible for their content, their availability, or what happens once you leave our site.
      </p>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: (
      <p>
        We provide the service as it is and as it is available. We may add, change, limit or withdraw features, and there may be downtime for
        maintenance or reasons outside our control. Some features are labelled beta or experimental; expect them to be rough and to change.
        We do not promise uninterrupted or error-free access, and we do not guarantee that data you store here is permanently retained —
        keep your own copies of anything important.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Suspension and closing your account",
    body: (
      <>
        <p>
          You may stop using the service and close your account at any time from your settings or by writing to <Mail />.
        </p>
        <p>
          We may suspend or close an account, or restrict access, if you break these terms, if we are required to by law, or to protect the
          service and its users. Where it is reasonable to do so, we will tell you why. Sections that by their nature should survive — your
          content licence for material already published, intellectual property, disclaimers, liability, indemnity and governing law —
          continue to apply after your account ends.
        </p>
      </>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers",
    body: (
      <p>
        To the fullest extent the law allows, the service is provided without warranties of any kind, express or implied, including
        warranties of merchantability, fitness for a particular purpose, accuracy, and non-infringement. We do not warrant that listings are
        genuine or current, that tool output is accurate, that the service will meet your needs, or that using it will lead to employment.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Limitation of liability",
    body: (
      <>
        <p>
          To the fullest extent the law allows, we are not liable for lost profits, lost opportunities, lost or corrupted data, or any
          indirect, incidental, special or consequential loss arising from your use of the service — including anything that happens between
          you and an employer, and any decision you make on the basis of tool output.
        </p>
        <p>
          Where we are found liable despite the above, our total liability for all claims in any twelve-month period is limited to the
          greater of the amount you paid us in that period, or fifty US dollars (USD 50).
        </p>
        <p>
          Nothing here excludes liability that cannot legally be excluded, including for fraud or for death or personal injury caused by our
          negligence.
        </p>
      </>
    ),
  },
  {
    id: "indemnity",
    title: "Indemnity",
    body: (
      <p>
        You agree to cover our reasonable losses, costs and legal fees if a third party brings a claim against us because of your use of the
        service, content you submitted, or your breach of these terms or of the law.
      </p>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These terms are governed by the laws of {JURISDICTION}, and {COURTS} have exclusive jurisdiction over any dispute — except that
        either of us may seek urgent injunctive relief in any competent court. If any part of these terms is found unenforceable, the rest
        continues to apply. Our not enforcing a term on one occasion is not a waiver of it.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these terms",
    body: (
      <p>
        We may update these terms as the service changes or the law requires. The date at the top always shows the current version. For
        changes that materially affect your rights we will give reasonable notice — a notice on the site or an email to your account
        address. Continuing to use the service after a change means you accept the updated terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these terms, a listing, or your account: write to <Mail />. For privacy requests, see our{" "}
        <Link href="/privacy-policy">Privacy Policy</Link>.
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
          Terms and Conditions
        </h1>
        <p className="mt-4 max-w-[62ch] text-base leading-relaxed text-primary/70 md:text-lg">
          The rules for using {SITE_NAME} — the job board, the career tools and the emails we send. Written to be read, not to be endured.
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
