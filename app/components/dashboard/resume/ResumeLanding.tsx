"use client";

import { useRef, useState, type FC } from "react";
import { FilePlus2, FileText, Upload } from "lucide-react";
import TimeAgo from "timeago-react";
import { Lottie } from "lottie-react";
import StickerButton from "@/app/components/dashboard/ui/StickerButton";
import type { ResumeDocument } from "./resume-document";

export interface ResumeLandingProps {
  documents: ResumeDocument[];
  /** Open an existing document in the editor. */
  onOpen: (id: string) => void;
  /** Create a blank document with this name and open it. */
  onCreateBlank: (label: string) => void;
  /** Turn an uploaded file into an editable draft and open it. */
  onImport: (fileName: string) => void;
}

const ResumeLanding: FC<ResumeLandingProps> = ({ documents, onOpen, onCreateBlank, onImport }) => {
  const [naming, setNaming] = useState(false);
  const [label, setLabel] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const create = () => {
    onCreateBlank(label.trim() || "New resume");
    setLabel("");
  };

  function handleFile(file: File | undefined) {
    if (!file) return;
    onImport(file.name);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6]">
      <div className="mx-auto flex min-h-screen max-w-[680px] flex-col items-center justify-center px-6 py-12 text-center">
        <span aria-hidden className="flex items-center justify-center">
          <Lottie src={`/Lottie/neobrutalism/Edit_Contract_lottie.json`} autoplay loop speed={0.63} style={{ width: 300, height: 300 }} />
        </span>

        <h1 className="text-[22px] font-bold text-primary leading-tight">Let&apos;s build the resume that gets you hired</h1>
        {/* <p className="mt-2 max-w-[440px] text-sm leading-relaxed text-black/50">
          Start one from scratch, bring in a resume you already have, or keep polishing one you made here.
        </p> */}

        {/* The two ways to start fresh */}
        <div className="mt-5 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setNaming((v) => !v)}
            aria-expanded={naming}
            className="group rounded-2xl border-[1.5px] border-[#222325] bg-[#222325] p-5 text-left text-white cursor-pointer transition-[transform,box-shadow] duration-100 ease-out shadow-[3px_3px_0_0_#e1f073] hover:shadow-[4px_4px_0_0_#e1f073] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
            <span className="grid h-9 w-9 place-content-center rounded-lg bg-white/10">
              <FilePlus2 className="h-4 w-4 text-[#e1f073]" />
            </span>
            <span className="mt-3 block text-sm font-bold">Start from scratch</span>
            <span className="mt-1 block text-xs leading-relaxed text-white/55">A blank page with the default look — name it and go.</span>
          </button>

          <label className="group rounded-2xl border-[1.5px] border-black/15 bg-white p-5 text-left cursor-pointer transition-[transform,box-shadow,border-color] duration-100 ease-out hover:border-[#222325] hover:shadow-[4px_4px_0_0_#222325] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
            <span className="grid h-9 w-9 place-content-center rounded-lg bg-[#f0f0ea]">
              <Upload className="h-4 w-4 text-primary" />
            </span>
            <span className="mt-3 block text-sm font-bold text-primary">Start from a resume you have</span>
            <span className="mt-1 block text-xs leading-relaxed text-black/50">
              Upload a PDF, DOCX or TXT — we turn it into an editable draft.
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt,.md"
              className="sr-only"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </label>
        </div>

        {/* Step 2 of "start from scratch" — reveal, don't modal */}
        {naming && (
          <div className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border-[1.5px] border-[#222325] bg-white p-3 shadow-[3px_3px_0_0_#222325]">
            <input
              type="text"
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
              }}
              placeholder="Name it — e.g. Stripe — Senior Designer"
              className="min-w-0 flex-1 rounded-xl border border-black/12 bg-[#fbfbf7] px-4 py-2.5 text-sm text-primary placeholder:text-black/35 outline-none focus:border-black/30 transition-colors"
            />
            <StickerButton type="button" variant="primary" size="md" onClick={create}>
              <FilePlus2 className="h-4 w-4" />
              Create
            </StickerButton>
          </div>
        )}

        {/* The old ones */}
        {documents.length > 0 && (
          <div className="mt-8 w-full">
            <p className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.09em] text-black/40">Or pick up where you left off</p>
            <div className="grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
              {documents.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onOpen(d.id)}
                  className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3.5 text-left transition-colors cursor-pointer hover:border-[#222325]">
                  <span className="grid h-9 w-9 flex-none place-content-center rounded-lg bg-[#f0f0ea] text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-primary">{d.label}</span>
                    <span className="block truncate text-xs text-black/45">
                      {d.scan ? (
                        <>
                          {d.scan.kind === "job" ? `against ${d.scan.job}` : "general"} · scanned{" "}
                          <TimeAgo datetime={d.scan.at} opts={{ minInterval: 10 }} />
                        </>
                      ) : (
                        "no ATS check yet"
                      )}
                    </span>
                  </span>
                  <span className="flex-none text-right">
                    <span className="block text-base font-bold text-primary tabular-nums">{d.scan ? d.score : "—"}</span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.06em] text-black/35">ATS</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResumeLanding;
