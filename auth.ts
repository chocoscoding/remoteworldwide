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
  pages: {
    //:TODO #1
    signOut: "/",
  },
});
