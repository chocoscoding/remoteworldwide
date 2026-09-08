"use client";

import { FC } from "react";
import { Check } from "lucide-react";
import { useSettings, type SettingsSection as Section } from "@/app/(pages)/(dashboard)/dashboard/settings/SettingsProvider";
import { BUTTON_SOLID } from "./settings-ui";

const SectionSave: FC<{ section: Section }> = ({ section }) => {
  const { save, saving, dirtySections } = useSettings();

  return (
    <button type="button" onClick={() => save(section)} disabled={saving || !dirtySections[section]} className={BUTTON_SOLID}>
      <Check className="h-3.5 w-3.5" />
      {saving ? "Saving…" : dirtySections[section] ? "Save" : "Saved"}
    </button>
  );
};

export default SectionSave;
