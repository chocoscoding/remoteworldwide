// Everything the browser is allowed to load, kept next to the CSP that names it so the
// two cannot drift. The remote image hosts below are the same four `images.remotePatterns`
// configures; adding one there means adding it to `img-src` here.
//
// WHAT HAS TO BE TRUE BEFORE THE CSP IS SWITCHED FROM REPORT-ONLY TO ENFORCING:
//
//  1. `'unsafe-inline'` has to leave `script-src`, or the policy buys almost nothing —
//     and that is the whole difficulty. Google Analytics' config block and Hotjar's
//     bootstrap are both INLINE (app/layout.tsx), and Next.js emits its own inline
//     hydration bootstrap. All three need a per-request nonce, which `next.config.mjs`
//     cannot mint — a static header has no request. That means moving the CSP into
//     middleware, generating a nonce there, and passing it to every <Script> via
//     `next/script`'s `nonce` prop. Until that work is done, enforcing this policy would
//     either break analytics or allow any injected inline script anyway.
//  2. `'unsafe-eval'` has to be confirmed unnecessary in production. `next dev` needs it;
//     a production build should not. Verify against a real `next build && next start`,
//     not the dev server.
//  3. `connect-src` has to be checked against the two runtime-configured endpoints this
//     file cannot know: the voice gateway's WebSocket (its URL arrives in an API
//     response — app/lib/voice/gateway.ts) and the presigned S3 part URLs the recorder
//     PUTs to (app/lib/voice/capture/s3Upload.ts). Both are whatever the backend says
//     they are, so they must be read off a live deploy, not guessed here.
//  4. Report-only reports have to have been collected for long enough to cover the admin
//     screens — the Cloudinary upload widget only loads there, so ordinary browsing
//     never exercises `frame-src` or its script host.
//
// Note that `frame-ancestors` is IGNORED in a report-only policy, by spec. The real
// clickjacking defence here is `X-Frame-Options` below; the directive is kept so the
// policy is complete on the day it is enforced.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  // GA's loader, Hotjar's loader + the script its inline bootstrap appends, the
  // Cloudinary upload widget (admin screens only), and Vercel's analytics script, which
  // is same-origin in production but comes from va.vercel-scripts.com elsewhere.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://static.hotjar.com https://script.hotjar.com https://upload-widget.cloudinary.com https://va.vercel-scripts.com",
  // Tailwind is bundled, but React `style` props and Quill both write inline styles.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://lh3.googleusercontent.com https://*.b-cdn.net https://res.cloudinary.com https://www.googletagmanager.com https://*.google-analytics.com https://*.hotjar.com",
  // next/font self-hosts Manrope at build time, so only Hotjar's own faces are remote.
  "font-src 'self' data: https://static.hotjar.com",
  // blob: is the interview recorder's playback; b-cdn is the media CDN.
  "media-src 'self' blob: https://*.b-cdn.net",
  // 'self' covers the backend and the AI service: both are reached through the rewrites
  // above, on this origin. See point 3 for what is knowingly missing.
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.hotjar.com wss://*.hotjar.com https://api.elevenlabs.io wss://api.elevenlabs.io https://api.cloudinary.com https://res.cloudinary.com",
  "frame-src 'self' https://upload-widget.cloudinary.com https://vars.hotjar.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // A rewrite clones the request body and caps the clone at 10MB by default —
  // then TRUNCATES rather than erroring, so a 10MB upload arrives as a broken
  // multipart with no clue why. This ceiling is the document limit plus room
  // for the multipart envelope; multer enforces the real 10MB and returns 413.
  experimental: {
    proxyClientMaxBodySize: "12mb",
    // Rewrites give up after 30 s by default and answer with a bare 500. The
    // admin job parser is still one synchronous crawl-then-extract request (a
    // static read, maybe a browser render, then Groq), which can run past that.
    // Job imports poll instead, so nothing else should come near this ceiling.
    proxyTimeout: 120_000,
  },
  // `/privacy` is the address people type and forms ask for (the Chrome Web
  // Store listing, OAuth consent screens), but the policy lives at
  // /privacy-policy, which is also its canonical URL and what the sitemap lists.
  // A permanent redirect gives both addresses one document rather than a second
  // copy that could drift out of date.
  async redirects() {
    return [{ source: "/privacy", destination: "/privacy-policy", permanent: true }];
  },
  // Authentication is hosted by the Express backend (@auth/express).
  // Proxying /api/auth/* keeps the Auth.js cookies first-party and the
  // Google OAuth callback URL unchanged ({origin}/api/auth/callback/google).
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";
    return [
      {
        source: "/api/auth/:path*",
        destination: `${backend}/api/auth/:path*`,
      },
      // Same first-party-cookie reasoning as /api/auth: these backend routes
      // authenticate via the Auth.js session cookie, so the browser must
      // reach them on the frontend origin.
      {
        source: "/api/sessions/:path*",
        destination: `${backend}/api/sessions/:path*`,
      },
      {
        source: "/api/users/:path*",
        destination: `${backend}/api/users/:path*`,
      },
      // The blog, its conversions and settings live on the backend.
      {
        source: "/api/blog/:path*",
        destination: `${backend}/api/blog/:path*`,
      },
      // Dashboard settings and billing: same first-party-cookie reasoning.
      {
        source: "/api/settings/:path*",
        destination: `${backend}/api/settings/:path*`,
      },
      // The account itself: how it signs in, its data export and its deletion. Same
      // first-party-cookie reasoning as /api/settings — and the export is a download the
      // browser starts, so it has to come from this origin.
      {
        source: "/api/account/:path*",
        destination: `${backend}/api/account/:path*`,
      },
      {
        source: "/api/billing/:path*",
        destination: `${backend}/api/billing/:path*`,
      },
      {
        source: "/api/pod/:path*",
        destination: `${backend}/api/pod/:path*`,
      },
      // The invite counts: the sidebar meter and the win share read them from
      // every dashboard screen. The invites page itself still fetches its
      // overview server-side.
      {
        source: "/api/invites/:path*",
        destination: `${backend}/api/invites/:path*`,
      },
      // One entry covers /api/documents, /:id and /:id/link.
      {
        source: "/api/documents/:path*",
        destination: `${backend}/api/documents/:path*`,
      },
      // The bell polls this from every dashboard screen.
      {
        source: "/api/notifications",
        destination: `${backend}/api/notifications`,
      },
      {
        source: "/api/notifications/:path*",
        destination: `${backend}/api/notifications/:path*`,
      },
      // The job picker: imports, saved jobs and Remote Worldwide listings, all
      // behind the session cookie. A `:path*` rule also matches the bare prefix,
      // so `/api/saved-jobs` itself needs no second entry. Rewrites run after
      // static routes, so a static app/api/saved-jobs/route.ts would silently
      // shadow these — don't add one.
      {
        source: "/api/saved-jobs/:path*",
        destination: `${backend}/api/saved-jobs/:path*`,
      },
      {
        source: "/api/job-imports/:path*",
        destination: `${backend}/api/job-imports/:path*`,
      },
      {
        source: "/api/platform-jobs/:path*",
        destination: `${backend}/api/platform-jobs/:path*`,
      },
      // The plan, applications and goals: same session-cookie reasoning, and the
      // same one-rule-per-prefix note as above.
      {
        source: "/api/tasks/:path*",
        destination: `${backend}/api/tasks/:path*`,
      },
      {
        source: "/api/applications/:path*",
        destination: `${backend}/api/applications/:path*`,
      },
      {
        source: "/api/goals/:path*",
        destination: `${backend}/api/goals/:path*`,
      },
      // The streak, freezes, gifts and repairs, derived server-side from the
      // activity log: same session-cookie reasoning.
      {
        source: "/api/streak/:path*",
        destination: `${backend}/api/streak/:path*`,
      },
      // Interview prep tracks: same session-cookie reasoning. Their likely
      // questions are the AI service's and go through /api/ai instead.
      {
        source: "/api/prep-tracks/:path*",
        destination: `${backend}/api/prep-tracks/:path*`,
      },
      // The user's own contacts (LinkedIn import, people kept from referral
      // search) and the referral asks they have sent: same session-cookie
      // reasoning and one-rule-per-prefix note. The import is a multipart upload
      // of up to 10MB, which proxyClientMaxBodySize above already allows for.
      {
        source: "/api/contacts/:path*",
        destination: `${backend}/api/contacts/:path*`,
      },
      {
        source: "/api/referral-requests/:path*",
        destination: `${backend}/api/referral-requests/:path*`,
      },
      // Recommendations: the candidate's list, one recommendation, and sending
      // answers — same session-cookie reasoning. /admin under it is reachable
      // too, but the backend requires an ADMIN session there; the admin screens
      // use server actions anyway (libs/recommendations-admin.ts).
      {
        source: "/api/recommendations/:path*",
        destination: `${backend}/api/recommendations/:path*`,
      },
      // Same-origin door to the admin job parser, so the Auth.js cookie is sent
      // and the backend can require an admin session instead of a token that
      // used to ship to every browser.
      {
        source: "/api/admin/job-parse",
        destination: `${backend}/api/jobs/parse`,
      },
      {
        source: "/api/lead-magnets/claim",
        destination: `${backend}/api/blog/claims`,
      },
      {
        source: "/api/subscribers/export",
        destination: `${backend}/api/blog/admin/subscribers.csv`,
      },
    ];
  },
  // One rule for every path — pages, API routes and /public alike. Headers are matched
  // before the filesystem, so nothing here depends on how a route is implemented.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Two years, subdomains included. `preload` is deliberately NOT set: it is a
          // one-way commitment baked into browsers, and every subdomain of the apex has
          // to be serving https before it can be asked for.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // SAMEORIGIN rather than DENY: the document print path builds a hidden
          // same-origin frame (app/lib/export/save.ts). Third-party framing — the
          // clickjacking case — is refused either way.
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          // Full URL to ourselves, origin only to anyone else, nothing over plain http.
          // Job and blog URLs carry slugs that need not travel to third parties.
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Report-only on purpose — see the note above CSP_REPORT_ONLY for exactly what
          // must be verified before this becomes Content-Security-Policy. As written it
          // blocks nothing; it only surfaces violations.
          {
            key: "Content-Security-Policy-Report-Only",
            value: CSP_REPORT_ONLY,
          },
        ],
      },
    ];
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        hostname: "images.unsplash.com",
        pathname: "/**",
        protocol: "https",
        port: "",
      },
      {
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
        protocol: "https",
        port: "",
      },
      {
        hostname: "**.b-cdn.net",
        pathname: "/**",
        protocol: "https",
        port: "",
      },
      {
        hostname: "res.cloudinary.com",
        pathname: "/**",
        protocol: "https",
        port: "",
      },
    ],
  },
};

export default nextConfig;
