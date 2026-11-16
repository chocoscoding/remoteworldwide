"use client";

import { useState, type FC } from "react";
import type { MailAction } from "@/app/lib/mail/types";
import { BTN } from "@/app/components/mail/ui";
import TriggersDrawer from "@/app/components/mail/playbook/TriggersDrawer";

/**
 * The "Triggers (n)" button on the playbooks list: the actions playbooks can trigger on, in a
 * drawer (built-in ones read only; custom ones added, edited and archived there).
 */
const ActionsPanel: FC<{ actions: MailAction[]; error?: string | null; usage?: Record<string, number> }> = ({ actions, error, usage }) => {
  const [open, setOpen] = useState(false);
  const count = actions.filter((a) => !a.archived).length;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={BTN}
        aria-haspopup="dialog"
        title={error ? `The triggers couldn't be loaded: ${error}` : "What people do on the site, as triggers"}>
        Triggers{error ? " (not loaded)" : ` (${count})`}
      </button>
      <TriggersDrawer open={open} onOpenChange={setOpen} actions={actions} usage={usage} error={error} />
    </>
  );
};

export default ActionsPanel;
