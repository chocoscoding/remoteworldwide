"use client";

// "Cookie settings" for a server-rendered footer: reopens the consent dialog from anywhere.

import type { FC } from "react";
import { openConsentSettings } from "@/app/lib/consent/consent";

const CookieSettingsButton: FC<{ className?: string }> = ({ className }) => (
  <button type="button" onClick={openConsentSettings} className={className}>
    Cookie settings
  </button>
);

export default CookieSettingsButton;
