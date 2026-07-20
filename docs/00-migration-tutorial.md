# Moving Authentication out of Next.js into an Express Backend — A Complete Tutorial

This is a teaching guide **with all the code included** — the before-state, the
after-state, and everything in between. It walks you through migrating
authentication from **NextAuth v5 inside a Next.js app** to **`@auth/express` on
a separate Express backend**, the way it was done in this project — every step,
every file, and most importantly *every reason*. By the end you can rebuild this
system from scratch and adapt it to your own stack.

**Who this is for:** you have a Next.js app using NextAuth (Google and/or
email+password), you're adding a dedicated backend (Express + MongoDB here), and
you want the backend to own authentication so every service trusts one authority.

**What you'll end up with:**

- The Express backend runs Auth.js and owns all sign-in, sign-out, and session logic.
- The Next.js app becomes a thin client — it keeps calling `signIn()`, `signOut()`,
  `useSession()`, and a server-side `auth()` exactly as before.
- The browser notices nothing. Users stay logged in through the migration.

---

# Part 1 — The concepts you need first

Don't skip this part. Every hard bug in this migration traces back to one of these
five ideas.

## 1.1 Cookies are the whole game

Auth.js is cookie-based. Identity lives in an encrypted cookie
(`authjs.session-token`); CSRF protection lives in a cookie; the OAuth dance parks
its secrets in a cookie. And browsers enforce one iron rule:

> A cookie belongs to the origin that set it. Cookies sent to *another* origin are
> "third-party" and modern browsers block or cripple them.

So if your frontend is `https://myapp.com` and your backend is
`https://api.myapp.com` (or `localhost:4000` in development), and the browser talks
to the backend directly, all auth cookies become third-party. That path leads to
`SameSite=None` hacks, Safari breakage, and pain.

**The solution this tutorial uses:** the browser *never* talks to the backend.
The frontend proxies `/api/auth/*` to the backend, so every cookie is set on the
frontend's own origin — first-party, forever, on every browser. One config block
buys you this. Remember it; it's the spine of the whole design.

## 1.2 Two kinds of sessions: database vs JWT

| | Database strategy | JWT strategy |
|---|---|---|
| Where the session lives | A row in a `sessions` collection; the cookie holds only its ID | Entirely *inside* the cookie, encrypted |
| Reading a session | DB lookup on every request | Decrypt the cookie — no DB |
| Revoking one session | Delete the row — instant | Impossible until the cookie expires |
| Changing a user's role | Takes effect immediately | Takes effect at next sign-in (the role was copied into the token) |
| Works with the Credentials provider? | **No** — Auth.js deliberately never persists sessions for password sign-ins | **Yes** |

That last row decides for us: **if you offer email+password login, you must use the
JWT strategy.** The trade-offs (no instant revocation, role changes need re-login)
are the standard price; know them, document them, accept them.

## 1.3 The JWT is encrypted with YOUR secret — and that secret is sacred

The session cookie is not a plain signed JWT you can paste into a debugger. It's a
**JWE** (encrypted), and the key is derived from your `AUTH_SECRET` (plus the
cookie name as salt). Two consequences you must internalize:

1. **Whoever needs to read sessions needs the exact same secret.** Our backend can
   read cookies minted by the old Next.js app *only because* both use the same
   `AUTH_SECRET`. next-auth v5 and `@auth/express` share the same core library
   (`@auth/core`) — same cookie names, same encryption — so with a matching secret,
   old cookies keep working and **users stay logged in through the migration**.
2. **Change the secret and every user is silently logged out.** The backend will
   log `JWTSessionError` for each stale cookie. If you migrate and forget to carry
   the old secret over, that's the symptom you'll see.

> War story from this very project: the backend `.env` ended up with *two*
> `AUTH_SECRET` lines (one of them mangled by a bad paste that glued
> `DATABASE_URL` onto the same line). dotenv silently let the **last** duplicate
> win, so the server encrypted with a different secret than the browser's cookies
> were minted with. Everything "looked broken" — sign-in, sign-out, sessions — and
> the only real clue was `JWTSessionError` in the logs. Keep your `.env` clean;
> duplicates don't warn.

## 1.4 CSRF: why every POST needs a handshake

Any website can make your browser *send* a POST to your app — and the browser will
helpfully attach your cookies. What another site can never do is *read* your
cookies. Auth.js exploits that asymmetry (the "double-submit cookie" pattern):

1. `GET /api/auth/csrf` → returns a token in JSON **and** sets it in a cookie.
2. Every state-changing POST must carry the token in its body **and** the cookie.
3. Backend checks they match. An attacker can force the cookie to be sent but can't
   put the matching token in the body → request dies with `MissingCSRF`.

`signIn()` / `signOut()` from `next-auth/react` do this handshake for you. Your own
curl tests must do it manually (Step 14 shows how), or you'll see `MissingCSRF` and
wrongly conclude the server is broken.

## 1.5 OAuth with PKCE: the shape of the Google dance

```text
your app ──(1) build auth URL, redirect──► Google ──(2) user consents,
                                                       redirect back with ?code──► your app
your app ──(3) exchange code for identity, server-to-server──► Google
```

Two details matter for understanding the code:

- **The `code` is useless alone.** Before redirecting to Google, Auth.js invents a
  random secret (the *PKCE verifier*), stores it encrypted in a short-lived cookie
  in the user's browser, and sends Google only its hash. At step (3) Google demands
  the original verifier. Even if someone steals the `?code` from the URL
  mid-flight, they cannot finish the exchange — the secret is in the victim's
  browser, nowhere else.
- **The redirect URI is registered in your Google Cloud Console.** Because of our
  proxy (§1.1), it stays on the *frontend* origin
  (`https://<frontend>/api/auth/callback/google`) — which means **you don't touch
  the Google console at all during this migration**. Not an accident; the proxy
  paying off again.

---

# Part 2 — The starting point: what client-owned auth looked like

Before the migration, authentication lived **entirely inside the Next.js app**.
This is the standard NextAuth v5 setup most tutorials give you — worth studying
closely, because knowing exactly what each old piece did tells you where it must
go.

```text
Browser ──► Next.js (one app does everything)
              ├── app/api/auth/[...nextauth]/route.ts   ← the auth HTTP endpoints
              ├── auth.ts                               ← NextAuth() config + auth()/signIn()/signOut()
              ├── next-auth/react                       ← useSession() etc. in client components
              ├── PrismaAdapter ──► MongoDB             ← users, Account, sessions, verification_tokens
              └── session strategy: database            ← session row per login, cookie holds its ID

Express backend ──► MongoDB (business data only — knows NOTHING about auth ✗)
```

## 2.1 The old `auth.ts` — the entire auth system in ~25 lines

This was the real file, verbatim:

```ts
// frontend/auth.ts (BEFORE)
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [Google],
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  session: {
    strategy: "database",
  },
  pages: {
    signOut: "/",
  },
});
```

Read what this gave the app, because every item needs a new home:

- **`NextAuth(...)` returned four things at once**: `handlers` (the HTTP
  endpoints), `auth` (server-side session getter), and `signIn`/`signOut`
  (server actions). One package, one process, tightly coupled to Next.js.
- **`PrismaAdapter(prisma)`** persisted users/accounts/sessions through the
  frontend's own Prisma client.
- **`strategy: "database"`** — every login created a row in `sessions`; the
  cookie held only that row's ID. Note the `session({ session, user })` callback
  signature: with the database strategy the callback receives the **user row**,
  not a token. (After the migration it receives `{ session, token }` — same job,
  different source. Compare with Step 7.)
- **Google only.** Adding the Credentials provider was a goal of the migration —
  and it is exactly what forces the strategy change to JWT (§1.2).

## 2.2 The old route handler — two lines that served every auth endpoint

```ts
// frontend/app/api/auth/[...nextauth]/route.ts (BEFORE — deleted in Step 2)
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

The `[...nextauth]` catch-all made Next.js serve `/api/auth/session`,
`/api/auth/signin/google`, `/api/auth/callback/google`, etc. After the migration
**the same URLs still exist** — but they're served by Express behind the rewrite
proxy. That URL stability is why the browser never notices the migration.

## 2.3 The old Prisma schema — the auth models

```prisma
// frontend/prisma/schema.prisma (BEFORE — the auth-owned models)
model Session {
  id           String   @id @default(auto()) @map("_id") @db.ObjectId
  sessionToken String   @unique @map("session_token")
  userId       String   @db.ObjectId
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("sessions")
}

