import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/app/lib/seo";

const COMPANY = "Remote Worldwide";
const CONTACT_EMAIL = "hello@remoteworldwide.net";
const JURISDICTION = "Nigeria";
const LAST_UPDATED = "23 September 2026";

const TITLE = `Privacy Policy — ${SITE_NAME}`;
const DESCRIPTION = `What ${SITE_NAME} collects, why we collect it, who we share it with, and how to get it back or get it deleted.`;

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
          This policy explains what {COMPANY} does with your data across {SITE_URL}: the job board, the blog, the career tools in your
          dashboard, and our Chrome extension. In brief:
        </p>
        <ul>
          <li>We collect what you give us (your account, resumes, documents, answers and contacts) and some data about how you use the site.</li>
          <li>We use it to run the service, and send parts of it to the providers behind the AI and voice tools, only when you use those tools.</li>
          <li>We do not sell your data and we do not share it with advertisers.</li>
          <li>
            You can download your data or delete your account yourself, from Settings, at any time. You can also write to <Mail />.
          </li>
        </ul>
        <p>
          The sections below give the detail. Our <Link href="/terms">Terms and Conditions</Link> cover the rest of our relationship with you.
        </p>
      </>
    ),
  },
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <p>
        {COMPANY} (&ldquo;we&rdquo;, &ldquo;us&rdquo;) runs {SITE_URL} from {JURISDICTION} and is responsible for the personal data described
        here. For anything about your data, including the requests in <a href="#your-rights">Your rights and controls</a>, contact <Mail />.
      </p>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <>
        <p>
          <strong>Your account.</strong> Your name, email address and profile photo. If you sign in with Google or GitHub, we receive those
          details from them and store the tokens they issue so the sign-in keeps working; we never see your password for those accounts. If you
          sign up with an email address and password, we store the password only as a salted hash and ask you to confirm your address.
        </p>
        <p>
          <strong>Signed-in devices.</strong> For each login we record the browser, the IP address and when it was last used, so you can see
          your devices and sign them out. These records expire after 30 days.
        </p>
        <p>
          <strong>What you create.</strong> Resumes, cover letters, documents you upload to your vault, saved jobs, tracked applications,
          interview practice and reports, career coach and &ldquo;Ask about a job&rdquo; conversations, your plan and streak, and the answers you
          save for job application forms. If you choose to save answers to demographic questions (for example gender, ethnicity, disability or
          veteran status), or upload an identity document to your vault, we store them like any other content. Demographic answers are never
          sent to our AI providers.
        </p>
        <p>
          <strong>People in your network.</strong> If you import your LinkedIn connections or save people from a referral search, we store data
          about those people. See <a href="#your-network">People in your network</a>.
        </p>
        <p>
          <strong>Voice.</strong> Recordings of interview practice and, when you use talk mode, your voice in the career coach and &ldquo;Ask
          about a job&rdquo;. See <a href="#voice">Voice and interview practice</a>.
        </p>
        <p>
          <strong>Email sign-ups.</strong> When you download a free guide or checklist, we record your email address, which guide it was, which
          post you found it on, and when you consented.
        </p>
        <p>
          <strong>Usage.</strong> Pages you view and what you click, recorded by the analytics tools listed in{" "}
          <a href="#cookies">Cookies and browser storage</a>, plus the technical data any web server receives: IP address, browser, device and
          approximate location.
        </p>
        <p>We do not take card payments on the site, so we do not collect payment card details.</p>
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
            <strong>To run your account</strong>: signing you in, keeping you signed in, and showing your jobs, documents and progress. The
            service cannot work without this.
          </li>
          <li>
            <strong>To provide the tools</strong>: scoring a resume, drafting a cover letter, answering questions about a job, running
            interview practice, filling application forms and finding people for a referral.
          </li>
          <li>
            <strong>To email you</strong>: account and security email, and the updates you opted into (see <a href="#email">Email</a>).
          </li>
          <li>
            <strong>To improve the product</strong>: understanding which listings, posts and tools people use.
          </li>
          <li>
            <strong>To keep it safe and lawful</strong>: rate limits, spam and fraud prevention, security investigations and legal obligations.
          </li>
        </ul>
        <p>
          Where the law asks for a legal basis, ours are: performing our contract with you (your account and the tools you use), your consent
          (optional email, and data you choose to give us such as demographic answers), our legitimate interests (security, analytics and
          improving the product), and legal obligation where one applies.
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <>
        <p>
          The career tools send the text they need to AI providers, only when you use a tool. That text can include parts of your resume, the
          job posting, your profile details and what you type into a chat. The providers are:
        </p>
        <ul>
          <li>
            <strong>Groq</strong>, which runs the language model that writes scores, drafts, answers, coaching and interview reports. It
            receives text only, never your audio.
          </li>
          <li>
            <strong>Voyage AI</strong> (a MongoDB company), which turns resume and job text into numbers we use to match them.
          </li>
          <li>
            <strong>ElevenLabs</strong>, for the voice features in <a href="#voice">Voice and interview practice</a>, and{" "}
            <strong>Google Cloud Text-to-Speech</strong> when ElevenLabs is unavailable. Interview questions are read aloud this way, and a
            question can quote your resume or the job posting.
          </li>
          <li>
            <strong>Exa</strong>, a web search service used for referral search. It receives the company and role you are searching for, never
            who you are.
          </li>
          <li>
            <strong>ScrapingAnt</strong>, which fetches the job pages you import and the links you paste into a chat.
          </li>
        </ul>
        <p>
          Each provider handles the data under its own terms. If you would rather your text was not processed this way, don&rsquo;t use those
          tools; the rest of the service works without them. The career coach uses your job-search activity as context only while &ldquo;AI
          coaching&rdquo; is switched on in Settings.
        </p>
      </>
    ),
  },
  {
    id: "voice",
    title: "Voice and interview practice",
    body: (
      <>
        <p>
          <strong>Interview practice is a recorded voice session.</strong> When voice practice is available, every session is recorded, and the
          setup screen says so before you start. Here is what happens:
        </p>
        <ul>
          <li>
            your microphone is recorded in your browser and uploaded in short pieces while you speak. It records whatever it picks up, including
            the interviewer&rsquo;s questions if they play through your speakers, so headphones keep the recording to your answers;
          </li>
          <li>
            the live interviewer runs on <strong>ElevenLabs</strong>, which receives your voice as you speak and the text of each reply;
          </li>
          <li>
            afterwards, <strong>ElevenLabs</strong> also transcribes the whole recording for your report;
          </li>
          <li>
            our own analysis service measures how you used your voice, such as pace, pauses, pitch movement and loudness, each compared with the
            rest of your session. It receives the audio but not the transcript or who you are, and keeps nothing afterwards;
          </li>
          <li>Groq then writes your report from the transcript and those measurements. It never receives the audio;</li>
          <li>
            the recording is stored with <strong>Cloudflare R2</strong> so you can play it back from your report. We do not use recordings to
            identify you, and nothing we run tries to detect your mood or feelings or to guess where you are from.
          </li>
        </ul>
        <p>
          <strong>Talk mode</strong> in the career coach and &ldquo;Ask about a job&rdquo; also runs on ElevenLabs: it hears you as you speak and
          reads answers aloud. We keep the conversation&rsquo;s text, not the audio.
        </p>
        <p>
          <strong>How long we keep it.</strong> A recording, its transcript and its report are kept until you delete that session or your
          account. Upload pieces and working copies are deleted once the report is made, and automatically within 7 days at most. ElevenLabs
          keeps its own copies of what it processes under its own terms; deleting a session here does not delete them.
        </p>
        <p>
          <strong>Dictation is different.</strong> The microphone button that types what you say uses your browser&rsquo;s own speech service.
          We do not store that audio, but your browser may send it to its maker to turn into text: in Chrome, that is Google.
        </p>
      </>
    ),
  },
  {
    id: "your-network",
    title: "People in your network",
    body: (
      <>
        <p>
          <strong>LinkedIn connections.</strong> If you upload the Connections.csv file from your LinkedIn data export, we store each
          connection&rsquo;s name, LinkedIn profile link, company, position, the date you connected, their email address if they chose to share
          it with their connections, and any notes you add. We read the file and do not keep it.
        </p>
        <p>
          <strong>Referral search.</strong> When you search for people at a company, we search the public web and store the results for you: a
          person&rsquo;s name, title, location, profile link and the company&rsquo;s phone number, and an email address that is either one we
          found or a likely one worked out from the company&rsquo;s email format. Likely addresses are labelled as unverified. We never look for
          personal phone numbers.
        </p>
        <p>
          These people are visible only to you, and we do not contact them: any message is sent by you, from your own email or LinkedIn. You can
          delete contacts one at a time or all together; saved searches and referral requests are removed when you delete your account. If you
          appear in a user&rsquo;s contacts or search results and want your details removed, write to <Mail />.
        </p>
      </>
    ),
  },
  {
    id: "extension",
    title: "The Chrome extension",
    body: (
      <>
        <p>
          The extension works on job application pages: Greenhouse, Lever and Ashby, plus any other site you switch it on for. It does not run in
          incognito windows. On those pages it reads the form&rsquo;s questions, your current answers, and the job details shown on the page.
        </p>
        <ul>
          <li>
            It fills fields only when you ask, using your saved answers or AI drafts for the questions you choose. Question labels are sent to
            Groq for drafting; demographic questions never are.
          </li>
          <li>It never reads or fills identity numbers, bank or card numbers, passwords or dates of birth, and it never submits a form for you.</li>
          <li>Demographic answers are filled only from answers you saved yourself, and only if you switch that setting on. It is off by default.</li>
          <li>
            When it sees an application submitted, it logs it to your tracker after a 10-second window in which you can undo it. You can switch
            logging off.
          </li>
        </ul>
        <p>It talks only to {SITE_URL}, using your existing sign-in, and keeps its settings and a short-lived cache in your browser.</p>
      </>
    ),
  },
  {
    id: "others-see",
    title: "What other people can see",
    body: (
      <>
        <p>Most of your data is visible only to you. The exceptions are:</p>
        <ul>
          <li>
            <strong>Pods.</strong> If you join an accountability pod, its members see your name and photo, your streak, how many applications
            you logged this week, whether you logged today, and your posts and votes in the pod. Members are emailed when someone new joins. When
            you log a job offer, the pod sees a post saying you landed that role at that company. Pods are rearranged weekly, and inactive members
            are removed.
          </li>
          <li>
            <strong>Invites.</strong> If you joined through someone&rsquo;s invite link, they see your name, when you joined, and whether you
            became a paying member.
          </li>
          <li>
            <strong>Recommendations.</strong> Our team may put candidates forward to hiring companies. If you are put forward, your name and the
            answers you give to that company&rsquo;s questions are shared with its hiring team.
          </li>
          <li>
            <strong>Things you share.</strong> Share cards and captions leave the site only when you press a share button, and their links carry
            your invite code.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Who we share it with",
    body: (
      <>
        <p>
          <strong>We do not sell your personal information, and we do not share it with advertisers.</strong> We share data with the service
          providers that make the site work, and only so they can do that work:
        </p>
        <ul>
          <li>
            hosting and infrastructure: Vercel (the website), MongoDB Atlas (our database), CloudAMQP (background jobs), and the hosts that run
            our services and caches;
          </li>
          <li>Cloudflare R2, which stores your documents, profile photo, voice recordings and interview audio;</li>
          <li>Google and GitHub, if you choose to sign in with them;</li>
          <li>
            the AI and voice providers in <a href="#ai">AI processing</a>: Groq, Voyage AI, ElevenLabs, Google Cloud Text-to-Speech, Exa and
            ScrapingAnt;
          </li>
          <li>Resend, which delivers our email;</li>
          <li>Google Analytics, Hotjar and Vercel Analytics, which tell us how the site is used.</li>
        </ul>
        <p>
          We may also disclose data if the law requires it, to protect our rights or someone&rsquo;s safety, or to a buyer if the business is ever
          sold. In that case this policy continues to apply until it is replaced and you are told.
        </p>
      </>
    ),
  },
  {
    id: "email",
    title: "Email",
    body: (
      <>
        <p>
          <strong>Always sent</strong>, because they are part of running your account: sign-up, email confirmation, password reset and change,
          account deletion notices, a low credit balance, an AI report you were waiting for, and pod membership notices.
        </p>
        <p>
          <strong>Optional</strong>, each switched in Settings and each with a one-click unsubscribe link: the weekly digest, replies on
          recommendations, pod activity and product news. The digest and recommendation replies start switched on; the others start off.
        </p>
        <p>
          Downloading a free guide does not sign you up to any email. To have your address removed from our guide sign-up list, write to{" "}
          <Mail />.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and browser storage",
    body: (
      <>
        <p>
          <strong>Essential cookies</strong> keep you signed in and protect forms against cross-site request forgery. If you follow someone&rsquo;s
          invite link, a cookie remembers the invite for 30 days so it counts when you sign up.
        </p>
        <p>
          <strong>Analytics.</strong> Google Analytics and Hotjar set cookies and record how pages are used, including clicks and scrolling.
          Vercel Analytics measures visits and page speed without cookies. They load on every page.
        </p>
        <p>
          <strong>Browser storage.</strong> To keep the dashboard fast we keep a copy of some of your data, such as your settings, profile and
          tracker, in your browser for up to 24 hours, and clear it when you sign out. Unsent drafts and small preferences are also kept in your
          browser and stay on your device.
        </p>
        <p>
          Your browser can block or delete cookies; blocking the essential ones stops sign-in working. Links we share can carry campaign tags (
          <code>utm_*</code>) so we know which post or email brought someone here.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep it",
    body: (
      <ul>
        <li>
          <strong>Account and content</strong>: until you delete it or your account.
        </li>
        <li>
          <strong>Voice recordings, transcripts and reports</strong>: until you delete the session or your account. Upload pieces and working
          copies go within 7 days.
        </li>
        <li>
          <strong>Signed-in devices</strong>: 30 days after last use, or until you sign the device out.
        </li>
        <li>
          <strong>Confirmation and password reset links</strong>: 24 hours and 30 minutes.
        </li>
        <li>
          <strong>Notifications</strong>: 90 days.
        </li>
        <li>
          <strong>Guide sign-ups</strong>: until you ask us to remove them.
        </li>
        <li>
          <strong>Operational and security logs</strong>: a limited period, overwritten as new logs are written.
        </li>
      </ul>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights and controls",
    body: (
      <>
        <p>
          <strong>Download your data</strong> from Settings → Privacy → Download my data. You get a JSON file with your account, content and
          activity across our services. Uploaded files are not inside it; you can download those from your documents.
        </p>
        <p>
          <strong>Delete your account</strong> from Settings → Account. Your account is locked and signed out everywhere at once, then deleted 7
          days later; you can cancel before then, and we email you either way. Deletion removes your profile, content, documents, recordings,
          contacts, pod membership, invites and settings. We keep:
        </p>
        <ul>
          <li>a record of credit purchases and spending with your identity removed, for our accounts;</li>
          <li>a note that an account with your ID was deleted, for 90 days, so it cannot be restored by mistake;</li>
          <li>your guide sign-up email, if you gave one, until you ask us to remove it;</li>
          <li>copies held by our providers under their own terms, such as ElevenLabs.</li>
        </ul>
        <p>You can also ask us to:</p>
        <ul>
          <li>give you a copy of the data we hold about you;</li>
          <li>correct anything that is wrong or incomplete;</li>
          <li>delete specific data;</li>
          <li>stop optional email (the unsubscribe link does this instantly);</li>
          <li>restrict or object to a particular use, where the law gives you that right.</li>
        </ul>
        <p>
          Write to <Mail /> and we will respond within 30 days; we may need to confirm who you are first. If you are unhappy with our answer, you
          can complain to the Nigeria Data Protection Commission or to the data protection authority where you live.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Traffic is encrypted in transit, passwords and one-time links are stored only as hashes, stored documents are private and opened through
        short-lived links, sessions can be revoked per device, and access to production data is limited to the people who need it. No system is
        perfectly secure, so we cannot guarantee absolute security. If a breach affects your data, we will tell you and the relevant authority as
        the law requires.
      </p>
    ),
  },
  {
    id: "transfers",
    title: "Where your data goes",
    body: (
      <p>
        We operate from {JURISDICTION}, and our providers run in several countries, including the United States and the European Union, so your
        data may be processed outside the country you live in. When it is, we rely on the safeguards those providers offer, such as standard
        contractual clauses.
      </p>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: (
      <p>
        The service is not for people under 16. We do not knowingly collect their data, and if we learn that we have, we delete it. If you
        believe a child has given us information, tell us at <Mail />.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes and contact",
    body: (
      <p>
        We update this policy as the product and the law change. The date at the top shows the current version, and we will give reasonable
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
