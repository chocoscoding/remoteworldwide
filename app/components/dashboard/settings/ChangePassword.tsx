"use client";

import { type FC, type FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUTTON_OUTLINE, BUTTON_SOLID, INPUT, SettingsRow } from "@/app/components/dashboard/settings/settings-ui";
import { evaluatePassword } from "@/app/lib/auth/password-strength";
import { useChangePassword, useSetPassword } from "@/hooks/mutations/useAccountMutations";

/**
 * Changing a password you already know, or setting the first one.
 *
 * Folded away until asked for: three password fields permanently open on a settings page is a lot of
 * furniture for something most people do once. The session doing the changing survives it, and every
 * other one does not — which the form says before it is submitted rather than after.
 *
 * An account that signed up with Google or GitHub has no password (`hasPassword` false, from the
 * sign-in methods), so it is offered "Set password" with no current-password field. Until the sign-in
 * methods have loaded (`hasPassword` undefined) no button shows, rather than the wrong one.
 */
const ChangePassword: FC<{ hasPassword?: boolean }> = ({ hasPassword }) => {
  const setting = hasPassword === false;
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const close = () => {
    setOpen(false);
    setCurrentPassword("");
    setPassword("");
    setConfirm("");
  };

  const change = useChangePassword(close);
  const set = useSetPassword(close);
  const pending = change.isPending || set.isPending;

  const strength = evaluatePassword(password);
  const matches = confirm.length > 0 && confirm === password;
  const canSubmit = (setting || Boolean(currentPassword)) && strength.meetsRequirements && matches && !pending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    if (setting) set.mutate({ password });
    else change.mutate({ currentPassword, password });
  };

  const hint = setting ? "Add one to sign in with your email too." : "Changing it signs out every other device.";
  const action = setting ? "Set password" : "Change password";

  if (!open) {
    return (
      <SettingsRow label="Password" hint={hasPassword === undefined ? undefined : hint}>
        {hasPassword !== undefined && (
          <button className={BUTTON_OUTLINE} onClick={() => setOpen(true)} type="button">
            <KeyRound className="h-3.5 w-3.5" />
            {action}
          </button>
        )}
      </SettingsRow>
    );
  }

  return (
    <SettingsRow label="Password" hint={hint} stacked htmlFor={setting ? "s-new" : "s-current"}>
      <form className="space-y-3" onSubmit={submit}>
        {!setting && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-black/60" htmlFor="s-current">
              Current password
            </label>
            <input
              autoComplete="current-password"
              className={INPUT}
              id="s-current"
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              value={currentPassword}
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-black/60" htmlFor="s-new">
            New password
          </label>
          <input
            autoComplete="new-password"
            className={INPUT}
            id="s-new"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          {password.length > 0 && !strength.meetsRequirements ? (
            <p className="mt-1.5 text-xs text-black/50">At least 8 characters, with a mix of letters and numbers.</p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-black/60" htmlFor="s-confirm">
            {setting ? "Confirm password" : "Confirm new password"}
          </label>
          <input
            autoComplete="new-password"
            className={INPUT}
            id="s-confirm"
            onChange={(event) => setConfirm(event.target.value)}
            type="password"
            value={confirm}
          />
          {confirm.length > 0 && !matches ? <p className="mt-1.5 text-xs text-[#b23c26]">Those do not match.</p> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <button className={cn(BUTTON_SOLID, "disabled:opacity-40")} disabled={!canSubmit} type="submit">
            {pending ? (setting ? "Setting…" : "Changing…") : action}
          </button>
          <button className={BUTTON_OUTLINE} onClick={close} type="button">
            Cancel
          </button>
        </div>
      </form>
    </SettingsRow>
  );
};

export default ChangePassword;