model Account {
  id                String  @id @default(auto()) @map("_id") @db.ObjectId
  userId            String  @db.ObjectId
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.String
  access_token      String? @db.String
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  user              User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model User {
  id            String            @id @default(auto()) @map("_id") @db.ObjectId
  name          String?
  email         String?           @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  role          Role              @default(USER)
  bookmarks     Bookmark[]        // business relation — this is why User survives
  notifications NotificationPref? // business relation — this too
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@map("users")
}

model VerificationToken {
  id         String   @id @default(auto()) @map("_id") @db.ObjectId
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}
```

Study the naming quirks — they become law in Step 5: `@@map("sessions")` but
`Account` has **no** `@@map` (so its collection is literally `Account`, capital A);
`sessionToken` is `@map`ped to `session_token`; unique indexes get Prisma-generated
names like `users_email_key`. The Mongoose models must reproduce every one of
these, byte for byte, because the data stays in place.

## 2.4 How the app consumed it (and why those call sites survive unchanged)

- **Client components:** `import { signIn, signOut, useSession } from "next-auth/react"`
  — REST calls against `/api/auth/*`.
- **Server components:** `import { auth } from "@/auth"` — direct function call
  into NextAuth.

These two consumption patterns are the *interface* of the old system, and the
migration's core promise is: **the interface stays, only the implementation
moves.** The client keeps `next-auth/react` (same URLs via the proxy); the server
keeps importing `auth()` from `@/auth` (same module, new plumbing — Step 11).

## 2.5 Why move it at all?

- **The backend couldn't verify anyone.** Business endpoints on Express had no
  way to check a session — auth logic and the session secret lived in Next.js.
  (The interim hack was a shared `x-admin-token` header — one static secret, no
  users, no roles.)
- **One authority.** With auth on the backend, *every* current and future service
  (the Express API, cron jobs, a future mobile-app gateway) validates sessions
  the same way, against the same config.
- **Credentials logins were coming.** That forces the JWT strategy (§1.2) — a
  deep config change anyway, so it was folded into the move.

## 2.6 Before → after map

Every old piece and where it went:

| Before (Next.js owned) | After (Step) |
|---|---|
| `auth.ts` — `NextAuth({...})` config | Backend `src/auth/config.ts` — `ExpressAuthConfig` (Step 7) |
| `app/api/auth/[...nextauth]/route.ts` | **Deleted**; Express serves the same URLs behind the rewrite (Steps 2, 8) |
| `PrismaAdapter(prisma)` | Custom `MongooseAdapter` over byte-compatible models (Steps 5–6) |
| `session: { strategy: "database" }` | `strategy: "jwt"` — required by Credentials (§1.2) |
| `session({ session, user })` callback (user row) | `jwt` + `session({ session, token })` callbacks (Step 7) |
| `auth()` exported from `NextAuth()` | Same-named helper fetching the backend session endpoint (Step 11) |
| `signIn`/`signOut` server actions from `auth.ts` | Client-side `signIn`/`signOut` via `next-auth/react` wrappers (Step 12) |
| `next-auth/react` client hooks | **Unchanged** (Step 12) |
| Prisma models `Session`/`Account`/`VerificationToken` | Deleted from Prisma; recreated in Mongoose (Step 5, cleanup in §2.7) |
| Prisma `User` model | Kept **read-only** (business relations); backend owns writes |
| `AUTH_SECRET` + Google credentials in frontend `.env` | Moved to backend `.env` — secret carried over verbatim (Step 4) |
| Google only | Google + Credentials, plus a register endpoint (Step 10) |

## 2.7 The frontend cleanup (the actual diffs)

Once the backend owns auth, the frontend sheds the server-side auth machinery.
From this project's real diff — `package.json` loses two dependencies:

```diff
   "dependencies": {
-    "@auth/prisma-adapter": "^2.7.4",
     "@prisma/client": "^5.22.0",
   ...
   "devDependencies": {
-    "@types/next-auth": "^3.13.0",
```

(`next-auth` itself **stays** — the client hooks and the `Session` type still
come from it.)

And `prisma/schema.prisma` drops the three auth-only models entirely, keeping a
slimmed `User` with a comment that records the new ownership rule:

```prisma
// frontend/prisma/schema.prisma (AFTER)

// Authentication (accounts, sessions, verification tokens) moved to the
// Express backend — Mongoose models in remoteworldwidebackend/src/models.
// User is kept here read-only because Bookmark/NotificationPref relate to it;
// the backend's Auth.js adapter owns all writes to the `users` collection.
model User {
  id            String            @id @default(auto()) @map("_id") @db.ObjectId
  name          String?
  email         String?           @unique
  emailVerified DateTime?
  image         String?
  role          Role              @default(USER)
  bookmarks     Bookmark[]
  notifications NotificationPref?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  @@map("users")
}
```

Note what got removed from `User`: the `accounts Session[]`/`sessions Account[]`
relation fields — they pointed at models that no longer exist in Prisma. The
underlying collections are untouched; only Prisma's *view* of them shrank.

---

# Part 3 — The migration, step by step, with all the code

Each step says *what* to do, shows the **complete real code**, and explains *why*.
File paths are given relative to the two repos: `frontend/` (the Next.js app) and
`backend/` (the Express app).

## Step 1: Map what you have

Part 2 *is* this exercise, done for this project — do the same for yours. Write
down your current NextAuth setup:

- Which **providers**? (Here: Google + Credentials.)
- Which **session strategy**? (Here: database — which must change, §1.2.)
- Which **adapter and schema**? (Here: PrismaAdapter on MongoDB — collections
  `users`, `Account`, `sessions`, `verification_tokens`, with Prisma's exact field
  and index names.)
- Which **callbacks** enrich the session? (Here: `id` and `role` onto `session.user`.)
- Where is the session **consumed**? Client components (`useSession`), server
  components (`auth()`), API routes.

Everything on this list must have a new home. If you can't say where each item
lands, you're not ready to start.

## Step 2: The proxy — one rewrite rule, and delete the old route

**`frontend/next.config.mjs`:**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Authentication is hosted by the Express backend (@auth/express).
  // Proxying /api/auth/* keeps the Auth.js cookies first-party and the
  // Google OAuth callback URL unchanged ({origin}/api/auth/callback/google).
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000"}/api/auth/:path*`,
      },
    ];
  },
  // …your existing config (images, etc.) stays as-is…
};

export default nextConfig;
```

**And delete the old NextAuth handler:**

```bash
rm frontend/app/api/auth/[...nextauth]/route.ts
```

Why the deletion is mandatory: in Next.js, real filesystem routes win over
rewrites. Leave that file in place and the proxy never fires — you'll be debugging
a ghost of the old system.

What the rewrite buys (recap of §1.1):
first-party cookies; `next-auth/react` working unmodified (its default base path
is `/api/auth`, exactly where the proxy listens); an unchanged Google redirect URI.

## Step 3: Prepare the backend to load Auth.js (the ESM/CJS trap)

`@auth/express` is **ESM-only**. If your backend is CommonJS (most Express apps
are), keep it CommonJS — don't add `"type": "module"`, don't rename files. Modern
Node (≥ 20.19; ideally 22+) can `require()` an ESM package natively. You need
three files to agree:

**`backend/package.json`** (relevant parts):

```json
{
  "scripts": {
    "dev": "nodemon",
    "build": "tsc",
    "start": "nodemon dist/server.js"
  },
  "dependencies": {
    "@auth/express": "^0.12.2",
    "bcryptjs": "^3.0.3",
    "express": "^4.18.2",
    "mongoose": "^9.7.4"
  },
  "devDependencies": {
    "tsx": "^4.23.1",
    "nodemon": "^3.0.2",
    "typescript": "^7.0.2"
  }
}
```

**`backend/tsconfig.json`** — the key lines are `module`/`moduleResolution:
"nodenext"`, which let TypeScript read the ESM package's `exports` map while your
source stays CommonJS:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**`backend/nodemon.json`** — dev runner is `tsx`, not `ts-node` (`ts-node`'s
compiler API chokes on this setup; `tsx` is also what the Auth.js docs use):

```json
{
  "watch": ["src"],
  "ext": "ts",
  "ignore": ["src/**/*.spec.ts"],
  "exec": "tsx src/server.ts",
  "env": { "NODE_ENV": "development" }
}
```

> Deployment note: production Node must also be ≥ 20.19, or the server dies on
> startup trying to load `@auth/express`.

## Step 4: Environment variables — carry the crown jewels over

**`backend/.env`** (placeholders — never commit real values):

```bash
# THE OLD FRONTEND'S NEXTAUTH_SECRET / AUTH_SECRET, VERBATIM (§1.3).
# This is what keeps every existing user logged in through the migration.
AUTH_SECRET=<the-exact-secret-your-nextauth-app-used>

# Public auth base AS THE BROWSER SEES IT — the FRONTEND origin + /api/auth,
# because the browser reaches auth through the proxy.
AUTH_URL=http://localhost:3000/api/auth        # prod: https://myapp.com/api/auth

# Moved from the frontend — the backend performs the token exchange now.
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>

# The SAME database the frontend used — the adapter reuses existing users.
MONGODB_URI=<your-mongodb-connection-string>

# CORS allow-list (comma-separated)
FRONTEND_URL=https://myapp.com,http://localhost:3000
```

**`frontend/.env`** keeps only:

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000   # prod: your backend origin
```

The frontend no longer holds the auth secret or Google credentials — deleting them
there shrinks your secret surface.

**`backend/src/config/env.ts`** — typed access, with one subtle but critical bit
at the bottom:

```ts
import dotenv from "dotenv";

dotenv.config();

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

export const config = {
  port: parseInt(getEnvVar("PORT", "4000"), 10),
  nodeEnv: getEnvVar("NODE_ENV", "development"),
  frontendUrls: getEnvVar("FRONTEND_URL", "http://localhost:3000")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0),
  authSecret: getEnvVar("AUTH_SECRET"),
  // Public URL of the auth endpoints as seen by the browser (through the proxy)
  authUrl: getEnvVar("AUTH_URL", "http://localhost:3000/api/auth"),
  googleClientId: getEnvVar("GOOGLE_CLIENT_ID"),
  googleClientSecret: getEnvVar("GOOGLE_CLIENT_SECRET"),
  mongodbUri: getEnvVar("MONGODB_URI", process.env.DATABASE_URL),
};

// @auth/express ALSO reads AUTH_URL/AUTH_SECRET straight from process.env;
// make sure the resolved values (including defaults) are what it sees.
process.env.AUTH_URL = config.authUrl;
process.env.AUTH_SECRET = config.authSecret;
```

Why the last two lines: Auth.js reads `process.env` directly, bypassing your
config object. If your config applies a default the raw env doesn't have, the two
disagree — so write the resolved values back.

## Step 5: Recreate the schema — byte-compatible with the old adapter

The Mongoose models must produce **exactly** the collections Prisma made: same
collection names (mind the historical casing — `users` but `Account`), same field
names (`session_token`, not `sessionToken`), same index names. Why so strict?
(1) reusing existing user data is the whole point — a renamed field means "user
not found" and mass duplicate accounts; (2) the frontend's Prisma client still
reads `users` (business relations), so both ORMs must agree on the bytes.

**`backend/src/models/user.model.ts`:**

```ts
import { Schema, model, type InferSchemaType } from "mongoose";

/** Mirrors the Prisma `Role` enum (frontend business logic still reads it). */
export const USER_ROLES = ["USER", "ADMIN", "AUTHOR"] as const;
export type UserRole = (typeof USER_ROLES)[number];

const UserSchema = new Schema(
  {
    name: { type: String, default: null },
    email: { type: String, default: null },
    emailVerified: { type: Date, default: null },
    image: { type: String, default: null },
    role: { type: String, enum: USER_ROLES, default: "USER" as UserRole, required: true },
    /**
     * bcrypt hash for the Credentials provider. Optional: Google-only users
     * have no password. Excluded from queries unless explicitly selected.
     */
    password: { type: String, select: false, default: null },
  },
  { collection: "users", timestamps: true, versionKey: false }
);

// Same key + name as the index Prisma created (`email String? @unique`).
UserSchema.index({ email: 1 }, { unique: true, name: "users_email_key" });

export const UserModel = model("User", UserSchema);

export type User = InferSchemaType<typeof UserSchema>;
export type UserDocument = ReturnType<(typeof UserModel)["hydrate"]>;
```

The one security line worth memorizing: `password: { select: false }`. No ordinary
query can ever return the hash — only code that explicitly writes
`.select("+password")` sees it. Defense in depth in one line.

**`backend/src/models/account.model.ts`** — one row per (provider, user) pair,
holding OAuth tokens:

```ts
import { Schema, model, type InferSchemaType } from "mongoose";

const AccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, required: true },
    provider: { type: String, required: true },
    providerAccountId: { type: String, required: true },
    refresh_token: { type: String, default: null },
    access_token: { type: String, default: null },
    expires_at: { type: Number, default: null },
    token_type: { type: String, default: null },
    scope: { type: String, default: null },
    id_token: { type: String, default: null },
    session_state: { type: String, default: null },
  },
  { collection: "Account", timestamps: true, versionKey: false }
);

// Same key + name as Prisma's `@@unique([provider, providerAccountId])`.
AccountSchema.index(
  { provider: 1, providerAccountId: 1 },
  { unique: true, name: "Account_provider_providerAccountId_key" }
);

export const AccountModel = model("Account", AccountSchema);

export type Account = InferSchemaType<typeof AccountSchema>;
export type AccountDocument = ReturnType<(typeof AccountModel)["hydrate"]>;
```

