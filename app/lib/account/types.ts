// The account's own endpoints, mirroring remoteworldwidebackend/src/types/account.ts. Change both
// together: /api/account/sign-in, /api/account/export and /api/account/deletion.

export const OAUTH_PROVIDER_IDS = ["google", "github"] as const;
export type OAuthProviderId = (typeof OAUTH_PROVIDER_IDS)[number];

export interface SignInProvider {
  id: OAuthProviderId;
  /** "Google", "GitHub". */
  name: string;
  connected: boolean;
  /** ISO, or null when it is not connected. */
  connectedAt: string | null;
}

export interface SignInMethods {
  /** The address the account signs in with. Null for a GitHub account with no public email. */
  email: string | null;
  hasPassword: boolean;
  /** Only the providers this deployment has configured; GitHub is optional. */
  providers: SignInProvider[];
}

export interface AccountDeletionStatus {
  /** ISO. When the deletion was asked for. */
  scheduledAt: string;
  /** ISO. When everything goes; until then the account is locked and can be restored. */
  dueAt: string;
}

/** What the confirmation field must say when the account has no address of its own. */
export const DELETE_CONFIRM_FALLBACK = "DELETE";

/** "22 September 2026" — the same wording the backend and the mail use. */
export const deletionDate = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(iso));
