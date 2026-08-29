"use client";

import { FC, useState } from "react";
import { AlertTriangle, Check, LogOut, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSettings } from "../SettingsProvider";
import { BUTTON_DANGER, BUTTON_OUTLINE, BUTTON_SOLID, INPUT, SettingsRow, SettingsSection } from "@/app/components/dashboard/settings/settings-ui";

const CONFIRM_WORD = "DELETE";

const AccountClient: FC = () => {
  const { profile, setProfile } = useSettings();
  const [confirm, setConfirm] = useState("");

  return (
    <>
      <SettingsSection title="Sign-in" description="How you get into Remote Worldwide.">
        <SettingsRow label="Email" hint="Used for sign-in and every notification." stacked htmlFor="a-email">
          <div className="flex flex-wrap gap-2">
            <input
              id="a-email"
              type="email"
              className={cn(INPUT, "flex-1 min-w-[220px]")}
              value={profile.email}
              onChange={(e) => setProfile({ email: e.target.value })}
            />
            <button
              type="button"
              className={BUTTON_SOLID}
              onClick={() => toast.success("Verification sent", { description: "Mock only — no email actually goes out." })}>
              <Check className="h-3.5 w-3.5" />
              Verify
            </button>
          </div>
        </SettingsRow>

        <SettingsRow label="Phone" hint="Optional. Only used for interview reminders." stacked htmlFor="a-phone">
          <input id="a-phone" className={INPUT} value={profile.phone} onChange={(e) => setProfile({ phone: e.target.value })} />
        </SettingsRow>

        <SettingsRow label="Password" hint="Last changed 3 months ago.">
          <button type="button" className={BUTTON_OUTLINE} onClick={() => toast("Password changes aren't wired up in this build.")}>
            Change password
          </button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Connected accounts" description="Sign in faster and keep your profile in sync.">
        <SettingsRow label="Google" hint={`Connected as ${profile.email}`}>
          <button type="button" className={BUTTON_OUTLINE} onClick={() => toast("Disconnecting isn't wired up in this build.")}>
            <Mail className="h-3.5 w-3.5" />
            Disconnect
          </button>
        </SettingsRow>
        <SettingsRow label="LinkedIn" hint="Not connected. Connecting imports your work history.">
          <button type="button" className={BUTTON_OUTLINE} onClick={() => toast("Connecting isn't wired up in this build.")}>
            Connect
          </button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Session">
        <SettingsRow label="Sign out" hint="Ends this session on this device only.">
          <button type="button" className={BUTTON_OUTLINE} onClick={() => toast("Sign-out isn't wired up from this screen.")}>
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        danger
        title="Delete your account"
        description="Removes your profile, applications, saved answers and resumes. This can't be undone.">
        <div className="mb-3.5 flex gap-2.5 rounded-xl border border-[#c0392b]/25 bg-[#fdeae6] px-3.5 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-[#b23c26]" />
          <p className="text-xs leading-relaxed text-[#8f3120]">
            Your pod loses your history, and any referral introductions in flight are withdrawn. Export your data first if you
            want to keep it.
          </p>
        </div>

        <label htmlFor="a-confirm" className="mb-1.5 block text-xs font-semibold text-black/60">
          Type <b className="font-bold text-[#b23c26]">{CONFIRM_WORD}</b> to confirm
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="a-confirm"
            className={cn(INPUT, "flex-1 min-w-[180px]")}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
          />
          <button
            type="button"
            disabled={confirm !== CONFIRM_WORD}
            onClick={() => toast.error("Account deletion isn't wired up in this build.")}
            className={cn(BUTTON_DANGER, "disabled:opacity-40 disabled:pointer-events-none")}>
            Delete my account
          </button>
        </div>
      </SettingsSection>
    </>
  );
};

export default AccountClient;