**`backend/src/models/session.model.ts`** — note: with the JWT strategy nothing
writes here at runtime; the model exists so the adapter implements the *full*
official interface and the database strategy remains a drop-in switch:

```ts
import { Schema, model, type InferSchemaType } from "mongoose";

const SessionSchema = new Schema(
  {
    // Stored as `session_token` because the Prisma model mapped it
    // (`sessionToken String @unique @map("session_token")`); the adapter
    // translates to/from Auth.js's `sessionToken`.
    session_token: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expires: { type: Date, required: true },
  },
  { collection: "sessions", timestamps: true, versionKey: false }
);

SessionSchema.index({ session_token: 1 }, { unique: true, name: "sessions_session_token_key" });

export const SessionModel = model("Session", SessionSchema);

export type Session = InferSchemaType<typeof SessionSchema>;
export type SessionDocument = ReturnType<(typeof SessionModel)["hydrate"]>;
```

**`backend/src/models/verification-token.model.ts`** — used by email/magic-link
flows; kept for adapter completeness (no timestamps — the Prisma model had none):

```ts
import { Schema, model, type InferSchemaType } from "mongoose";

const VerificationTokenSchema = new Schema(
  {
    identifier: { type: String, required: true },
    token: { type: String, required: true },
    expires: { type: Date, required: true },
  },
  { collection: "verification_tokens", timestamps: false, versionKey: false }
);

VerificationTokenSchema.index(
  { identifier: 1, token: 1 },
  { unique: true, name: "verification_tokens_identifier_token_key" }
);

export const VerificationTokenModel = model("VerificationToken", VerificationTokenSchema);

export type VerificationToken = InferSchemaType<typeof VerificationTokenSchema>;
export type VerificationTokenDocument = ReturnType<(typeof VerificationTokenModel)["hydrate"]>;
```

**`backend/src/models/index.ts`:**

```ts
export { UserModel, USER_ROLES, type User, type UserDocument, type UserRole } from "./user.model";
export { AccountModel, type Account, type AccountDocument } from "./account.model";
export { SessionModel, type Session, type SessionDocument } from "./session.model";
export {
  VerificationTokenModel,
  type VerificationToken,
  type VerificationTokenDocument,
} from "./verification-token.model";
```

Also define **ownership** now, in writing: the backend owns all writes to the auth
collections; the frontend's Prisma `User` model becomes read-only (keep it only if
business models have relations to it; delete Prisma's `Session`/`Account`/
`VerificationToken` models entirely). Two writers with two schemas over one
collection is how data rots.

## Step 6: The adapter — pure persistence, no logic

Auth.js talks to your database through the official
[`Adapter` interface](https://authjs.dev/guides/creating-a-database-adapter). The
discipline that keeps this maintainable: **the adapter contains zero
authentication logic.** It maps documents to Auth.js shapes and back. If you find
yourself writing an `if` about identity here, it belongs in a provider or callback.

(Why not the off-the-shelf `@auth/mongodb-adapter`? It uses its own
collection/field names against the raw driver — it would not find your
Prisma-shaped data. The custom adapter exists purely to honor Step 5.)

**`backend/src/auth/adapter.ts`** — complete:

```ts
import { isValidObjectId } from "mongoose";
import type {
  Adapter,
  AdapterSession,
  AdapterUser,
  VerificationToken,
} from "@auth/express/adapters";
import {
  AccountModel,
  SessionModel,
  UserModel,
  VerificationTokenModel,
  type SessionDocument,
  type UserDocument,
} from "../models";

/**
 * Maps a Mongoose user document to the Auth.js AdapterUser shape.
 * `role` rides along so the `jwt` callback can persist it into the token.
 */
const toAdapterUser = (doc: UserDocument): AdapterUser => ({
  id: doc._id.toString(),
  name: doc.name ?? null,
  // Auth.js types email as required on AdapterUser; the schema allows null
  // to stay byte-compatible with the Prisma data (`email String?`).
  email: doc.email as string,
  emailVerified: doc.emailVerified ?? null,
  image: doc.image ?? null,
  role: doc.role,
});

const toAdapterSession = (doc: SessionDocument): AdapterSession => ({
  sessionToken: doc.session_token,
  userId: doc.userId.toString(),
  expires: doc.expires,
});

export function MongooseAdapter(): Adapter {
  return {
    async createUser(user) {
      const doc = await UserModel.create({
        name: user.name ?? null,
        email: user.email,
        emailVerified: user.emailVerified ?? null,
        image: user.image ?? null,
      });
      return toAdapterUser(doc);
    },

    async getUser(id) {
      if (!isValidObjectId(id)) return null;
      const doc = await UserModel.findById(id);
      return doc ? toAdapterUser(doc) : null;
    },

    async getUserByEmail(email) {
      const doc = await UserModel.findOne({ email });
      return doc ? toAdapterUser(doc) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await AccountModel.findOne({ provider, providerAccountId });
      if (!account) return null;
      const user = await UserModel.findById(account.userId);
      return user ? toAdapterUser(user) : null;
    },

    async updateUser(user) {
      const { id, ...rest } = user;
      const doc = await UserModel.findByIdAndUpdate(id, { $set: rest }, { new: true });
      if (!doc) throw new Error(`MongooseAdapter: user ${id} not found`);
      return toAdapterUser(doc);
    },

    async deleteUser(userId) {
      await Promise.all([
        AccountModel.deleteMany({ userId }),
        SessionModel.deleteMany({ userId }),
        UserModel.findByIdAndDelete(userId),
      ]);
    },

    async linkAccount(account) {
      // Mongoose strict mode drops provider-specific extra fields that are
      // not part of the Account schema (same effect as the Prisma columns).
      await AccountModel.create(account);
      return account;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await AccountModel.findOneAndDelete({ provider, providerAccountId });
    },

    async createSession(session) {
      await SessionModel.create({
        session_token: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      });
      return session;
    },

    async getSessionAndUser(sessionToken) {
      const session = await SessionModel.findOne({ session_token: sessionToken });
      if (!session) return null;
      const user = await UserModel.findById(session.userId);
      if (!user) return null;
      return { session: toAdapterSession(session), user: toAdapterUser(user) };
    },

    async updateSession(session) {
      const { sessionToken, ...rest } = session;
      const doc = await SessionModel.findOneAndUpdate(
        { session_token: sessionToken },
        { $set: rest },
        { new: true }
      );
      return doc ? toAdapterSession(doc) : null;
    },

    async deleteSession(sessionToken) {
      const doc = await SessionModel.findOneAndDelete({ session_token: sessionToken });
      return doc ? toAdapterSession(doc) : null;
    },

    async createVerificationToken(token) {
      await VerificationTokenModel.create(token);
      return token;
    },

    async useVerificationToken({ identifier, token }) {
      const doc = await VerificationTokenModel.findOneAndDelete({ identifier, token });
      if (!doc) return null;
      const verificationToken: VerificationToken = {
        identifier: doc.identifier,
        token: doc.token,
        expires: doc.expires,
      };
      return verificationToken;
    },
  };
}
```

## Step 7: The Auth.js config — providers, strategy, callbacks, logging

The heart of the system. **`backend/src/auth/config.ts`** — complete, including
the observability from Step 11:

```ts
import type { ExpressAuthConfig } from "@auth/express";
import Google from "@auth/express/providers/google";
import Credentials from "@auth/express/providers/credentials";
import bcrypt from "bcryptjs";
import { config } from "../config/env";
import { logger } from "../config/logger";
import { UserModel } from "../models";
import { MongooseAdapter } from "./adapter";

export const authConfig: ExpressAuthConfig = {
  secret: config.authSecret,
  basePath: "/api/auth", // must equal the public path on BOTH sides of the proxy
  // Route Auth.js' own diagnostics (config problems, provider errors, JWT
  // decrypt failures, …) into the winston logger instead of bare console.
  logger: {
    error: (error) => {
      // Expected business outcomes (wrong password, cancelled OAuth, stale
      // pre-migration cookie) are warnings; only real faults keep the stack.
      if (["CredentialsSignin", "AccessDenied", "JWTSessionError", "SessionTokenError"].includes(error.name)) {
        logger.warn(`auth: ${error.name}: ${error.message}`);
        return;
      }
      logger.error(`auth: ${error.name}: ${error.message}`, { stack: error.stack });
    },
    warn: (code) => logger.warn(`auth: warning ${code} (https://warnings.authjs.dev)`),
    debug: (message, metadata) => logger.debug(`auth: ${message}`, { metadata }),
  },
  // Requests arrive via the Next.js proxy; Auth.js must trust the forwarded host.
  trustHost: true,
  adapter: MongooseAdapter(),
  // JWT strategy: REQUIRED by the Credentials provider (§1.2).
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          logger.warn("auth: credentials rejected — missing email or password");
          return null;
        }

        const normalizedEmail = email.trim().toLowerCase();
        logger.info("auth: credentials sign-in attempt", { email: normalizedEmail });

        // `password` is select:false on the schema; opt in explicitly.
        const user = await UserModel.findOne({ email: normalizedEmail }).select("+password");
        if (!user?.password) {
          // unknown user or Google-only account
          logger.warn("auth: credentials rejected — no such user or Google-only account", { email: normalizedEmail });
          return null;
        }

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) {
          logger.warn("auth: credentials rejected — wrong password", { email: normalizedEmail });
          return null;
        }

        logger.info("auth: credentials verified", { userId: user._id.toString(), email: normalizedEmail });
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    // Runs AT SIGN-IN (user defined) and on token refreshes. This is the ONLY
    // moment data flows from the database into the token: whatever you
    // snapshot here is frozen until the next sign-in.
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        logger.info("auth: jwt issued at sign-in", { userId: user.id, email: user.email, role: user.role });
      }
      return token;
    },
    // Runs on EVERY session read — shapes what clients actually receive
    // (useSession() and the server-side auth() helper).
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? session.user.id;
        if (token.role) session.user.role = token.role;
      }
      logger.debug("auth: session built from jwt", {
        userId: session.user?.id,
        email: session.user?.email,
        role: session.user?.role,
      });
      return session;
    },
  },
  // Lifecycle events — fire after each auth process completes successfully.
  events: {
    signIn: ({ user, account, isNewUser }) => {
      logger.info("auth: signIn completed", {
        userId: user.id,
        email: user.email,
        provider: account?.provider,
        isNewUser: isNewUser ?? false,
      });
    },
    signOut: (message) => {
      const token = "token" in message ? message.token : null;
      logger.info("auth: signOut completed", { userId: token?.sub, email: token?.email });
    },
    createUser: ({ user }) => {
      logger.info("auth: user created", { userId: user.id, email: user.email });
    },
    linkAccount: ({ user, account }) => {
      logger.info("auth: account linked", { userId: user.id, provider: account.provider });
    },
  },
  pages: { signOut: "/" },
};
```

Read the two callbacks as a pipeline with two speeds: `jwt` runs at sign-in — the
role snapshot is a *feature* (no DB read per request) and a *cost* (role changes
lag until re-login). `session` runs on every read and shapes the public session.

In `authorize`, return `null` for *every* failure. Auth.js turns them all into the
same generic `CredentialsSignin` — deliberately: "wrong password" vs "no such
user" would tell an attacker which emails have accounts. Log the distinction
server-side (as above); users get the generic error.

### Adding another OAuth provider (GitHub) — the pattern generalizes

Once the machinery exists, each extra provider is a config entry plus one OAuth
app registration. GitHub, as done in this project:

1. Create the OAuth app at <https://github.com/settings/developers> with the
   **Authorization callback URL on the frontend origin** (the proxy again):
   `https://<frontend>/api/auth/callback/github` (dev:
   `http://localhost:3000/api/auth/callback/github`).
