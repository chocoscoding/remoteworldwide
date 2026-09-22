"use client";

import { FC, JSX, useState } from "react";
import { AlertTriangle, BadgeCheck, LoaderCircle, LogOut, Send, Unlink } from "lucide-react";
import { signIn, signOut } from "@/app/lib/authClient";
import { cn } from "@/lib/utils";
import { useSettings } from "../SettingsProvider";
import ChangePassword from "@/app/components/dashboard/settings/ChangePassword";
import { GitHubIcon, GoogleIcon } from "@/app/components/auth/AuthIcons";
import { useDisconnectProvider, useResendVerification, useScheduleDeletion } from "@/hooks/mutations/useAccountMutations";
import { useSignInMethods } from "@/hooks/queries/useAccountQueries";
import { DELETE_CONFIRM_FALLBACK, type OAuthProviderId } from "@/app/lib/account/types";
import { BUTTON_DANGER, BUTTON_OUTLINE, BUTTON_SOLID, INPUT, SettingsRow, SettingsSection } from "@/app/components/dashboard/settings/settings-ui";

const PROVIDER_ICON: Record<OAuthProviderId, (props: { className?: string }) => JSX.Element> = { google: GoogleIcon, github: GitHubIcon };

const AccountClient: FC<{ verified: boolean; accountEmail: string | null }> = ({ verified, accountEmail }) => {
  const { profile, setProfile } = useSettings();
  const [confirm, setConfirm] = useState("");
  const resend = useResendVerification();

  const signInMethods = useSignInMethods();
  const disconnect = useDisconnectProvider();
  // Every session goes when a deletion is scheduled, this one included, so the browser signs out
  // rather than sitting on a page where nothing works.
  const schedule = useScheduleDeletion(() => void signOut({ callbackUrl: "/" }));

  const methods = signInMethods.data;
  // What the account actually signs in with, which is not necessarily the address on the profile
  // tab — that one is for employers to reach them on.
  const expected = (accountEmail ?? methods?.email ?? DELETE_CONFIRM_FALLBACK).trim();
  const canDelete = confirm.trim().toLowerCase() === expected.toLowerCase() && !schedule.isPending;

  /**
   * Connecting is Auth.js's own OAuth flow, started while signed in: with JWT sessions the callback
   * links the provider account to the session's user, so it comes back here with the account
   * connected. It is a redirect, not a request, which is why there is no mutation behind it.
   */
  const connect = (provider: OAuthProviderId) => signIn(provider, { callbackUrl: "/dashboard/settings/account" });

  return (
    <>
      <SettingsSection title="Sign-in" description="How you get into Remote Worldwide.">
        <SettingsRow
          label="Email"
          hint={verified ? "Confirmed. Used for sign-in and every notification." : "Not confirmed yet — check your inbox for the link."}
          stacked
          htmlFor="a-email">
          <div className="flex flex-wrap gap-2">
            <input
              id="a-email"
              type="email"
              className={cn(INPUT, "flex-1 min-w-[220px]")}
              value={profile.email}
              onChange={(e) => setProfile({ email: e.target.value })}
            />
            {verified ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#f0f0ea] px-3 py-2 text-xs font-bold text-[#6c7a1e]">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </span>
            ) : (
              <button className={BUTTON_SOLID} disabled={resend.isPending} onClick={() => resend.mutate()} type="button">
                <Send className="h-3.5 w-3.5" />
                {resend.isPending ? "Sending…" : "Resend link"}
              </button>
            )}
          </div>
        </SettingsRow>

        <SettingsRow label="Phone" hint="Optional. Only used for interview reminders." stacked htmlFor="a-phone">
          <input id="a-phone" className={INPUT} value={profile.phone} onChange={(e) => setProfile({ phone: e.target.value })} />
        </SettingsRow>

        <ChangePassword />
      </SettingsSection>

      <SettingsSection
        title="Connected accounts"
        description="Sign in with one click. Connecting doesn't change the address your account uses, so a Google or GitHub account on a different email is fine.">
        {signInMethods.isPending && (
          <p className="flex items-center gap-2 py-2 text-xs text-black/50">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </p>
        )}
        {signInMethods.isError && <p className="py-2 text-xs text-[#b23c26]">We couldn&apos;t load your sign-in methods. Reload the page to try again.</p>}

        {methods?.providers.map((provider) => {
          const Icon = PROVIDER_ICON[provider.id];
          // Refusing here as well as on the server, so the one way back in is never a click away
          // from being removed: the server's message says the same thing if this is ever wrong.
          const onlyWayIn =
            provider.connected && !methods.hasPassword && methods.providers.filter((row) => row.connected).length === 1;

          return (
            <SettingsRow
              key={provider.id}
              label={provider.name}
              hint={
                provider.connected
                  ? onlyWayIn
                    ? "Connected. This is the only way you sign in — connect another before removing it."
                    : "Connected."
                  : `Not connected. You'll be sent to ${provider.name} and back.`
              }>
              {provider.connected ? (
                <button
                  type="button"
                  className={BUTTON_OUTLINE}
                  disabled={onlyWayIn || disconnect.isPending}
                  onClick={() => disconnect.mutate(provider.id)}>
                  <Unlink className="h-3.5 w-3.5" />
                  {disconnect.isPending && disconnect.variables === provider.id ? "Disconnecting…" : "Disconnect"}
                </button>
              ) : (
                <button type="button" className={BUTTON_OUTLINE} onClick={() => connect(provider.id)}>
                  <Icon className="h-3.5 w-3.5" />
                  Connect
                </button>
              )}
            </SettingsRow>
          );
        })}

        {methods && methods.providers.length === 0 && (
          <p className="py-2 text-xs text-black/50">No sign-in providers are set up on this deployment.</p>
        )}
      </SettingsSection>

      <SettingsSection title="Session">
        <SettingsRow label="Sign out" hint="Ends this session on this device only.">
          <button type="button" className={BUTTON_OUTLINE} onClick={() => signOut({ callbackUrl: "/" })}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        danger
        title="Delete your account"
        description="Your profile, applications, saved answers, documents and resumes. You have seven days to change your mind.">
        <div className="mb-3.5 flex gap-2.5 rounded-xl border border-[#c0392b]/25 bg-[#fdeae6] px-3.5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-[#b23c26]" />
          <p className="text-xs leading-relaxed text-[#8f3120]">
            Your account is locked straight away and every device is signed out. Nothing is deleted for seven days — sign in
            before then and choose <b className="font-bold">Cancel deletion</b> to keep it. After that it goes for good: your
            pod loses your history, referral introductions in flight are withdrawn, and unused credits are forfeited. Export
            your data first if you want to keep it.
          </p>
        </div>

        <label htmlFor="a-confirm" className="mb-1.5 block text-xs font-semibold text-black/60">
          Type <b className="font-bold text-[#b23c26]">{expected}</b> to confirm
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="a-confirm"
            className={cn(INPUT, "flex-1 min-w-[180px]")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={expected}
            autoComplete="off"
          />
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => schedule.mutate(confirm.trim())}
            className={cn(BUTTON_DANGER, "disabled:opacity-40 disabled:pointer-events-none")}>
            {schedule.isPending ? "Scheduling…" : "Delete my account"}
          </button>
        </div>
      </SettingsSection>
    </>
  );
};

export default AccountClient;
