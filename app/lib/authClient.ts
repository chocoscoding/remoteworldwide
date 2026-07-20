"use client";
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react";

/**
 * Drop-in replacements for next-auth/react's signIn/signOut that log each
 * step of the flow to the browser console (prefix "[auth]"), so client-side
 * auth activity is visible alongside the backend's winston logs.
 *
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