2. Add `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` to the backend `.env` and
   config. Make them optional so the server boots before they exist:

```ts
// env.ts — optional: the provider is only mounted when both are present
githubClientId: process.env.GITHUB_CLIENT_ID ?? "",
githubClientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
```

3. Mount the provider conditionally in `providers: [...]`:

```ts
// Only mounted when the GitHub OAuth app is configured (see env.ts).
...(config.githubClientId && config.githubClientSecret
  ? [
      GitHub({
        clientId: config.githubClientId,
        clientSecret: config.githubClientSecret,
        // GitHub only exposes verified primary emails via its API.
        allowDangerousEmailAccountLinking: true,
        profile(profile) {
          // GitHub has no structured name — split the display name
          // pragmatically (first token / rest); null when absent.
          const displayName = profile.name ?? profile.login;
          const [first, ...rest] = (displayName ?? "").trim().split(/\s+/);
          return {
            id: profile.id.toString(),
            name: displayName,
            email: profile.email,
            image: profile.avatar_url,
            firstName: first || null,
            lastName: rest.length > 0 ? rest.join(" ") : null,
          };
        },
      }),
    ]
  : []),
```

4. Frontend: a button calling `signIn("github", { callbackUrl: "/" })`. Done —
   CSRF, PKCE/state, callback handling, account linking all reuse the same
   machinery as Google.

Two decisions worth explaining:

- **`allowDangerousEmailAccountLinking: true`** — by default, if someone signs
  in with GitHub using an email that already belongs to a Google-created
  account, Auth.js refuses (`OAuthAccountNotLinked`) because auto-linking on an
  *unverified* email would let an attacker claim an account by registering it
  at another provider. Google and GitHub both hand out only **verified**
  emails, so linking is safe here and turns a dead-end error into the UX users
  expect (one account, several login methods). Do **not** set this on providers
  that don't verify emails.
- **GitHub's email can still be null** (user hides it even from the API): the
  Auth.js GitHub provider then falls back to fetching the user's primary
  verified email via GitHub's `/user/emails` endpoint before your `profile()`
  mapping runs.

**`backend/src/types/authjs.d.ts`** — type augmentation so `role`/`id` are typed
everywhere. `@auth/express` re-exports its types from `@auth/core`, so the
augmentation targets `@auth/core`:

```ts
import type { DefaultSession } from "@auth/core/types";
import type { UserRole } from "../models/user.model";

declare module "@auth/core/types" {
  interface Session {
    user?: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }

  interface User {
    role?: UserRole;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: UserRole;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: UserRole;
  }
}
```

## Step 8: Mount it in Express — order matters

**`backend/src/app.ts`** — the complete auth-relevant section, in the exact order
it must appear:

```ts
import express, { Application } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { ExpressAuth } from "@auth/express";
import { authConfig } from "./auth/config";
import { config } from "./config/env";
import { logger } from "./config/logger";

const app: Application = express();

// (1) Believe X-Forwarded-* headers — we live behind the Next.js proxy.
app.set("trust proxy", 1);

// (2) CORS with credentials, allow-listing the frontend origins.
app.use(
  cors({
    origin: config.frontendUrls,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// (3) Body parsing BEFORE Auth.js — its sign-in POSTs are form-encoded.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// (4) A separate, GENEROUS rate limiter for auth. Every signed-in tab polls
// /api/auth/session; on the strict business limiter your own polling would
// exhaust the budget and users would get mysteriously logged out.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth", authLimiter);

// (5) Host-restore shim. @auth/express builds absolute URLs (redirects,
// cookies) from the Host header; some proxies (e.g. Vercel rewrites) replace
// Host with the backend's host and carry the original in X-Forwarded-Host.
// Without this, production generates URLs pointing at the internal backend:
// cookies on the wrong domain, redirects to nowhere. Locally it's a no-op —
// the classic "works locally, breaks deployed" bug, defused in five lines.
app.use("/api/auth", (req, _res, next) => {
  const forwardedHost = req.headers["x-forwarded-host"];
  if (typeof forwardedHost === "string" && forwardedHost.length > 0) {
    req.headers.host = forwardedHost;
  }
  next();
});

// (6) Request-outcome logging for every auth call (see Step 11).
app.use("/api/auth", (req, res, next) => {
  const [action, provider] = req.path.replace(/^\//, "").split("/");
  const startedAt = Date.now();
  res.on("finish", () => {
    const level = ["session", "csrf", "providers"].includes(action) ? "debug" : "info";
    logger.log(level, `auth: ${req.method} ${req.originalUrl} -> ${res.statusCode}`, {
      action,
      ...(provider ? { provider } : {}),
      durationMs: Date.now() - startedAt,
    });
  });
  next();
});

// (7) Auth.js itself.
app.use("/api/auth/*", ExpressAuth(authConfig));

// (8) ONLY NOW the strict limiter + business routes.
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use("/api/", limiter);
// app.use("/api", routes);  // your business routes

export default app;
```

## Step 9: Route protection for the backend's own API

Business endpoints need the session too. **`backend/src/auth/middleware.ts`** —
complete, built on the official `getSession` pattern but returning JSON 401/403
instead of the docs' redirect (this is an API, not a website):

```ts
import type { NextFunction, Request, Response } from "express";
import { getSession } from "@auth/express";
import type { Session } from "@auth/core/types";
import { authConfig } from "./config";
import { logger } from "../config/logger";
import type { UserRole } from "../models";

const currentSession = async (req: Request, res: Response): Promise<Session | null> => {
  // `undefined` = not resolved yet; `null` = resolved as signed out (don't refetch).
  if (res.locals.session === undefined) {
    const session = (res.locals.session = await getSession(req, authConfig));
    logger.debug("auth: session resolved for protected route", {
      path: req.originalUrl,
      userId: session?.user?.id ?? null,
      role: session?.user?.role ?? null,
    });
  }
  return res.locals.session as Session | null;
};

/** Attaches the Auth.js session (or null) to `res.locals.session`. */
export const authSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await currentSession(req, res);
    next();
  } catch (error) {
    next(error);
  }
};

/** Rejects the request with 401 unless a signed-in user is present. */
export const authenticatedUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const session = await currentSession(req, res);
    if (!session?.user) {
      logger.warn("auth: request rejected — no session", { path: req.originalUrl });
      res.status(401).json({ success: false, message: "Authentication required" });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
};

/** Rejects with 401/403 unless the signed-in user has one of the given roles. */
export const requireRole = (...roles: UserRole[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await currentSession(req, res);
      if (!session?.user) {
        logger.warn("auth: request rejected — no session", { path: req.originalUrl });
        res.status(401).json({ success: false, message: "Authentication required" });
        return;
      }
      if (!roles.includes(session.user.role)) {
        logger.warn("auth: request rejected — insufficient role", {
          path: req.originalUrl,
          userId: session.user.id,
          role: session.user.role,
          required: roles,
        });
        res.status(403).json({ success: false, message: "Insufficient permissions" });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
};
```

Usage in a route file:

```ts
router.get("/bookmarks", authenticatedUser, listBookmarks);
router.post("/jobs", requireRole("ADMIN"), createJob);
```

Note the per-request cache on `res.locals.session`: when several of these guards
run in one chain, the JWT is decrypted once, not three times.

## Step 10: Registration — the one thing Auth.js won't do

Auth.js authenticates; it does not create password accounts. Registration is a
plain endpoint that bcrypt-hashes the password and returns — **no token, no
cookie, no session**. Never let a registration endpoint mint its own sessions;
the moment it does, you have two authentication systems and one of them is
unaudited.

**`backend/src/routes/user.routes.ts`** — complete:

```ts
import { Router, type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcryptjs";
import { UserModel } from "../models";

const router = Router();

const BCRYPT_ROUNDS = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/**
 * POST /api/users/register
 * Creates a user with a bcrypt-hashed password so the Credentials provider
 * has something to verify against. Issues no session/cookie/token — signing
 * in still goes exclusively through Auth.js (POST /api/auth/callback/credentials).
 */
router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = (req.body ?? {}) as {
      name?: unknown;
      email?: unknown;
      password?: unknown;
    };

    if (typeof email !== "string" || !EMAIL_PATTERN.test(email.trim())) {
      res.status(400).json({ success: false, message: "A valid email is required" });
      return;
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        success: false,
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await UserModel.findOne({ email: normalizedEmail });
    if (existing) {
      res.status(409).json({ success: false, message: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await UserModel.create({
      name: typeof name === "string" && name.trim() ? name.trim() : null,
      email: normalizedEmail,
      password: passwordHash,
    });

    res.status(201).json({
      success: true,
      data: { id: user._id.toString(), name: user.name, email: user.email },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
```

## Step 11: The frontend's server-side `auth()` — same name, new plumbing

Server components across the app already import `auth()` from `@/auth`. Keep that
module path and signature (so existing import sites stay untouched) but replace
the implementation.

**`frontend/auth.ts`** — complete:

