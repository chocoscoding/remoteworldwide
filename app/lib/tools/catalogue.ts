// The public AI tool pages (/tools and /tools/[slug]): one entry per tool, in the order the
// search runs. Every claim here was checked against the app on 2026-10-05 (plans and gates:
// remoteworldwideai planService; credits: CREDIT_COSTS in app/lib/pricing/catalogue.ts; the
// extension's sites: rwwextension's adapters). Change a feature, change its line here.
//
// House rules for the words: no em dashes, no rival product names, no invented numbers or users.
// Slugs are the searches each page answers, so keep them once Google has them.

import type { StoryLine } from "@/app/components/waitlist/ProblemStory";
import { EXTENSION_URL } from "@/app/lib/extension/url";

export type ToolKey = "resume" | "ats" | "cover" | "autofill" | "extension" | "interview" | "tracker";

export type Tool = {
  key: ToolKey;
  slug: string;
  /** The page's H2-sized name, and the link text everywhere else. */
  name: string;
  /** Which step of the search it covers, over the name on cards. */
  step: string;
  /** One or two sentences for the hub and "the rest of the toolkit" cards. */
  card: string;
  /** Where it starts, on the hub's cards. */
  planBadge: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  eyebrow: string;
  h1: { before: string; mark: string; after?: string };
  intro: string;
  heroChecks: string[];
  /** Where a signed-in visitor goes. */
  dashboardHref: string;
  openLabel: string;
  /** A second way in under the hero form, e.g. the store listing. */
  secondary?: { label: string; href: string; external?: boolean };
  problem: StoryLine[];
  problemAfter: string;
  stepsHeading: string;
  steps: { title: string; body: string }[];
  featuresHeading: string;
  features: { title: string; body: string }[];
  whyHeading: string;
  why: { old: string; now: string }[];
  cost: { heading: string; body: string };
  /** The schema.org Offer's note: what is free and what is not. */
  priceNote: string;
  faq: { q: string; a: string }[];
  related: ToolKey[];
  finalHeading: string;
};

