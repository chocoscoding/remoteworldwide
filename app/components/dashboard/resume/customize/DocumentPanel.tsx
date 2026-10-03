"use client";

import type { FC } from "react";
import { LabeledSelect, SegmentedControl, type LabeledSelectOption, type SegmentedControlOption } from "../controls";
import { useResumeDesign } from "../useResumeDesign";
import type { DateFormatId, PageFormat } from "@/app/lib/dashboard/resume/design-types";

/** A compact, common-locale list — not exhaustive, just enough to be real. */
const LANGUAGE_OPTIONS: LabeledSelectOption<string>[] = [
  { id: "en-us", label: "English (US)" },
  { id: "en-gb", label: "English (UK)" },
  { id: "es-es", label: "Spanish" },
  { id: "fr-fr", label: "French" },
  { id: "de-de", label: "German" },
  { id: "pt-br", label: "Portuguese (Brazil)" },
  { id: "it-it", label: "Italian" },
  { id: "nl-nl", label: "Dutch" },
];

/** Each shown as an example, so the choice reads as what the page will print. Entries are stored one way ("Jan 2024"); this only changes how they print. */
const DATE_FORMAT_OPTIONS: LabeledSelectOption<DateFormatId>[] = [
  { id: "short", label: "Jan 2024" },
  { id: "long", label: "January 2024" },
  { id: "numeric", label: "01/2024" },
];

const PAGE_FORMAT_OPTIONS: SegmentedControlOption<PageFormat>[] = [
  { id: "a4", label: "A4" },
  { id: "letter", label: "Letter" },
];

const DocumentPanel: FC = () => {
  const { design, dispatch } = useResumeDesign();

  return (
    <div className="flex flex-col gap-5">
      <LabeledSelect
        label="Language"
        orientation="stacked"
        options={LANGUAGE_OPTIONS}
        value={design.doc.language}
        onChange={(value) => dispatch({ type: "doc/setLanguage", value })}
      />
      <LabeledSelect
        label="Date format"
        orientation="stacked"
        options={DATE_FORMAT_OPTIONS}
        value={design.doc.dateFormat}
        onChange={(id) => dispatch({ type: "doc/setDateFormat", id })}
      />
      <SegmentedControl
        label="Page format"
        options={PAGE_FORMAT_OPTIONS}
        value={design.doc.pageFormat}
        onChange={(format) => dispatch({ type: "doc/setPageFormat", format })}
      />
    </div>
  );
};

export default DocumentPanel;
