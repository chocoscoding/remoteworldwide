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

const DATE_FORMAT_OPTIONS: LabeledSelectOption<DateFormatId>[] = [
  { id: "mm-yyyy", label: "MM/YYYY" },
  { id: "month-yyyy", label: "Month YYYY" },
  { id: "mm-dd-yyyy", label: "MM/DD/YYYY" },
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
