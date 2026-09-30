"use client";

import { type FC, type FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUTTON_OUTLINE, BUTTON_SOLID, INPUT, SettingsRow } from "@/app/components/dashboard/settings/settings-ui";
import { evaluatePassword } from "@/app/lib/auth/password-strength";
import { useChangePassword } from "@/hooks/mutations/useAccountMutations";

/**
 * Changing a password you already know.
 *
 * Folded away until asked for: three password fields permanently open on a settings page is a lot of
 * furniture for something most people do once. The session doing the changing survives it, and every
 * other one does not — which the form says before it is submitted rather than after.
 */
const ChangePassword: FC = () => {
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

  const strength = evaluatePassword(password);
  const matches = confirm.length > 0 && confirm === password;
  const canSubmit = Boolean(currentPassword) && strength.meetsRequirements && matches && !change.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    change.mutate({ currentPassword, password });
  };

  if (!open) {
    return (
      <SettingsRow label="Password" hint="Changing it signs out every other device.">
        <button className={BUTTON_OUTLINE} onClick={() => setOpen(true)} type="button">
          <KeyRound className="h-3.5 w-3.5" />
          Change password
        </button>
      </SettingsRow>
    );
  }

  return (
    <SettingsRow label="Password" hint="Changing it signs out every other device." stacked htmlFor="s-current">
      <form className="space-y-3" onSubmit={submit}>
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
            Confirm new password
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
            {change.isPending ? "Changing…" : "Change password"}
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
