// The 7 header contact-icon sets.
//
// Same class-lookup-map convention as heading-styles: a closed enum resolves to
// a record, so HeaderBlock has one code path (`ICON_SETS[design.header.iconSet]
// .mail`) instead of a seven-branch switch.
//
// This is the one module under app/lib/dashboard that imports values from
// lucide-react rather than types. It stores component REFERENCES only — there
// is no JSX, no hook and no component definition here, so the folder's
// React-free rule still holds in spirit: nothing renders until a component
// under app/components puts one of these in a tree.
//
// lucide ships a single outline weight, so the sets are differentiated by
// choosing structurally different glyphs (envelope vs at-sign vs inbox, pin vs
// map vs compass-needle) rather than by stroke style. The names are the panel's
// labels; they describe the resulting silhouette, not a lucide variant.

import {
  AtSign,
  Building2,
  Compass,
  Contact,
  ExternalLink,
  Globe,
  Home,
  Inbox,
  Link,
  Link2,
  Mail,
  MailOpen,
  Map,
  MapPin,
  MapPinned,
  Navigation,
  Phone,
  PhoneCall,
  Send,
  Smartphone,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { IconSetId } from "./design-types";

export interface IconSet {
  mail: LucideIcon;
  phone: LucideIcon;
  pin: LucideIcon;
  link: LucideIcon;
}

export const ICON_SETS: Record<IconSetId, IconSet> = {
  line: { mail: Mail, phone: Phone, pin: MapPin, link: Link2 },
  solid: { mail: Inbox, phone: Smartphone, pin: MapPinned, link: Globe },
  rounded: { mail: MailOpen, phone: PhoneCall, pin: Map, link: Link },
  square: { mail: Contact, phone: Phone, pin: Building2, link: ExternalLink },
  circle: { mail: AtSign, phone: PhoneCall, pin: Compass, link: Globe },
  mono: { mail: Mail, phone: Smartphone, pin: Home, link: Link },
  duotone: { mail: Send, phone: PhoneCall, pin: Navigation, link: ExternalLink },
};

export interface IconSetOption {
  id: IconSetId;
  label: string;
}

/** Order of the 7 swatches in the Header panel's Icon Style row. */
export const ICON_SET_OPTIONS: IconSetOption[] = [
  { id: "line", label: "Line" },
  { id: "solid", label: "Solid" },
  { id: "rounded", label: "Rounded" },
  { id: "square", label: "Square" },
  { id: "circle", label: "Circle" },
  { id: "mono", label: "Mono" },
  { id: "duotone", label: "Duotone" },
];