```ts
import { headers } from "next/headers";
import type { Session } from "next-auth";

/**
 * Authentication is owned by the Express backend (@auth/express). This helper
 * keeps the same `auth()` API the app already imports from "@/auth", but
 * resolves the session by calling the backend's Auth.js session endpoint
 * (GET /api/auth/session) with the cookies of the incoming request.
 */
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000";

export const auth = async (): Promise<Session | null> => {
  // Outside the try/catch ON PURPOSE: during prerendering headers() throws a
  // DynamicServerError that Next.js uses to mark the route dynamic (the same
  // behavior the previous NextAuth auth() had) — it must not be swallowed.
  const cookie = headers().get("cookie");
  if (!cookie) {
    console.debug("[auth] no cookies on request — treating as signed out");
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!response.ok) {
      console.warn(`[auth] session fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const session: Session | null = await response.json();
    if (!session || Object.keys(session).length === 0) {
      console.debug("[auth] backend returned empty session — signed out");
      return null;
    }
    console.debug(`[auth] session resolved for ${session.user?.email ?? "unknown user"}`);
    return session;
  } catch (error) {
    // Backend unreachable — treat as signed out rather than crashing the page.
    console.warn(`[auth] backend unreachable at ${BACKEND_URL} — treating as signed out:`, error);
    return null;
  }
};
```

Three subtleties that earn their comments:

- **`headers()` outside the try/catch** — swallow Next's `DynamicServerError` and
  you break your build in ways that take an afternoon to diagnose.
- **Every failure returns `null`** — a dead backend renders pages as signed-out
  instead of crashing them. Flip side: a down backend looks *exactly* like
  "nobody is logged in", which is why the log lines exist.
- **It calls the backend directly** (`BACKEND_URL`), not through its own proxy —
  this is server-to-server; routing through the frontend's own rewrite would be a
  pointless loopback through yourself.

The frontend's existing type augmentation keeps working unchanged, because the
backend's `session` callback produces the same shape.
**`frontend/next-auth.d.ts`:**

```ts
import { DefaultSession } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user?: {
      id: string;
      name: string;
      email: string;
      image: string;
      role: "USER" | "ADMIN" | "AUTHOR";
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    user?: {
      id: string;
      name: string;
      email: string;
      image: string;
      role: "USER" | "ADMIN" | "AUTHOR";
    };
  }
}
```

## Step 12: The client — deliberately (almost) unchanged

`SessionProvider`, `useSession()`, `signIn()`, `signOut()` from `next-auth/react`
are just REST clients for the endpoints we now serve through the proxy. Because
the proxy preserves the exact paths and cookie origin, **they work as-is**. The
only optional addition is client-side logging (part of Step 13):

**`frontend/app/lib/authClient.ts`** — logged drop-in wrappers:

```ts
"use client";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";

/**
 * Drop-in replacements for next-auth/react's signIn/signOut that log each
 * step of the flow to the browser console (prefix "[auth]").
 * Implemented untyped and cast back to the originals because their
 * redirect-dependent overloads can't be re-declared with a single signature.
 */

export const signIn = (async (provider?: string, options?: object, authorizationParams?: object) => {
  console.info(`[auth] signIn started`, { provider: provider ?? "(provider picker)" });
  try {
    const result = await (nextAuthSignIn as CallableFunction)(provider, options, authorizationParams);
    // With the default redirect behavior the page navigates away before this
    // resolves; when it does resolve, `result` describes the outcome.
    console.info(`[auth] signIn response`, result ?? "(redirecting)");
    return result;
  } catch (error) {
    console.error(`[auth] signIn failed`, error);
    throw error;
  }
}) as typeof nextAuthSignIn;

export const signOut = (async (options?: object) => {
  console.info(`[auth] signOut started`);
  try {
    const result = await (nextAuthSignOut as CallableFunction)(options);
    console.info(`[auth] signOut completed`, result ?? "");
    return result;
  } catch (error) {
    console.error(`[auth] signOut failed`, error);
    throw error;
  }
}) as typeof nextAuthSignOut;
```

**`frontend/app/components/AuthSessionLogger.tsx`** — logs every session status
transition; renders nothing:

```tsx
"use client";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

const AuthSessionLogger = () => {
  const { status, data } = useSession();

  useEffect(() => {
    if (status === "authenticated") {
      console.info(`[auth] session status: authenticated`, {
        email: data?.user?.email,
        role: data?.user?.role,
      });
    } else {
      console.info(`[auth] session status: ${status}`);
    }
  }, [status, data?.user?.email, data?.user?.role]);

  return null;
};

export default AuthSessionLogger;
```

**Wire-up in `frontend/app/layout.tsx`:**

```tsx
import { SessionProvider } from "next-auth/react";
import AuthSessionLogger from "./components/AuthSessionLogger";

// …inside the body:
<SessionProvider>
  <AuthSessionLogger />
  {children}
</SessionProvider>
```

**And in components** — swap only the import; call sites don't change:

```tsx
// before:
import { signIn, signOut, useSession } from "next-auth/react";
// after:
import { useSession } from "next-auth/react";
import { signIn, signOut } from "@/app/lib/authClient";

// call sites, unchanged:
signIn("google");
await signOut();
```

### A complete login page handler (all three providers)

The real handlers from `frontend/app/(pages)/(general)/login/page.tsx`,
stripped of markup. Note the two different `signIn` shapes:

```tsx
"use client";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { signIn } from "@/app/lib/authClient";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // OAuth: fire-and-forget — the browser NAVIGATES AWAY to Google/GitHub,
  // so there is no result to await; the callbackUrl is where the user lands
  // after the provider round-trip completes.
  const oauthLogin = (provider: "google" | "github") => signIn(provider, { callbackUrl: "/" });

  // Credentials: redirect:false keeps the user on this page so WE decide
  // what happens — show the error inline, or navigate on success.
  const handleCredentialsLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        // Always the generic CredentialsSignin — never reveal WHICH part was wrong
        toast.error("Wrong email or password");
        return;
      }
      router.push("/");
      router.refresh(); // re-render server components so auth()-guarded UI updates
    } finally {
      setSubmitting(false);
    }
  };

  /* …form JSX calls handleCredentialsLogin on submit,
     buttons call oauthLogin("github") / oauthLogin("google") … */
}
```

The `router.refresh()` matters and juniors miss it: `router.push` alone reuses
the cached server-component tree, which was rendered while signed *out*.
`refresh()` re-runs the server components so everything guarded by `auth()`
picks up the new cookie.

### A complete signup flow (register → auto sign-in)

From `frontend/app/(pages)/(general)/signup/page.tsx`. Registration and
sign-in stay two separate calls on purpose — the register endpoint issues no
session (Step 10), so the flow is: create the account, then log in through
Auth.js like any other login:

```tsx
const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (!agreed) {
    toast.error("Please accept the Terms and Conditions");
    return;
  }
  setSubmitting(true);
  try {
    // 1) Create the account — plain backend endpoint, proxied via the
    //    /api/users rewrite, no cookie/session comes back.
    const response = await fetch("/api/users/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName, lastName, email, password }),
    });
    const payload = await response.json();
    if (!response.ok) {
      // 400 = validation, 409 = email already registered — the backend's
      // message is written to be user-presentable.
      toast.error(payload?.message ?? "Could not create your account");
      return;
    }

    // 2) Sign in with the credentials that were just registered.
    const result = await signIn("credentials", { email, password, redirect: false });
    if (result?.error) {
      // Account exists but the sign-in failed (rare) — don't strand the user.
      toast.error("Account created — please sign in");
      router.push("/login");
      return;
    }
    router.push("/");
    router.refresh();
  } finally {
    setSubmitting(false);
  }
};
```

## Step 13: Observability — build the flight recorder before you fly

All the logging code is already embedded above (config.ts logger + events,
app.ts request logger, middleware warnings, frontend console lines). The
principles it encodes:

- **Request level:** every auth call logged with action/provider/status/duration;
  chatty endpoints (`session`, `csrf`, `providers`) at debug so info stays readable.
- **Expected failures are warnings, not errors.** A user typoing their password
  (`CredentialsSignin`) is not an error; an unexpected fault with a stack trace is.
- **Lifecycle events** give clean one-liners at exactly the moments that matter —
  `isNewUser` on sign-in tells you created-vs-reused at a glance.
- **The frontend logs why it decided "signed out"** — because this design *fails
  soft*, "backend down" is otherwise indistinguishable from "logged out".

⚠️ Auth.js **debug logs contain live secrets** — access tokens, id_tokens, your
OAuth client secret, PKCE material. Debug must be off in production (here: winston
level `info` in prod), and raw dev logs must never be committed or pasted publicly.

## Step 14: Test each flow from the outside

Before touching a browser, prove each flow with curl — through the proxy, which
tests both hops at once. The CSRF handshake (§1.4) must be replayed manually:

```bash
# 1. Is anything alive? (expect provider JSON with FRONTEND-origin URLs)
curl -s http://localhost:3000/api/auth/providers

# 2. Session without cookies (expect null)
curl -s http://localhost:3000/api/auth/session

# 3. Credentials flow with CSRF handshake
curl -s -c jar.txt http://localhost:3000/api/auth/csrf     # note the csrfToken
curl -s -b jar.txt -c jar.txt \
  -H "X-Auth-Return-Redirect: 1" \
  --data-urlencode "csrfToken=<token>" \
  --data-urlencode "email=nobody@example.com" \
  --data-urlencode "password=wrong" \
  http://localhost:3000/api/auth/callback/credentials
# expect: {"url":"…/signin?error=CredentialsSignin"}  ← this is a PASS:
# the request crossed the proxy, passed CSRF, ran authorize(), hit the DB.

# 4. Google outbound leg
curl -s -b jar.txt -c jar.txt \
  -H "X-Auth-Return-Redirect: 1" \
  --data-urlencode "csrfToken=<token>" \
  http://localhost:3000/api/auth/signin/google