export const TOOLS: Tool[] = [
  {
    key: "resume",
    slug: "ai-resume-builder",
    name: "AI resume builder",
    step: "Tailor",
    card: "Build a clean resume in six templates, then tailor it to each posting with AI that rewrites your own bullets. Export to PDF or Word.",
    planBadge: "Builder free, AI on Basic",
    metaTitle: "AI Resume Builder: Tailor Your Resume to Every Job | Remote Worldwide",
    metaDescription:
      "Build your resume in six ATS-friendly templates, then tailor it to each posting with AI: missing keywords, sharper bullets, one page. Export to PDF or Word.",
    keywords: ["ai resume builder", "tailor resume to job description", "ats friendly resume", "resume builder", "remote job resume"],
    eyebrow: "Resume builder · six templates",
    h1: { before: "A resume tailored to", mark: "every posting", after: "in minutes." },
    intro:
      "Start from scratch, from the resume you already have, or let AI build one from your profile. Then aim it at a job: AI finds the keywords you're missing and sharpens your bullets, in your words, and you approve every change.",
    heroChecks: ["One resume free", "PDF, Word or Markdown", "Your original stays untouched"],
    dashboardHref: "/dashboard/resume",
    openLabel: "Open the resume builder",
    problem: [
      { text: "One resume, sent to fifty different postings." },
      { text: "Each one asked for *slightly* different *words*." },
      { text: "So you *rewrite* bullets at midnight, *guess* what to cut, and *fight* the layout every time a line wraps." },
      { text: "Tailoring shouldn't take an evening per job.", mark: true },
    ],
    problemAfter: "So we built a resume that tailors itself, with you in charge.",
    stepsHeading: "From blank page to tailored resume.",
    steps: [
      { title: "Start your way", body: "From scratch, from a PDF or Word file you upload, or built with AI from your profile and a target seniority." },
      { title: "Aim it at a job", body: "Pick a saved posting. AI tailors the resume to it and lists the keywords it can't find, so you tick in the ones that are true." },
      { title: "Polish and export", body: "Rewrite a section three ways, quantify your bullets, trim to one page, then download it as a PDF or a Word file." },
    ],
    featuresHeading: "Everything a resume needs, nothing it doesn't.",
    features: [
      { title: "Six templates, one click apart", body: "Atlas, Beacon, Cadence, Linen, Meridian and Quarry. Switch any time; your content stays put and the switch is one undo away." },
      { title: "Tailor to a job", body: "Point it at a saved posting and AI reshapes your experience around what that role asks for, using what you actually did." },
      { title: "Add missing keywords", body: "See the terms the posting uses that your resume doesn't, and add the ones that are true to your skills, one by one or all at once." },
      { title: "Polish the writing", body: "Rewrite a section with three phrasings to choose from, quantify your bullets, shorten to one page, or fix tone and grammar." },
      { title: "Readable by an ATS", body: "PDF exports keep selectable text, and the Word file is always one column, the layout applicant tracking systems parse best." },
      { title: "Make it yours", body: "Colours, fonts, header, headings, spacing, photo, links and section order, plus your own custom sections. Every page is A4." },
    ],
    whyHeading: "Stop rewriting. Start tailoring.",
    why: [
      { old: "One generic resume for every posting", now: "A version tailored to each job" },
      { old: "Guessing which keywords matter", now: "The missing keywords, listed for you" },
      { old: "Fighting margins in a word processor", now: "Six templates that keep their layout" },
      { old: "Vague bullets with no numbers", now: "Bullets quantified, in your own words" },
    ],
    cost: {
      heading: "The builder is free. AI help starts on Basic.",
      body: "Free keeps one resume you can edit and tailor by hand, with every template and export. Basic adds AI help (1 credit per suggestion, 3 to build a full resume with AI) and unlimited resumes.",
    },
    priceNote: "Free plan includes one resume; AI help from the Basic plan, paid in credits.",
    faq: [
      { q: "Is the resume builder free?", a: "Yes. Free includes one resume with every template and export (PDF, Word and Markdown). AI help in the builder and more than one resume come with Basic." },
      { q: "Will AI make things up on my resume?", a: "No. It writes from your own resume or profile, and won't invent a career if you've given it nothing to work from. You see every suggestion before it's applied." },
      { q: "Is the resume ATS-friendly?", a: "PDF exports keep real, selectable text, and the Word export is always a single column, which applicant tracking systems read most reliably. You can check any version with the ATS resume checker." },
      { q: "Can I import my existing resume?", a: "Yes. Upload a PDF, Word or text file and it's turned into an editable resume you can restyle and tailor." },
      { q: "How much does AI help cost?", a: "Each AI suggestion (tailor to a job, add keywords, rewrite, quantify, shorten, fix grammar) is 1 credit. Building a whole resume with AI is 3 credits, charged only when it comes back." },
      { q: "What page size are resumes?", a: "Every resume is A4." },
    ],
    related: ["ats", "cover", "autofill"],
    finalHeading: "Your next resume, tailored in minutes.",
  },
  {
    key: "ats",
    slug: "ats-resume-checker",
    name: "ATS resume checker",
    step: "Score",
    card: "Score your resume against any posting, keyword by keyword, and see exactly which requirements it misses before an applicant tracking system does.",
    planBadge: "Every plan · 1 credit",
    metaTitle: "ATS Resume Checker: Free Resume Score Against Any Job | Remote Worldwide",
    metaDescription:
      "Check your resume against any job posting: a 0 to 100 match score, the keywords you're missing, the requirements you only partly cover, and rewrites to fix them.",
    keywords: ["ats resume checker", "resume score", "ats score", "resume keyword checker", "check resume against job description"],
    eyebrow: "ATS scorer · on every plan",
    h1: { before: "Know your", mark: "match score", after: "before you apply." },
    intro:
      "Paste a posting or pick one from the board, add your resume, and get a 0 to 100 score with every requirement checked: found, partly covered or missing, and the closest line in your resume for each.",
    heroChecks: ["1 credit per scan", "Works on the Free plan", "Paste a link or the whole posting"],
    dashboardHref: "/dashboard/ats",
    openLabel: "Open the ATS checker",
    problem: [
      { text: "You're qualified. You applied. *Silence*." },
      { text: "Somewhere, a *filter* read your resume *before* a person did." },
      { text: "It was looking for *words* you never knew to *use*." },
      { text: "You can't fix what you can't see.", mark: true },
    ],
    problemAfter: "So we show you what the filter sees.",
    stepsHeading: "A score, the gaps and the fix.",
    steps: [
      { title: "Add your resume", body: "Pick one from My documents or upload a PDF, Word or text file." },
      { title: "Add the job", body: "Choose a listing from the board, or paste a link or the whole posting and we fill in the fields. Or get a general score with no job." },
      { title: "Close the gaps", body: "See every missing or partly covered requirement, the closest line you already have, and rewrites that sharpen your own words." },
    ],
    featuresHeading: "More than a number.",
    features: [
      { title: "A 0 to 100 match score", body: "With a plain band: Strong match from 85, Good, not yet great from 65, or Needs work. No mystery maths." },
      { title: "Four things that move it", body: "Keyword match, parseability, impact language, and length and format, each scored on its own." },
      { title: "Every gap, explained", body: "Requirements marked Not found or Partly covered, flagged where the posting says they're required, beside the closest line in your resume." },
      { title: "Keyword by keyword", body: "Which of the posting's keywords you cover and which you're missing, at a glance." },
      { title: "Suggested rewrites", body: "Your bullets, sharpened: a before and after for the lines that would lift your score most." },
      { title: "A report to keep", body: "Download it as a PDF, Word or Markdown file, and add any gap to your plan as a task." },
    ],
    whyHeading: "Stop guessing what the ATS wants.",
    why: [
      { old: "Applying and hoping it gets through", now: "A match score before you send it" },
      { old: "Reading the posting three times for keywords", now: "Every keyword, covered or missing" },
      { old: "Not knowing which requirement you missed", now: "Each gap beside your closest line" },
      { old: "Rewriting from scratch", now: "Rewrites of the bullets you already have" },
    ],
    cost: {
      heading: "1 credit a scan, on every plan.",
      body: "The checker isn't behind a plan. Free comes with 50 credits a month, so you can score dozens of applications before paying anything.",
    },
    priceNote: "1 credit per scan on every plan, including Free (50 credits a month).",
    faq: [
      { q: "Is the ATS resume checker free?", a: "It's on every plan, including Free. Each scan costs 1 credit, and Free comes with 50 credits every month." },
      { q: "What is an ATS?", a: "An applicant tracking system: the software employers use to collect applications and, often, to filter and rank them by how well a resume matches the posting." },
      { q: "Do I need a job posting to get a score?", a: "No. You can get a general score with no job. Scoring against a posting tells you much more: which of its requirements and keywords you cover." },
      { q: "Can I check against a job from another site?", a: "Yes. Paste the link or the whole posting text and we fill in the fields for you." },
      { q: "What file types can I upload?", a: "PDF, Word (.docx) and plain text, or any resume you've made in the resume builder." },
      { q: "Does ticking a gap change my score?", a: "It shows a projected lift, clearly labelled as a projection. To get a new score, update your resume and scan it again." },
    ],
    related: ["resume", "cover", "tracker"],
    finalHeading: "See your score before theirs do.",
  },
  {
    key: "cover",
    slug: "ai-cover-letter-generator",
    name: "AI cover letter generator",
    step: "Write",
    card: "A first draft written from the posting and your real resume, in the tone you choose. Edit it, revise it to your own note, and download it.",
    planBadge: "One letter free",
    metaTitle: "AI Cover Letter Generator from Your Resume | Remote Worldwide",
    metaDescription:
      "Write a cover letter from the job posting and your real resume, in four tones from warm to formal. Edit it, revise it to your own note, and download a PDF or Word file.",
    keywords: ["ai cover letter generator", "cover letter generator", "cover letter from resume", "write a cover letter", "remote job cover letter"],
    eyebrow: "Cover letters · four tones",
    h1: { before: "A cover letter that sounds like", mark: "you", after: "on your best day." },
    intro:
      "Pick the job and your resume, choose a tone, and get a first draft built from what you've actually done. Then make it yours: edit it, ask for a revision in your own words, and download it.",
    heroChecks: ["One letter free", "Built from your resume", "PDF or Word download"],
    dashboardHref: "/dashboard/cover",
    openLabel: "Open cover letters",
    problem: [
      { text: "The posting says cover letter *optional*." },
      { text: "It *isn't*." },
      { text: "So you *stare* at a blank page, *copy* last week's letter, and *swap* the company name, hoping you caught them all." },
      { text: "The letter is where you sound like a person. Make it count.", mark: true },
    ],
    problemAfter: "So we write the first draft, and you make it yours.",
    stepsHeading: "From blank page to sent, in three moves.",
    steps: [
      { title: "Pick the job and your resume", body: "A listing from the board, a link, or the posting pasted in, plus the resume you're sending." },
      { title: "Choose a tone", body: "Warm and direct, Formal, Story-led or Short. Each one is written to its own length, from two paragraphs to four." },
      { title: "Make it yours", body: "Edit it in place, ask for a revision to your own note, then copy it, print it or download it." },
    ],
    featuresHeading: "A draft worth editing, not rewriting.",
    features: [
      { title: "Grounded in your resume", body: "It writes from your real experience and the posting's actual asks, so the letter connects the two instead of repeating your resume." },
      { title: "Four tones", body: "Warm and direct, Formal, Story-led or Short. Switch back to a tone you've already written for free." },
      { title: "Revise to your own note", body: "Tell it what to change in plain words, like \"lead with the design system\" or \"less formal\", and get a reworked draft." },
      { title: "A real editor", body: "Rich text with theme, font, spacing and letterhead controls, so it looks as considered as it reads." },
      { title: "Ready to send", body: "Copy it, print it, or download it as a PDF or Word file. In the browser extension, you can write one and insert it straight into the form." },
    ],
    whyHeading: "Stop starting from a blank page.",
    why: [
      { old: "A blank page and a blinking cursor", now: "A first draft from your resume and the posting" },
      { old: "Last week's letter with the name swapped", now: "A letter written for this role" },
      { old: "One voice for every company", now: "Four tones, from warm to formal" },
      { old: "Rewriting it all to change one thing", now: "Revisions to your own note" },
    ],
    cost: {
      heading: "One letter free. 2 credits a draft.",
      body: "Free keeps one cover letter you can edit, revise and download. Each new draft is 2 credits and a revision is 1. Basic and up keep as many letters as you write.",
    },
    priceNote: "Free plan keeps one cover letter; drafts cost 2 credits and revisions 1.",
    faq: [
      { q: "Is the cover letter generator free?", a: "Free keeps one cover letter, and drafting it uses 2 of your 50 monthly credits. Editing, revising and downloading it stay open. Basic and up keep as many letters as you like." },
      { q: "Does it make up experience?", a: "No. It writes from the resume you choose and the posting, and you approve and edit every word before you send it." },
      { q: "Can I write my own instead?", a: "Yes. \"Write your own\" opens a blank letter in the same editor, with the same themes and downloads." },
      { q: "How long is each letter?", a: "Short is two paragraphs, Warm and direct is three, and Formal and Story-led are four." },
      { q: "What formats can I download?", a: "PDF and Word (.docx). You can also copy it or print it." },
    ],
    related: ["resume", "autofill", "ats"],
    finalHeading: "Your next letter, half written already.",
  },
  {
    key: "autofill",
    slug: "job-application-autofill",
    name: "Job application autofill",
    step: "Apply",
    card: "A Chrome extension that fills application forms from your profile and saved answers on Greenhouse, Lever and Ashby, only when you press the button.",
    planBadge: "Free · Chrome",
    metaTitle: "Job Application Autofill Extension for Chrome | Remote Worldwide",
    metaDescription:
      "Fill job applications on Greenhouse, Lever and Ashby from your profile and saved answers, on your click. Draft open answers with AI and track every application.",
    keywords: ["job application autofill", "autofill job applications", "job application chrome extension", "greenhouse autofill", "lever autofill"],
    eyebrow: "Chrome extension · on the Web Store",
    h1: { before: "Fill the form", mark: "on your click,", after: "not before." },
    intro:
      "The Remote Worldwide extension fills application forms from your profile and the answers you've saved. Nothing is typed until you press the button, and it never submits for you.",
    heroChecks: ["Autofill is free", "Never fills without a click", "Never submits a form"],
    dashboardHref: EXTENSION_URL,
    openLabel: "Add it to Chrome",
    secondary: { label: "See it on the Chrome Web Store", href: EXTENSION_URL, external: true },
    problem: [
      { text: "Name. Email. LinkedIn. Portfolio." },
      { text: "*Again*. On *every* form." },
      { text: "Then why do you *want* to work here, in a box that *forgets* everything if you close the tab." },
      { text: "Applying shouldn't mean typing your life story twice a day.", mark: true },
    ],
    problemAfter: "So the form fills itself, the moment you ask.",
    stepsHeading: "Open the form. Press the button. Check it. Send it.",
    steps: [
      { title: "Open an application", body: "On Greenhouse, Lever or Ashby the extension recognises the form. Add any other careers site from the panel with one permission." },
      { title: "Press autofill", body: "It fills from your resume and saved answers, or continues a draft you started. Open questions can be drafted with AI." },
      { title: "Review and submit", body: "You check every field and press submit yourself. It tracks the application, with ten seconds to undo." },
    ],
    featuresHeading: "Faster forms, with you in control.",
    features: [
      { title: "Consent first", body: "Nothing is typed until you press a button. Filling as the form loads is a setting, off unless you turn it on." },
      { title: "Your saved answers", body: "Save an answer once and reuse it on the next form. Saving to your profile is free." },
      { title: "AI for open questions", body: "\"Answer with AI\" drafts a reply from your resume and the posting; writing several at once is 1 credit for up to eight." },
      { title: "Drafts that remember", body: "Close the tab halfway through and your answers are kept as a draft, free, with a small badge on the page when one is waiting." },
      { title: "Score and tailor in the panel", body: "Score your match for the job on screen, ask questions about it, write a cover letter and pick which resume to upload." },
      { title: "Safe by design", body: "It never fills identity, bank or card numbers, passwords or dates of birth, and demographic questions only from answers you saved yourself." },
    ],
    whyHeading: "Stop retyping yourself.",
    why: [
      { old: "Typing the same details on every form", now: "Filled from your profile, on your click" },
      { old: "Losing answers when the tab closes", now: "Drafts kept, free, until you're back" },
      { old: "Starting every open question from zero", now: "AI drafts from your resume and the posting" },
      { old: "Forgetting where you applied", now: "Tracked automatically after you submit" },
    ],
    cost: {
      heading: "Autofill is free. AI answers use credits.",
      body: "Filling from your profile and saved answers, saving answers and keeping drafts cost nothing. Drafting open answers with AI is 1 credit for up to eight, and a match score is 1 credit.",
    },
    priceNote: "Free to install and autofill; AI-drafted answers and match scores use credits.",
    faq: [
      { q: "Which sites does it work on?", a: "It recognises application forms on Greenhouse, Lever and Ashby out of the box. You can add any other careers site from the panel, with one Chrome permission for that site." },
      { q: "Does it submit applications for me?", a: "Never. It fills fields when you press the button, and you review and submit the form yourself." },
      { q: "Is the extension free?", a: "Installing it, autofilling from your profile and saved answers, and keeping drafts are free. AI-drafted answers are 1 credit for a batch of up to eight, and a match score is 1 credit." },
      { q: "Do I need a separate account?", a: "No. It uses your Remote Worldwide sign-in." },
      { q: "What will it never fill?", a: "Identity, bank or card numbers, passwords and dates of birth. Demographic questions are only filled from answers you saved yourself, with that setting turned on." },
      { q: "Which browsers are supported?", a: "Chrome, from the Chrome Web Store." },
    ],
    related: ["extension", "cover", "tracker"],
    finalHeading: "Your next application, filled on your click.",
  },
  {
    key: "extension",
    slug: "chrome-extension",
    name: "Chrome extension",
    step: "Continue",
    card: "Every application you start is saved as you type. Close the tab, come back days later, and pick up exactly where you stopped, on your click.",
    planBadge: "Free · Chrome",
    metaTitle: "Chrome Extension: Save and Resume Job Applications | Remote Worldwide",
    metaDescription:
      "Never lose a half-finished job application again. The Remote Worldwide Chrome extension saves your answers as you type and picks up where you stopped, on your click.",
    keywords: ["job application chrome extension", "save job application progress", "resume job application later", "job search extension", "remote worldwide extension"],
    eyebrow: "Chrome extension · on the Web Store",
    h1: { before: "Pick up every application", mark: "where you stopped." },
    intro:
      "Half the applications you start get interrupted: a meeting, a closed tab, a question you need to think about. The Remote Worldwide extension saves what you've answered as you type, and when you open that posting again, it offers to put it all back.",
    heroChecks: ["Drafts are free", "Survives a refresh or a closed tab", "Fills back only when you press it"],
    dashboardHref: EXTENSION_URL,
    openLabel: "Add it to Chrome",
    secondary: { label: "See it on the Chrome Web Store", href: EXTENSION_URL, external: true },
    problem: [
      { text: "Question six of nine. Why do you want to work *here*?" },
      { text: "You'll *think* about it and come *back*." },
      { text: "Then the tab *closes*, the laptop *restarts*, and the form is *blank* again." },
      { text: "Applications get interrupted. Your answers shouldn't vanish with them.", mark: true },
    ],
    problemAfter: "So the extension keeps your place.",
    stepsHeading: "Start it, leave it, finish it later.",
    steps: [
      {
        title: "Fill in a form as usual",
        body: "On Greenhouse, Lever, Ashby or any careers site you've added, everything you answer is saved as you type: first in your browser, then to your account.",
      },
      {
        title: "Leave whenever you need to",
        body: "Refresh, close the tab, come back days later. Unsent applications are listed under Application drafts on the website.",
      },
      {
        title: "Press Continue my draft",
        body: "Open the posting again and its button shows a \"!\". Press \"Continue my draft\" and the answers you had go back in, ready to finish.",
      },
    ],
    featuresHeading: "Everything you need while you apply, in the side panel.",
    features: [
      {
        title: "Saved as you type",
        body: "Each answer is kept in your browser the moment you type it, so a refresh never loses it, and synced to your account shortly after.",
      },
      {
        title: "A nudge on the right page",
        body: "When a posting has a saved draft, the extension's button on the page shows an amber \"!\". Hover it for \"Continue my draft\", with how many answers it holds.",
      },
      {
        title: "Your say, every time",
        body: "Nothing goes back into the form until you press the button, and you can choose your draft or a fresh fill from your resume instead.",
      },
      {
        title: "One draft per job",
        body: "Tracking links and the different addresses a posting lives at all lead to the same draft, so you never end up with three half-finished copies.",
      },
      {
        title: "Every draft in one list",
        body: "Application drafts on the website lists everything you started and didn't send, with Continue and Mark as applied. Once applied, a draft stays for 30 days.",
      },
      {
        title: "Your answers, kept",
        body: "Apply by any route (the extension, the apply wizard or the tracker) and the draft's answers join that application's record, so you can reuse them next time.",
      },
      {
        title: "The rest of the panel",
        body: "Autofill from your resume and saved answers, score your match, ask about the job, write a cover letter and track the application, with ten seconds to undo.",
      },
    ],
    whyHeading: "Stop starting applications twice.",
    why: [
      { old: "A closed tab wipes the whole form", now: "Answers saved the moment you type them" },
      { old: "Retyping everything on a second sitting", now: "Continue my draft puts it all back" },
      { old: "Forgetting which applications you never sent", now: "Every unsent application in one list" },
      { old: "Good answers lost after you apply", now: "Kept with the application, ready to reuse" },
    ],
    cost: {
      heading: "Drafts are free. So is installing it.",
      body: "Saving and continuing drafts, autofill from your profile and saved answers, and tracking cost nothing. Only AI features use credits: 1 credit drafts up to eight open answers, and a match score is 1 credit.",
    },
    priceNote: "Free to install; drafts and autofill are free, AI features use credits.",
    faq: [
      {
        q: "What happens if I close the tab halfway through an application?",
        a: "Your answers are already saved. Open the same posting again and the extension's button shows a \"!\": press \"Continue my draft\" and they go back into the form.",
      },
      {
        q: "Where are my drafts saved?",
        a: "In your browser first, the moment you type, and then on your Remote Worldwide account, where they're listed under Application drafts on the website.",
      },
      {
        q: "Will it fill the form on its own?",
        a: "No. Nothing is typed into a page until you press a button. Filling as a form loads is a setting, off unless you turn it on.",
      },
      { q: "Do drafts cost credits?", a: "No. Saving and continuing drafts is free on every plan." },
      {
        q: "What happens to a draft after I apply?",
        a: "Its answers join that application's record and it moves to the Applied tab of Application drafts, where it stays for 30 days.",
      },
      {
        q: "Which sites does it work on?",
        a: "Greenhouse, Lever and Ashby out of the box. Add any other careers site from the panel with one Chrome permission for that site.",
      },
      { q: "Do I need a separate account?", a: "No. The extension uses your Remote Worldwide sign-in." },
    ],
    related: ["autofill", "tracker", "cover"],
    finalHeading: "Never start the same application twice.",
  },
  {
    key: "interview",
    slug: "ai-mock-interview",
    name: "AI mock interview",
    step: "Rehearse",
    card: "Rehearse out loud with a voice interviewer that asks the questions this role is likely to bring up, then get a report on what you said and how you said it.",
    planBadge: "Pro and Ultra",
    metaTitle: "AI Mock Interview: Voice Interview Practice with Feedback | Remote Worldwide",
    metaDescription:
      "Practise interviews out loud with an AI voice interviewer. Questions come from the posting and your resume, then a report scores your answers, pace and filler words.",
    keywords: ["ai mock interview", "mock interview practice", "interview practice with feedback", "voice interview practice", "behavioral interview practice"],
    eyebrow: "Voice mock interviews · Pro and up",
    h1: { before: "Rehearse the interview", mark: "out loud", after: "before it counts." },
    intro:
      "A voice interviewer asks the questions this role is likely to bring up, from the posting and your resume, and follows up when an answer is vague. Afterwards, a report shows what landed and how you sounded saying it.",
    heroChecks: ["Questions from the posting and your resume", "Recorded, with a synced transcript", "A better answer for every question"],
    dashboardHref: "/dashboard/prep",
    openLabel: "Open interview prep",
    problem: [
      { text: "You rehearsed every answer in your *head*." },
      { text: "Then the call started, and the *words* came out *different*." },
      { text: "Too *fast*. Too many *ums*. The *best* example *forgotten* until after you hung up." },
      { text: "Interviews are spoken. Practise them that way.", mark: true },
    ],
    problemAfter: "So we built an interviewer you can practise with tonight.",
    stepsHeading: "Set it up, say it out loud, see the replay.",
    steps: [
      { title: "Set up the session", body: "Behavioural, portfolio walkthrough or salary conversation; warm-up, standard or tough; 6, 15 or 25 minutes." },
      { title: "Answer out loud", body: "The interviewer asks likely questions for this role and, depending on difficulty, follows up when an answer needs more." },
      { title: "Read the report", body: "Scores backed by quotes from your answers, a better answer for each question, and how you delivered it." },
    ],
    featuresHeading: "Feedback on what you said, and how you said it.",
    features: [
      { title: "Questions for this role", body: "Likely questions written from the posting and your resume, about 60% from the job and 40% from your experience." },
      { title: "Three difficulties", body: "Warm-up asks with no follow-ups, Standard follows up when an answer is vague, and Tough digs into your resume and follows up on most answers." },
      { title: "A report on substance", body: "Structure, specifics and numbers, ownership, relevance and confidence, every point backed by a quote from what you said." },
      { title: "A report on delivery", body: "Your pace in words per minute, long pauses, filler words, pitch variation and energy, with the moments that stood out flagged on the recording." },
      { title: "Replay and transcript", body: "Listen back with a synced transcript, and jump straight to the moment a note is about." },
      { title: "Practise the weak spots", body: "Start a new session on the questions you want another go at, straight from the report." },
    ],
    whyHeading: "Stop rehearsing in your head.",
    why: [
      { old: "Rehearsing silently in your head", now: "Answering out loud, to a voice" },
      { old: "Generic question lists", now: "Questions from the posting and your resume" },
      { old: "No idea how you sounded", now: "Pace, pauses and filler words, measured" },
      { old: "Remembering your best answer too late", now: "A better answer written for each question" },
    ],
    cost: {
      heading: "On Pro and Ultra. 5 credits a session.",
      body: "A session of up to 10 minutes is 5 credits; past that, each extra started minute is 1. You're billed on the recording, not on how many questions you get through.",
    },
    priceNote: "Included with the Pro and Ultra plans; 5 credits covers a session of up to 10 minutes.",
    faq: [
      { q: "Which plan includes mock interviews?", a: "Interview prep and voice mock interviews come with Pro and Ultra." },
      { q: "How are sessions billed?", a: "5 credits covers up to 10 minutes of recording. Past that, each extra started minute is 1 credit. Likely interview questions for a role are 1 credit per set." },
      { q: "What kinds of interview can I practise?", a: "Behavioural questions, a portfolio walkthrough and a salary conversation, on their own or combined, at three difficulties." },
      { q: "What does the report cover?", a: "Four tabs: Overall (scores, feedback per question and action items), Transcript, Delivery (pace, pauses, filler words, pitch and energy) and Positioning (how you come across, rated in words)." },
      { q: "Is the interview recorded?", a: "Yes, so the report can play back the moments it talks about, alongside a synced transcript." },
      { q: "Can I type instead of speaking?", a: "Interview prep is voice first, because interviews are spoken. The point is to hear how your answers sound." },
    ],
    related: ["resume", "tracker", "ats"],
    finalHeading: "Your next interview, rehearsed out loud.",
  },
  {
    key: "tracker",
    slug: "job-application-tracker",
    name: "Job application tracker",
    step: "Track",
    card: "Every application on one board, from saved to offer, with follow-up reminders, drafts from the extension and a streak to keep you going.",
    planBadge: "Free on every plan",
    metaTitle: "Job Application Tracker: Board, Follow-ups and Streaks | Remote Worldwide",
    metaDescription:
      "Track every job application on one board, from saved to offer. Follow-up reminders with drafted messages, a calendar and table view, and a weekly goal. Free.",
    keywords: ["job application tracker", "job search tracker", "track job applications", "job application organizer", "follow up after applying"],
    eyebrow: "Application tracker · free",
    h1: { before: "Every application,", mark: "one board.", after: undefined },
    intro:
      "Save a job, apply, and watch it move: Saved, Applied, In conversation, Interviewing, Offer. Follow-ups come due on their own, with the message drafted, so nothing goes quiet because you forgot.",
    heroChecks: ["Free on every plan", "Board, table and calendar", "Follow-ups that remind you"],
    dashboardHref: "/dashboard/tracker",
    openLabel: "Open the tracker",
    problem: [
      { text: "Thirty applications. *Four* spreadsheets. *Two* inboxes." },
      { text: "Did you *follow* up with that one? *When* did you apply?" },
      { text: "Which *resume* did you even *send*?" },
      { text: "A search you can't see is a search you can't steer.", mark: true },
    ],
    problemAfter: "So we put the whole search on one board.",
    stepsHeading: "Save it, apply, follow it to an answer.",
    steps: [
      { title: "Add a job", body: "From a listing on the board, or by pasting any link or posting. Importing a job is free." },
      { title: "Move it along", body: "Drag cards from Saved to Applied, In conversation, Interviewing and Offer, or close them out as rejected, ghosted, withdrawn or declined." },
      { title: "Follow up on time", body: "Reminders come due after a week of silence, with a message drafted. You send it, then mark it sent." },
    ],
    featuresHeading: "The whole search, at a glance.",
    features: [
      { title: "Board, table or calendar", body: "Drag and drop on the board, sort in a table, or see what's due on a calendar." },
      { title: "Follow-ups that come due", body: "Seven days after you apply, after five quiet days mid-conversation, and a last nudge at fourteen. After thirty, close it as ghosted in one click." },
      { title: "Drafted follow-up messages", body: "A message ready to copy for each follow-up. Nothing is ever sent for you." },
      { title: "Fed by the rest of the toolkit", body: "Applications you finish in the apply wizard land here with the resume, score and letter you used, and the extension tracks the forms you submit." },
      { title: "Insights", body: "See where your applications actually go, stage by stage, so you know what to change." },
      { title: "Streaks and a weekly goal", body: "A weekly application goal and a streak, with two free freezes a week, to make showing up a little easier." },
    ],
    whyHeading: "Stop losing track.",
    why: [
      { old: "Spreadsheets you stop updating", now: "A board that updates as you apply" },
      { old: "Forgetting to follow up", now: "Reminders that come due on their own" },
      { old: "Not knowing which resume you sent", now: "The resume and letter kept with the application" },
      { old: "No sense of progress", now: "A weekly goal and a streak" },
    ],
    cost: {
      heading: "Free, on every plan.",
      body: "The tracker, follow-ups, drafts and streaks cost nothing and need no plan. Importing a job from a link or posting is free too.",
    },
    priceNote: "Free on every plan.",
    faq: [
      { q: "Is the job application tracker free?", a: "Yes. The board, follow-up reminders, drafts and streaks are free on every plan, and importing a job costs nothing." },
      { q: "What stages does it track?", a: "Saved, Applied, In conversation, Interviewing and Offer on the board, plus four ways to close an application: rejected, ghosted, withdrawn or declined." },
      { q: "When are follow-ups due?", a: "Seven days after you apply, after five days of silence mid-conversation, and a last nudge at fourteen days. After thirty days you're offered to close it as ghosted." },
      { q: "Does it send follow-up emails for me?", a: "No. It drafts the message for you to copy and send yourself, then you mark it sent." },
      { q: "Can I track jobs from other sites?", a: "Yes. Paste a link or the posting into the job picker, or let the browser extension track it when you submit an application." },
    ],
    related: ["extension", "autofill", "interview"],
    finalHeading: "Your whole search, on one board.",
  },
];

export const toolPath = (tool: Pick<Tool, "slug">) => `/tools/${tool.slug}`;
export const toolBySlug = (slug: string) => TOOLS.find((tool) => tool.slug === slug);
