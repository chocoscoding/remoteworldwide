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
      /**
       * Whether the address has been proven. Named apart from `emailVerified`, which Auth.js
       * already defines as a Date — the only question asked here is whether to open the dashboard.
       */
      verified?: boolean;
      /**
       * ISO date a scheduled account deletion falls due, or null. Set, the account is locked: the
       * dashboard layout sends it to /account-deletion and the API answers 423 everywhere else.
       */
      deletionDueAt?: string | null;
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
// declare module "next-auth/react";