# expect: {"url":"https://accounts.google.com/…redirect_uri=http%3A%2F%2Flocalhost%3A3000…"}
# — verify the redirect_uri is the FRONTEND origin.
```

Then finish in a real browser: Google sign-in end-to-end, credentials sign-in,
session survives refresh, role-gated pages, sign-out. Remember dev needs **both**
servers running — if the backend is down, everything just looks signed-out.

## Step 15: Cut over and deploy

1. Deploy the backend first (it serves auth but nothing points at it yet).
2. Deploy the frontend with the rewrite + deleted NextAuth route.
3. Verify env on the host: `AUTH_SECRET` (**the old one!**), `AUTH_URL` (public
   frontend origin + `/api/auth`), Google credentials, Node ≥ 20.19.
4. Watch the logs: a burst of `JWTSessionError` = secret mismatch (§1.3);
   `UntrustedHost` = proxy trust misconfigured (Step 8);
   `redirect_uri_mismatch` from Google = `AUTH_URL` points at the wrong origin.

---

# Part 4 — How it runs: follow one user all the way through

Open three consoles (browser devtools, Next terminal, backend terminal) and trace
along.

## 4.0 The wire: exactly what one request looks like, hop by hop

Before the flows, here is the anatomy of a single authenticated request —
`GET /api/auth/session` from a signed-in browser — with every header that
matters. Every other flow is this picture with a different path/method.

```text
┌─────────┐ ①                       ┌──────────────┐ ②                    ┌──────────────┐
│ Browser │ ───────────────────────►│ Next.js      │ ────────────────────►│ Express      │
│         │ GET /api/auth/session   │ :3000        │ GET /api/auth/session│ :4000        │
│         │ Host: localhost:3000    │              │ Host: localhost:3000 │              │
│         │ Cookie: authjs.session- │ rewrite rule │ (Vercel: Host is re- │ ③ shim: X-  │
│         │         token=eyJhb…    │ matches      │  placed; original in │ Forwarded-  │
│         │                         │ /api/auth/*  │  X-Forwarded-Host)   │ Host → Host │
│         │                         │              │ Cookie: (forwarded   │ ④ Auth.js:  │
│         │                         │              │          unchanged)  │ decrypt JWT, │
│         │                         │              │                      │ jwt+session  │
│         │ ⑥                      │ ⑤           │                      │ callbacks    │
│         │ ◄───────────────────────│ ◄────────────│──────────────────────│              │
│         │ 200 {"user":{…},        │ response     │ 200 + (sometimes)    │              │
│         │      "sessionId":"…"}   │ passes back  │ Set-Cookie: refreshed│              │
│         │ cookie stored against   │ verbatim     │ authjs.session-token │              │
│         │ localhost:3000 ✓        │              │                      │              │
└─────────┘                         └──────────────┘                      └──────────────┘
```

Step by step:

1. **Browser → Next.js.** The browser attaches every `authjs.*` cookie
   automatically because the request goes to the *frontend* origin — the origin
   the cookies belong to. This is the entire point of the proxy.
2. **Next.js → Express.** The rewrite forwards method, path, query, headers
   (including `Cookie`), and body. It is not a redirect — the browser never
   sees the backend URL.
3. **The Host shim.** Auth.js derives absolute URLs from `Host`. The dev proxy
   keeps the original; Vercel replaces it and stashes the original in
   `X-Forwarded-Host`, which the shim restores. `trust proxy` +
   `trustHost: true` make Express and Auth.js believe these forwarded headers.
4. **Auth.js does its work.** Decrypts the session cookie with `AUTH_SECRET`,
   runs the `jwt` callback (revocation check against the registry — Part 6),
   then the `session` callback (shapes the JSON).
5. **Response travels back through the proxy verbatim** — including any
   `Set-Cookie` headers (session expiry refresh, CSRF cookies, OAuth
   one-shots).
6. **Browser stores cookies against the frontend origin.** From its
   perspective, one first-party server handled everything.

Three variations on this picture:

- **Server components** (`auth()` in `auth.ts`): the Next.js *server* is the
  client — it forwards the browser's `Cookie` header in a direct
  server-to-server fetch to `BACKEND_URL`, skipping its own proxy (a loopback
  through yourself would add nothing).
- **OAuth redirects** (Google/GitHub): steps ①–⑥ happen for the `signin` POST,
  then the *browser* physically navigates away to the provider and returns to
  `/api/auth/callback/*` — which is again just this same picture.
- **Business APIs needing the session** (e.g. `/api/sessions` in Part 6): same
  hops, different path — which is why those routes also need a rewrite rule.
  A browser calling `:4000` directly would not carry the cookies (different
  origin), and CORS wouldn't save you because the cookie simply isn't sent.

## 4.1 First visit (anonymous)

1. `<SessionProvider>` mounts → browser fires `GET /api/auth/session`.
2. The rewrite forwards it to the backend, cookies and all.
3. Backend finds no session cookie → returns `null`. No DB touched.
4. `useSession()` goes `loading → unauthenticated`; the Sign In button renders.

Server components calling `auth()` did the same check server-to-server. Total cost
of an anonymous visitor: zero database reads.

## 4.2 Google sign-in

**Outbound:** click → `signIn("google")` → the client fetches `/providers` and
`/csrf`, then POSTs `/api/auth/signin/google`. The backend mints the PKCE
verifier into a 15-minute encrypted cookie, builds the Google authorization URL
(with the verifier's *hash*), and returns it. The browser navigates to Google.
Your app never sees the user's Google password.

**Return:** Google redirects to `/api/auth/callback/google?code=…` — through the
proxy like everything else. In one backend request: decrypt and **delete** the
PKCE cookie (single-use) → exchange code+verifier for the identity,
server-to-server → adapter maps the Google account to your user
(`getUserByAccount`; new users get `createUser` + `linkAccount`) → the `jwt`
callback snapshots `id` and `role` into a token → token encrypted into the
`authjs.session-token` cookie → `302` back to the app.

Backend logs tell the whole story: `jwt issued at sign-in` →
`signIn completed {isNewUser: false}` → `GET /callback/google -> 302`.

## 4.3 Credentials sign-in

`signIn("credentials", {email, password})` → CSRF handshake → POST
`/api/auth/callback/credentials` → `authorize()` runs: normalize email → fetch
user *with* the opt-in password field → `bcrypt.compare`.

- **Fail** (any reason): `authorize` returns `null` → the response is a 200 whose
  payload redirect URL carries `?error=CredentialsSignin`. Same generic error for
  every cause — the logs know the difference, attackers don't.
- **Succeed:** identical to Google from here — `jwt` callback, events, encrypted
  cookie. Downstream, nobody can tell how a user signed in.

## 4.4 Every request while signed in

Three consumers, one mechanism — decrypt cookie, run the `session` callback,
return `{user: {id, email, role}}`, **no database**:

- `useSession()` in client components (polls through the proxy),
- `auth()` in server components (forwards cookies server-to-server),
- backend route guards (`getSession` middleware, cached per request, rejecting
  401 for no session / 403 for wrong role).

## 4.5 Sign-out

`signOut()` → CSRF handshake → POST `/api/auth/signout` → backend fires the
`signOut` event and expires the session cookie. Under JWT there is nothing to
delete server-side — the session only ever lived in the cookie. (Corollary: a
stolen cookie stays valid until expiry. That's the revocation trade-off you
accepted in §1.2, now visible in the flow.)

---

# Part 5 — Securing things: client pages, server pages, routes, and the backend

One principle governs everything in this part:

> **The backend middleware is the only real security boundary.** Everything in
> the frontend — client redirects, server-component checks — is UX and
> defense-in-depth. Data is safe because the *API that serves it* checks the
> session, not because a page hid a button.

Why: any user can call your APIs directly with curl, and client-side JavaScript
is fully under the visitor's control. Frontend guards exist so legitimate users
never see broken half-rendered pages — not to stop attackers.

## 5.1 Client pages ("use client") — UX-level guarding

Pattern: let `useSession()` resolve, redirect when unauthenticated, gate
role-specific UI on `data.user.role`. From the sessions page:

```tsx
"use client";
const { status, data } = useSession();
const isAdmin = data?.user?.role === "ADMIN";

useEffect(() => {
  if (status === "unauthenticated") router.replace("/login");
}, [status, router]);

if (status === "loading") return <Spinner />;
if (status !== "authenticated") return null;   // brief flash guard while redirecting
```

Remember the three states: `loading` (don't decide anything yet),
`authenticated`, `unauthenticated`. Deciding during `loading` causes the classic
"flashes the login screen at signed-in users" bug.

## 5.2 Server pages (React Server Components) — check before rendering

Server components run on the server, so they can consult the session *before*
any HTML exists. This is the strongest page-level guard:

```tsx
// app/(pages)/heroshima/page.tsx — an admin page
import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return <AdminDashboard />;   // fetch admin data here, server-side
}
```

Two properties worth appreciating: the unauthorized visitor receives a redirect
response — the protected markup is never generated, so there is nothing to find
in view-source; and because `auth()` fails soft (backend down ⇒ `null`), the
failure mode is "redirected to login", never a crashed page.

Frontend **route handlers** (`app/api/*/route.ts`) that return protected data
use the same shape: `const session = await auth(); if (!session?.user) return
NextResponse.json({...}, { status: 401 });`.

## 5.3 The backend — the actual boundary

Every protected business endpoint goes through the middleware from Step 9;
that's the enforcement point that matters:

```ts
router.get("/sessions/mine", authenticatedUser, handler);       // any signed-in user
router.get("/sessions", requireRole("ADMIN"), handler);         // role-gated
router.delete("/sessions/user/:userId", requireRole("ADMIN"), handler);
```

What the middleware chain gives you, and why each piece exists:

| Layer | What it does | Attack it stops |
|---|---|---|
| `getSession()` (decrypt cookie) | Cryptographic identity — the cookie is a JWE only `AUTH_SECRET` can open | Forged/tampered cookies |
| Registry check in the `jwt` callback (Part 6) | Revocation — a valid cookie can still be dead | Stolen-cookie longevity, "sign out everywhere" |
| `authenticatedUser` → 401 | Rejects anonymous requests before handlers run | Direct curl access to user data |
| `requireRole(…)` → 403 | Role enforcement server-side | A USER calling admin endpoints (hiding the admin UI is not enforcement) |
| Ownership checks in handlers | e.g. `/sessions/mine/:id` verifies the record belongs to the caller | IDOR — revoking someone else's session by guessing ids |
| CORS allow-list + `credentials: true` | Browsers on other origins can't make credentialed calls | Cross-origin API abuse from malicious sites |
| Rate limiters (split budgets) | Caps request volume per IP | Brute-forcing credentials, scraping |
| CSRF double-submit (§1.4, Auth.js built-in) | State-changing auth POSTs need the cookie+body token pair | Cross-site request forgery |

Note the *layering*: the same request may pass through five of these. That's
intentional — each guards a different failure, and any one surviving a mistake
in another is the point of defense-in-depth.

## 5.4 What NOT to rely on

- **Hiding UI is not authorization.** The ADMIN link being invisible doesn't
  protect `/api/sessions` — `requireRole("ADMIN")` does.
- **The frontend's `auth()` is not enforcement for backend data.** It guards
  *rendering*. The API behind the page must check again.
- **`NEXT_PUBLIC_*` env vars are public.** Anything secret lives only in the
  backend's env.
- **Client-supplied role/user ids are untrusted.** The role comes from the
  decrypted token server-side; handlers must never read identity from request
  bodies or query params.

---

# Part 6 — "Online sessions": can you see and manage who's logged in with JWT?

The honest answer first: **pure JWT sessions cannot do this.** And then the
practical answer: **a hybrid can — and that's what this project implements.**

## 6.1 Why pure JWT can't

With `strategy: "jwt"` the session lives entirely inside the browser's cookie.
The server stores nothing at sign-in, so there is nothing to enumerate ("who is
logged in?"), no presence ("who is active right now?"), and nothing to delete
("sign this device out"). A JWT is a bearer credential: *anyone presenting it is
in*, until it expires. Sign-out merely deletes the browser's copy — a stolen
copy keeps working. These aren't bugs; they're the definition of stateless.

If session management had been the *primary* requirement, the right call would
be the database strategy (a `sessions` row per login = list/revoke for free) —
but the Credentials provider forbids it (§1.2). Hence the hybrid.

## 6.2 The hybrid: keep the JWT, add a server-side registry

The trick: at sign-in, stamp a random **session id** into the token and write a
matching record server-side. From then on the JWT still authenticates
cryptographically, but on every session read the backend also asks the registry
"is this login still allowed?" — turning the stateless token into a *revocable*
one.

The registry model (`backend/src/models/login-session.model.ts`) — a new
collection, no legacy naming to preserve:

```ts
const LoginSessionSchema = new Schema(
  {
    sessionId: { type: String, required: true },   // the id stamped into the JWT
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, default: null },      // google / github / credentials
    userAgent: { type: String, default: null },
    ip: { type: String, default: null },
    lastSeenAt: { type: Date, required: true, default: () => new Date() },
    revokedAt: { type: Date, default: null },       // set ⇒ token dies on next read
    expiresAt: { type: Date, required: true },      // mirrors JWT expiry
  },
  { collection: "login_sessions", timestamps: true, versionKey: false }
);
// TTL index: expired records purge themselves
LoginSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

