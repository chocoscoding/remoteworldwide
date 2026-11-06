"use client";

// The users screen's Export dialog: CSV or TXT, which columns, and whether the first line names
// them. The rows come from the export server action (libs/analytics-admin.ts); the file is built
// and downloaded here, in the browser (app/lib/tracking/export.ts). The last choices are kept in
// localStorage, so the next export starts from them.

import { useState, useTransition, type FC, type RefObject } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, LoaderCircle, X } from "lucide-react";
import { exportUsers } from "@/libs/analytics-admin";
import { actionErrorMessage } from "@/app/lib/auth/action-error";
import {
  DEFAULT_EXPORT_FIELDS,
  EXPORT_FIELDS,
  EXPORT_FIELD_GROUPS,
  EXPORT_FIELD_LABELS,
  buildUserExport,
  exportFileName,
  isExportField,
  selectionOf,
  type ExportField,
  type ExportFormat,
  type UsersPick,
} from "@/app/lib/tracking/export";
import type { UserSort } from "@/app/lib/tracking/types";

const PREFS_KEY = "rww-admin-users-export";

interface Prefs {
  format: ExportFormat;
  fields: ExportField[];
  header: boolean;
}

const DEFAULT_PREFS: Prefs = {
  format: "csv",
  fields: DEFAULT_EXPORT_FIELDS,
  header: true,
};

const readPrefs = (): Prefs => {
  try {
    const value = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "null") as Partial<Prefs> | null;
    if (!value) return DEFAULT_PREFS;
    const fields = Array.isArray(value.fields) ? value.fields.filter(isExportField) : [];
    return {
      format: value.format === "txt" ? "txt" : "csv",
      fields: fields.length ? fields : DEFAULT_EXPORT_FIELDS,
      header: value.header !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
};

const savePrefs = (prefs: Prefs) => {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Not kept; the next export starts from the defaults.
  }
};

const download = (text: string, format: ExportFormat) => {
  const blob = new Blob([text], {
    type: format === "csv" ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFileName(format);
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-GB")} ${n === 1 ? one : many}`;

export interface UserExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pick: UsersPick;
  count: number;
  sort: UserSort;
  returnFocus: RefObject<HTMLButtonElement | null>;
}

const UserExportDialog: FC<UserExportDialogProps> = ({ open, onOpenChange, pick, count, sort, returnFocus }) => {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  // Each opening starts from the last export's choices, set in the render that opens it so the
  // defaults never flash. Only ever true in the browser: the dialog opens from a click.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPrefs(readPrefs());
      setError(null);
      setNote(null);
    }
  }

  const chosen = new Set(prefs.fields);
  // Kept in the catalogue's order, whatever order they were ticked in.
  const setFields = (next: Set<ExportField>) =>
    setPrefs((p) => ({
      ...p,
      fields: EXPORT_FIELDS.filter((f) => next.has(f)),
    }));
  const toggle = (field: ExportField) => {
    const next = new Set(chosen);
    if (next.has(field)) next.delete(field);
    else next.add(field);
    setFields(next);
  };

  const run = () => {
    if (!prefs.fields.length || busy) return;
    setError(null);
    setNote(null);
    startBusy(async () => {
      try {
        const res = await exportUsers({
          selection: selectionOf(pick),
          fields: prefs.fields,
          sort,
        });
        if (!res.data) {
          setError(res.error);
          return;
        }
        savePrefs(prefs);
        download(buildUserExport(res.data, prefs.format, prefs.header), prefs.format);
        if (res.data.truncated) setNote(`The file stops at ${plural(res.data.rows.length, "person", "people")}. Narrow the search to export the rest.`);
        else onOpenChange(false);
      } catch (e) {
        setError(`The export didn't finish: ${actionErrorMessage(e)}`);
      }
    });
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        // Not while the export is in flight: the file has to land somewhere.
        if (!next && busy) return;
        onOpenChange(next);
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocus.current?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100%-2rem)] max-w-[600px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white br-bold duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex flex-none items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-[15px] font-bold text-primary">Export {plural(count, "person", "people")}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-[13px] text-black/65">Pick the format and the columns.</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              disabled={busy}
              className="inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md bg-white text-[#222325] br-shadow-press">
              <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto border-t border-black/10 px-6 py-5">
            <fieldset>
              <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Format</legend>
              <div className="flex gap-2">
                {(["csv", "txt"] as const).map((format) => (
                  <label
                    key={format}
                    className={`cursor-pointer rounded-md border px-4 py-1.5 text-sm font-bold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-black ${
                      prefs.format === format ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"
                    }`}>
                    <input
                      type="radio"
                      name="export-format"
                      value={format}
                      checked={prefs.format === format}
                      onChange={() => setPrefs((p) => ({ ...p, format }))}
                      className="sr-only"
                    />
                    {format.toUpperCase()}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <legend className="text-xs font-bold uppercase tracking-wide text-gray-500">Columns ({prefs.fields.length})</legend>
                <span className="flex gap-3 text-xs font-semibold">
                  <button type="button" onClick={() => setFields(new Set(EXPORT_FIELDS))} className="text-primary hover:underline">
                    All
                  </button>
                  <button type="button" onClick={() => setFields(new Set())} className="text-gray-500 hover:text-primary hover:underline">
                    None
                  </button>
                </span>
              </div>
              <div className="space-y-4">
                {EXPORT_FIELD_GROUPS.map((group) => (
                  <div key={group.title}>
                    <p className="mb-1.5 text-[13px] font-bold text-primary">{group.title}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                      {group.fields.map((field) => (
                        <label key={field} className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px] text-gray-700">
                          <input
                            type="checkbox"
                            checked={chosen.has(field)}
                            onChange={() => toggle(field)}
                            className="h-4 w-4 flex-none cursor-pointer accent-primary"
                          />
                          {EXPORT_FIELD_LABELS[field]}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>

            <label className="mt-5 flex cursor-pointer items-center gap-2 text-[13px] text-gray-700">
              <input
                type="checkbox"
                checked={prefs.header}
                onChange={(e) => setPrefs((p) => ({ ...p, header: e.target.checked }))}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              Column names on the first line
            </label>
          </div>

          {/* Outside the scrolling list, so a refusal shows beside the button that was pressed. */}
          <div className="flex flex-none flex-wrap justify-end gap-2 border-t border-black/10 px-6 py-4">
            {error && (
              <p role="alert" className="w-full rounded-md border border-[#f3c4b8] bg-[#fdeae6] p-3 text-[13px] text-[#b23c26]">
                {error}
              </p>
            )}
            {note && (
              <p role="status" className="w-full rounded-md bg-secondary/30 p-3 text-[13px] text-primary br-plain">
                {note}
              </p>
            )}
            <DialogPrimitive.Close
              disabled={busy}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 transition-colors hover:border-black disabled:opacity-50">
              {note ? "Done" : "Cancel"}
            </DialogPrimitive.Close>
            <button
              type="button"
              onClick={run}
              disabled={busy || !prefs.fields.length}
              aria-busy={busy}
              className="flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-bold text-primary br-shadow-press disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : <Download className="h-4 w-4" aria-hidden />}
              {busy ? "Preparing…" : `Download ${prefs.format.toUpperCase()}`}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default UserExportDialog;
