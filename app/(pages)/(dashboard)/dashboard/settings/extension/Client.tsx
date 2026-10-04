"use client";

import { FC } from "react";
import { Check, Chrome, ExternalLink, Loader2, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAnswers } from "@/app/components/dashboard/answers/AnswersProvider";
import { EXTENSION_TOGGLES } from "@/app/components/dashboard/questions/ExtensionDialog";
import { EXTENSION_URL } from "@/app/lib/extension/presence";
import { BUTTON_OUTLINE, BUTTON_SOLID, SettingsRow, SettingsSection, Toggle } from "@/app/components/dashboard/settings/settings-ui";

/** What the status line says, in the one state this browser's handshake is in. */
function statusCopy(status: "checking" | "installed" | "absent" | undefined, version: string | null): { title: string; body: string } {
  if (status === "installed") {
    return {
      title: version ? `Installed · v${version}` : "Installed",
      body: "It's in this browser and follows the choices below on every form it fills.",
    };
  }
  if (status === "absent") return { title: "Not in this browser", body: "Add it to Chrome, then refresh this page." };
  return { title: "Checking…", body: "Looking for the extension in this browser." };
}

/**
 * The extension's home in settings: whether this browser has it, the way to
 * get it, and the same switches the Application answers dialog shows. They
 * save to the account as they flip, so they hold in every browser it's added to.
 */
const ExtensionClient: FC = () => {
  const { extension, extensionSaving, setExtension } = useAnswers();
  const installed = extension.status === "installed";
  const status = statusCopy(extension.status, extension.version ?? null);

  return (
    <>
      <SettingsSection
        title="Browser extension"
        description="Fills applications on company sites from your profile and saved answers, and only when you press its button.">
        {/* Lime and solid only once the extension has answered this browser;
            dashed and unfilled otherwise, the app's "not there yet" look. */}
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 rounded-xl border-[1.5px] px-4 py-3",
            installed ? "border-[#222325] bg-[#f6fbe3]" : "border-dashed border-black/20 bg-[#fbfbf7]",
          )}>
          <span
            className={cn(
              "grid h-9 w-9 flex-none place-content-center rounded-lg border",
              installed ? "border-[#222325]/15 bg-[#e1f073]" : "border-black/10 bg-white",
            )}>
            <PlugZap className={cn("h-4 w-4", installed ? "text-[#222325]" : "text-black/40")} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-primary">{status.title}</p>
            <p className="text-xs text-black/50">{status.body}</p>
          </div>
          {extension.status === "absent" && (
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" className={BUTTON_SOLID}>
              <Chrome className="h-3.5 w-3.5" />
              Add to Chrome
              <span className="sr-only"> (opens the Chrome Web Store in a new tab)</span>
            </a>
          )}
          {installed && (
            <a href={EXTENSION_URL} target="_blank" rel="noopener noreferrer" className={BUTTON_OUTLINE}>
              Chrome Web Store
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title="How it fills"
        description="Saved to your account, so the extension follows them in any browser you add it to."
        action={
          <span className="inline-flex items-center gap-1.5 text-xs text-black/50" aria-live="polite">
            {extensionSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-black/40" />
            ) : (
              <Check className="h-3.5 w-3.5 text-[#6c7a1e]" />
            )}
            {extensionSaving ? "Saving…" : "Saved"}
          </span>
        }>
        {EXTENSION_TOGGLES.map((t) => (
          <SettingsRow key={t.key} label={t.label} hint={t.hint}>
            <Toggle checked={extension[t.key]} onChange={(on) => setExtension({ [t.key]: on })} label={t.label} />
          </SettingsRow>
        ))}
      </SettingsSection>
    </>
  );
};

export default ExtensionClient;