The `jwt` callback becomes the enforcement point (`backend/src/auth/config.ts`):

```ts
async jwt({ token, user, account }) {
  if (user?.id) {
    // SIGN-IN: create the registry record, stamp its id into the token.
    token.role = user.role;
    token.sessionId = await registerLoginSession(user.id, account?.provider ?? null);
    return token;
  }
  // EVERY SUBSEQUENT READ: enforce revocation + record presence.
  if (typeof token.sessionId === "string") {
    const active = await touchLoginSession(token.sessionId);
    if (!active) return null;   // returning null KILLS the session
  }
  return token;
}
```

The registry service itself — `backend/src/auth/sessionRegistry.ts`, complete:

```ts
import { randomUUID } from "node:crypto";
import { LoginSessionModel } from "../models";
import { logger } from "../config/logger";
import { authRequestContext } from "./requestContext";

/** Matches Auth.js' default JWT session maxAge (30 days). */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** lastSeen writes are throttled per session so polling doesn't write per hit. */
const LAST_SEEN_UPDATE_MS = 5 * 60 * 1000;

const lastSeenWrites = new Map<string, number>();

const pruneThrottleMap = (): void => {
  if (lastSeenWrites.size < 10_000) return;
  const cutoff = Date.now() - LAST_SEEN_UPDATE_MS;
  for (const [sessionId, writtenAt] of lastSeenWrites) {
    if (writtenAt < cutoff) lastSeenWrites.delete(sessionId);
  }
};

export const registerLoginSession = async (userId: string, provider: string | null): Promise<string> => {
  const sessionId = randomUUID();
  const context = authRequestContext.getStore();
  await LoginSessionModel.create({
    sessionId,
    userId,
    provider,
    userAgent: context?.userAgent ?? null,
    ip: context?.ip ?? null,
    lastSeenAt: new Date(),
    expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
  });
  logger.info("auth: login session registered", { sessionId, userId, provider });
  return sessionId;
};

/**
 * Returns false when the session is revoked or its record is gone (expired /
 * purged) — the jwt callback then invalidates the token. Otherwise updates
 * lastSeenAt (throttled) and returns true.
 */
export const touchLoginSession = async (sessionId: string): Promise<boolean> => {
  const record = await LoginSessionModel.findOne({ sessionId });
  if (!record || record.revokedAt) return false;

  const lastWrite = lastSeenWrites.get(sessionId) ?? 0;
  if (Date.now() - lastWrite > LAST_SEEN_UPDATE_MS) {
    lastSeenWrites.set(sessionId, Date.now());
    pruneThrottleMap();
    await LoginSessionModel.updateOne({ sessionId }, { $set: { lastSeenAt: new Date() } });
  }
  return true;
};

/** Marks one session revoked; the token dies on its next read. */
export const revokeLoginSession = async (sessionId: string): Promise<boolean> => {
  const result = await LoginSessionModel.updateOne(
    { sessionId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  if (result.modifiedCount > 0) {
    logger.info("auth: login session revoked", { sessionId });
    return true;
  }
  return false;
};

/** Revokes every active session of a user (force sign-out everywhere). */
export const revokeAllUserSessions = async (userId: string): Promise<number> => {
  const result = await LoginSessionModel.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return result.modifiedCount;
};
```

Sign-out plugs into the same primitive — from `events` in `config.ts`:

```ts
signOut: async (message) => {
  const token = "token" in message ? message.token : null;
  logger.info("auth: signOut completed", { userId: token?.sub, email: token?.email });
  if (typeof token?.sessionId === "string") {
    await revokeLoginSession(token.sessionId);  // registry agrees with the browser
  }
},
```

One plumbing detail: Auth.js callbacks never see the Express `req`, but the
registry wants the device's user-agent/IP at sign-in. An `AsyncLocalStorage`
context, populated by a middleware wrapping `/api/auth`, carries the request
metadata down the async call chain into the callback without touching Auth.js'
API. Both halves, complete:

```ts
// backend/src/auth/requestContext.ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface AuthRequestContext {
  userAgent: string | null;
  ip: string | null;
}

export const authRequestContext = new AsyncLocalStorage<AuthRequestContext>();
```

```ts
// backend/src/app.ts — before the ExpressAuth mount
app.use("/api/auth", (req, _res, next) => {
  authRequestContext.run(
    { userAgent: (req.headers["user-agent"] as string | undefined) ?? null, ip: req.ip ?? null },
    next
  );
});
```

## 6.3 The management surface

Backend (`src/routes/session.routes.ts`, proxied via a `/api/sessions` rewrite
so cookies flow):

| Endpoint | Who | What |
|---|---|---|
| `GET /api/sessions/mine` | signed-in user | own active logins, `current` and `online` flags |
| `DELETE /api/sessions/mine/:id` | signed-in user | sign out one of *your own* devices (ownership-checked) |
| `GET /api/sessions` | ADMIN | every active login joined with user info |
| `DELETE /api/sessions/:id` | ADMIN | revoke any single login |
| `DELETE /api/sessions/user/:userId` | ADMIN | force sign-out everywhere |

"Online" is defined as `lastSeenAt` within 15 minutes — which works because
signed-in browsers poll `/api/auth/session`, so an open tab keeps refreshing its
presence for free. The frontend page (`app/(pages)/(general)/sessions/page.tsx`)
shows your devices to everyone and the full active-user list to admins; the
`session` callback exposes `sessionId` so the UI can mark "this device".

The two handlers juniors should study, from
`backend/src/routes/session.routes.ts`. First, the self-service revoke — note
the **ownership check**, the line that stops user A revoking user B's session
by guessing ids (the IDOR row in the §5.3 table):

```ts
/** DELETE /api/sessions/mine/:sessionId — sign out one of my own devices. */
router.delete("/mine/:sessionId", authenticatedUser, async (req, res, next) => {
  try {
    const session = res.locals.session as Session;
    const record = await LoginSessionModel.findOne({ sessionId: req.params.sessionId });
    // 404 (not 403) for "exists but isn't yours" — don't confirm the id exists
    if (!record || record.userId.toString() !== session.user!.id) {
      res.status(404).json({ success: false, message: "Session not found" });
      return;
    }
    await revokeLoginSession(record.sessionId);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
```

Second, the admin list — one query for sessions, one batched query for their
users (never a query per row):

```ts
/** GET /api/sessions — ADMIN: every active login, with user info attached. */
router.get("/", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const session = res.locals.session as Session;
    const records = await LoginSessionModel.find({ revokedAt: null, expiresAt: { $gt: new Date() } })
      .sort({ lastSeenAt: -1 })
      .limit(500);

    const userIds = [...new Set(records.map((record) => record.userId.toString()))];
    const users = await UserModel.find({ _id: { $in: userIds } });
    const usersById = new Map(users.map((user) => [user._id.toString(), user]));

    res.json({
      success: true,
      data: records.map((record) => ({
        ...toDto(record, session.sessionId),   // adds online + current flags
        user: usersById.get(record.userId.toString()) ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});
```

And the frontend consumption — the load + revoke logic from the sessions page
(markup elided). Everything goes through the `/api/sessions` rewrite, so the
browser's cookies ride along automatically:

```tsx
const { status, data } = useSession();
const isAdmin = data?.user?.role === "ADMIN";

const load = useCallback(async () => {
  const mine = await fetch("/api/sessions/mine").then((r) => (r.ok ? r.json() : null));
  setMySessions(mine?.data ?? []);
  if (isAdmin) {
    const all = await fetch("/api/sessions").then((r) => (r.ok ? r.json() : null));
    setAllSessions(all?.data ?? []);
  }
}, [isAdmin]);

useEffect(() => {
  if (status === "unauthenticated") router.replace("/login"); // §5.1 pattern
  if (status === "authenticated") void load();
}, [status, router, load]);

const revoke = async (session: SessionDto, adminScope: boolean) => {
  const path = adminScope
    ? `/api/sessions/${session.sessionId}`        // admin: any session
    : `/api/sessions/mine/${session.sessionId}`;  // self: ownership-checked
  const response = await fetch(path, { method: "DELETE" });
  if (!response.ok) {
    toast.error("Could not revoke that session");
    return;
  }
  // Revoked the login THIS browser is using? Finish the job locally too —
  // otherwise the UI sits on a corpse until the next session poll (§6.5).
  if (session.current) {
    await signOut({ callbackUrl: "/" });
    return;
  }
  void load(); // refresh the list
};
```

## 6.4 What the hybrid costs — read before copying

- **One registry read per session check.** The pure-JWT "no DB on reads"
  advantage is partly given back; that's the price of revocation. (An indexed
  `findOne` — negligible here, but real at scale; add caching if it hurts.)
- **Revocation latency = next session read.** A revoked device stays "in" until
  its next `/api/auth/session` poll or API call — seconds-to-minutes in
  practice, not instant.
- **Presence is approximate.** `lastSeenAt` is throttled and "online" is a
  15-minute window — this is "recently active", not a live socket.
- **The throttle map is per-process.** Run multiple backend instances and each
  keeps its own; worst case is an extra lastSeen write per instance — harmless,
  but know it's there.
- **Legacy tokens pass through.** Tokens minted before the registry have no
  `sessionId`; they're allowed (not killable) until their next sign-in. A
  strict deployment could instead return `null` for them and force one
  re-login.

So: does "online session" work with JWT? **Not natively — statelessness is the
whole deal of JWT. It works here because we deliberately gave sessions minimal
server-side state again.** If you ever drop the Credentials provider, compare
this hybrid against simply switching to the database strategy — at that point
the registry is most of a database session anyway.

## 6.5 Revocation, end to end: what actually happens, in code, on both sides

Walk one revocation through the whole system. Cast: an **admin** in browser A,
a **victim device** in browser B holding a valid session cookie.

```text
T0  Admin clicks "Revoke" ──► DELETE /api/sessions/<id> ──► registry write:
                                                            { revokedAt: now }
    ⚠ Browser B still holds a cryptographically VALID cookie. Nothing has
      happened to it. The session is dead only in the database.

T1  Browser B's next contact with the server — any of:
      · SessionProvider refetch (window refocus, tab switch, mount)
      · a server page render calling auth()
      · any backend API call through authenticatedUser/requireRole
    ──► getSession → jwt callback → touchLoginSession(sessionId)
    ──► record.revokedAt is set → returns false → jwt callback returns null

T2  Auth.js reacts to the null token:
      · GET /api/auth/session responds `null`
      · the response carries Set-Cookie that EXPIRES authjs.session-token —
        the browser deletes its now-useless cookie
      · protected backend routes respond 401
      · server pages see auth() → null and redirect to /login

T3  Browser B's UI reacts (§ below) — user is visibly signed out.
```

The window between T0 and T1 is the **revocation latency** from §6.4: the time
until the revoked device next talks to the server. An open, active tab closes
that gap in seconds (any API call or refocus triggers it); an idle background
tab catches up the moment it wakes.

