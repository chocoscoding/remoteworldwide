// What to say when a credentials sign-in is refused.
//
// Auth.js answers every refusal with the same `error` ("CredentialsSignin") and puts the reason in
// `code`. The backend sets exactly one: an account created through Google or GitHub, which has no
// password to compare. Telling that person to press the button above is the difference between
// signing in and retyping a password that never existed.
//
// Every other refusal shares one message on purpose. A separate "no account with that email" would
// turn the login form into a way to ask us who has an account, which is the same reason
// /users/password/forgot answers identically whether or not the address is known.

const PROVIDER_NAMES: Record<string, string> = {
  oauth_google: "Google",
  oauth_github: "GitHub",
};

/** The one answer for a wrong password, an unknown address, and anything unrecognised. */
export const WRONG_CREDENTIALS = "Wrong email or password";

export const signInErrorMessage = (code: string | undefined): string => {
  if (!code) return WRONG_CREDENTIALS;

  const provider = PROVIDER_NAMES[code];
  if (provider) return `This account signs in with ${provider} — use the ${provider} button above`;

  // Both linked, which the code cannot name individually.
  if (code === "oauth") return "This account signs in with Google or GitHub — use the buttons above";

  return WRONG_CREDENTIALS;
};
