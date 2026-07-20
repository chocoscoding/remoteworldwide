/** @type {import('next').NextConfig} */
const nextConfig = {
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
        hostname: "res.cloudinary.com",
        pathname: "/**",
        protocol: "https",
        port: "",
      },
    ],
  },
};

export default nextConfig;