**The server side of T1–T2 is exactly this code** (already shown in §6.2, but
read it again knowing what it's doing):

```ts
// config.ts — the jwt callback, on every session read:
if (typeof token.sessionId === "string") {
  const active = await touchLoginSession(token.sessionId); // finds revokedAt set
  if (!active) return null;   // ← THE revocation moment: null kills the session
}
```

Returning `null` from the `jwt` callback is Auth.js' documented invalidation
mechanism — Auth.js stops treating the request as authenticated and clears the
session cookie in its response. We verified it live in this project: after a
`DELETE /api/sessions/mine/<id>`, the *same cookie jar* got `null` from
`/api/auth/session` and 401 from `/api/sessions/mine` on the very next request.

**The client side of T3 — how each consumer reacts, with code:**

*Client components* — `useSession()` flips to `unauthenticated` on its next
refetch, and every component already branching on `status` reacts by itself.
That's the quiet payoff of the §5.1 pattern:

```tsx
// Navbar.tsx — nothing revocation-specific was ever written here:
{status === "authenticated" ? <UserMenu /> : <SignInButton />}
// sessions page — the standing redirect picks the user up:
useEffect(() => {
  if (status === "unauthenticated") router.replace("/login");
}, [status, router]);
```

By default `SessionProvider` refetches on window focus. If you want revocation
to land on idle tabs too, poll on an interval — one prop, no other changes:

```tsx
<SessionProvider refetchInterval={60} refetchOnWindowFocus>
  {children}
</SessionProvider>
```

*API calls* — a revoked device's next backend call gets `401`. Teach your fetch
layer one reflex and every feature inherits correct behavior:

```ts
// frontend — a minimal authenticated-fetch wrapper
export const apiFetch = async (input: string, init?: RequestInit): Promise<Response> => {
  const response = await fetch(input, init);
  if (response.status === 401) {
    // Session died mid-use (revoked, expired). Don't retry, don't show a
    // broken page — send the user through login and back.
    window.location.assign(`/login?from=${encodeURIComponent(window.location.pathname)}`);
  }
  return response;
};
```

*Server pages* — nothing new to write: `auth()` returns `null`, the §5.2 guard
redirects. Revocation, expiry, and "never logged in" all collapse into the same
already-handled case. That's the design win to point juniors at: **because
every consumer already handles `session === null`, revocation needed zero new
client code** — only the sessions page adds one nicety (calling `signOut()`
after revoking *its own* login, so the local cookie dies immediately instead of
at the next poll).

## 6.6 Every way a session ends — and what each one looks like

"What happens if the session is deleted or expires?" — all terminal states in
one table. "Registry" is the `login_sessions` record; "cookie" is
`authjs.session-token` in the browser.

| How it ends | Registry record | Cookie | What the user experiences |
|---|---|---|---|
| **User signs out** (`signOut()`) | `revokedAt` set via the `signOut` event | Deleted immediately by the signout response | Instant, chosen — lands on `/` |
| **Self-revoke another device** (sessions page) | `revokedAt` set | Dies on that device's next server contact (T1 above) | Other device signed out within moments |
| **Admin revokes one session** | `revokedAt` set | Same as above | Target device silently signed out at next contact |
| **Admin "sign out everywhere"** | All the user's records get `revokedAt` | Every device dies at its own next contact | User fully evicted, device by device |
| **JWT expires** (30 days default) | Untouched (TTL will purge it) | Auth.js refuses the expired token; cookie cleared on next read | "Logged out for no reason" after long absence — normal |
| **Registry record TTL-purged / deleted** | Gone | `touchLoginSession` returns `false` for the missing record → treated **exactly like revoked** | Signed out at next contact |
| **`AUTH_SECRET` changes** | Untouched but unreachable | Cookie can't be decrypted → `JWTSessionError`, treated as signed out | *Everyone* logged out at once (§1.3) |

Three details behind that table worth spelling out:

- **Expiry is sliding, so active users never hit it.** Auth.js refreshes the
  cookie's expiry as the session is read (default `updateAge` 24 h): each
  active day pushes the 30-day horizon forward. Only a device that stays away
  for 30 straight days expires. If that device returns on day 31, the JWT
  itself is rejected before any callback runs — same outcome as revocation,
  different bouncer.
- **Missing record = revoked is a deliberate fail-closed choice.** The registry
  TTL purges records at `expiresAt`, which mirrors the token's own lifetime —
  so in the normal case the cookie and the record die together. But if a
  record vanishes *early* (manual delete, TTL misconfiguration), the code
  treats absence as "not allowed" rather than "not tracked". When in doubt,
  a session system should say no.
- **One legacy exception:** tokens minted before the registry existed carry no
  `sessionId`, and the callback lets them through (backward compatibility,
  §6.4). They are immune to revocation but not to expiry or secret rotation,
  and each converts to a registered session at its next sign-in. Strict
  deployments can flip this to fail-closed by returning `null` for
  sessionId-less tokens — at the cost of one forced re-login for everyone.

---

# Part 7 — Advantages and disadvantages of this whole method

An honest scorecard of "backend-owned Auth.js behind a frontend proxy", from
living with it.

## 7.1 Advantages

- **One authentication authority.** The Express API validates sessions itself —
  no shared static tokens, no re-implementing auth per service. Anything added
  later (cron workers, a mobile gateway) checks the same cookie against the
  same config.
- **The browser never noticed.** URLs, cookies, and the OAuth redirect URIs are
  unchanged; `next-auth/react` client code is unchanged; the Google/GitHub
  consoles are unchanged. Migration risk was concentrated server-side where it
  could be tested with curl.
- **First-party, HttpOnly cookies.** No third-party-cookie breakage, no tokens
  in `localStorage` for XSS to steal, no `Authorization` header plumbing in the
  frontend.
- **Cheap session reads** (pure JWT mode): no DB hit per request — and even
  with the Part 6 registry, one indexed read.
- **Smaller frontend secret surface.** The Next.js deployment holds no auth
  secret and no OAuth credentials at all.
- **Framework mobility.** The frontend is now just *an* Auth.js client. It
  could be rebuilt in another framework — or joined by a second client — without
  touching authentication.
- **Providers compose.** Google + GitHub + Credentials went through one
  pipeline; adding the next provider is ~20 lines (Step 7).

## 7.2 Disadvantages

- **Two moving parts, always.** Dev needs both servers running, deploys are
  coordinated, and the failure mode of a dead backend is *silent* ("everyone
  looks signed out") — that's why Step 13's logging isn't optional.
- **The proxy is load-bearing and subtle.** Every auth request takes an extra
  hop, and correctness depends on proxy behaviors (Host headers, forwarded
  cookies) that differ between dev and production — the worst bugs are the
  deploy-only ones (the Step 8 Host shim).
- **JWT trade-offs are real** (§1.2, Part 6): no native revocation (fixed only
  by re-adding state), role changes lag until re-login, stolen cookies outlive
  sign-out in pure mode.
- **More conceptual surface.** Debugging now demands understanding two
  processes, a rewrite rule, cookie scoping, and Auth.js internals — a vanilla
  single-app NextAuth setup is genuinely simpler while it suffices.
- **Environment constraints.** ESM-only Auth.js from a CJS backend pins Node ≥
  20.19 and shapes the TypeScript config (Step 3).
- **Session polling load lands on the backend.** Every open tab polls
  `/api/auth/session`; without the split rate limiter (Step 8) your own
  polling DoSes your API budget.
- **Secret discipline is unforgiving.** One `AUTH_SECRET` mismatch silently
  logs out every user (§1.3) — env hygiene became a production concern.

## 7.3 When to choose it — and when not to

Choose this architecture when a **separate backend must trust sessions** (that
was the trigger here), when multiple clients/services will share one auth
authority, or when auth logic needs to live outside the frontend's deploy cycle.

Stay with plain NextAuth-in-Next.js when the Next.js app is the only consumer of
authentication — the proxy buys you nothing there, and you pay its complexity
anyway. And if you need *instant* revocation or rich device management as a
core feature (banking-grade), prefer the database session strategy over the
Part 6 hybrid — dropping the Credentials provider if that's what it takes.

---

# Part 8 — Symptom → cause cheat sheet

Every entry below was hit for real during this migration.

| Symptom | Cause | Fix |
|---|---|---|
| *Everything* auth silently broken; `useSession` always unauthenticated | Backend not running — the frontend fails soft to "signed out" by design | Check the backend port is listening; `curl <frontend>/api/auth/providers` |
| `JWTSessionError` in backend logs | Cookie minted with a different `AUTH_SECRET` than the server holds | Restore the original secret. Audit `.env` for duplicate keys — dotenv lets the last one win, silently |
| `MissingCSRF` | A POST skipped the CSRF handshake | Use the client helpers; in curl, fetch `/csrf` first and replay the cookie jar |
| `CredentialsSignin` | Someone typed a wrong email/password. Normal | Nothing — but log it as a warning, not an error with a stack trace |
| `UntrustedHost` | Auth.js got a Host it wasn't told to trust | `trustHost: true`, `trust proxy`, correct `AUTH_URL` |
| Google `redirect_uri_mismatch` | Generated callback URL ≠ what's registered in Google console | `AUTH_URL` must be the **frontend** origin + `/api/auth`; the console entry never changes |
| Works locally, breaks deployed | Proxy rewrote the `Host` header (Vercel does) | The `X-Forwarded-Host → Host` shim from Step 8 |
| Build fails on pages using `auth()` | `headers()` moved inside a try/catch, swallowing Next's dynamic-route marker | Keep `headers()` outside the try/catch (Step 11) |
| Users randomly logged out under load | Session polling ate the shared rate-limit budget | Separate, generous limiter for `/api/auth` (Step 8) |
| Server crashes on startup loading `@auth/express` | Node < 20.19 can't `require()` ESM | Upgrade Node; keep `tsx` as the dev runner |

---

# Part 9 — The mental model to keep

If you remember nothing else, remember these three chains of causes:

> **Cookies must be first-party** → so the frontend **proxies** `/api/auth/*` →
> so paths, cookies, and the Google redirect URI **never change** → so the client
> code and Google console **stay untouched**.
>
> **Credentials provider** → forces the **JWT strategy** → so sessions live in an
> **encrypted cookie** → so the **secret must survive the migration** and role
> changes wait for the next sign-in.
>
> **Same database, byte-compatible schema** → so existing users, Google links,
> and business relations **carry over** with no re-registration.
>
> **JWT is stateless** → so listing/revoking logins needs **state added back**
> (the session registry) → so every session read pays **one registry lookup**
> in exchange for "sign this device out" actually working.

Everything else — the shim, the limiter split, the `select: false` password, the
soft-failing `auth()`, the logging — exists to serve one of those three chains.

*Companion reference: [13-request-flow-walkthrough.md](13-request-flow-walkthrough.md)
maps each flow to the exact log lines this project emits, so you can verify every
step live. Docs 01–12 in this folder record the original migration's decisions in
depth.*
