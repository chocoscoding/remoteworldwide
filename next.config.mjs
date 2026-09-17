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
      {
        source: "/api/billing/:path*",
        destination: `${backend}/api/billing/:path*`,
      },
      {
        source: "/api/pod/:path*",
        destination: `${backend}/api/pod/:path*`,
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
