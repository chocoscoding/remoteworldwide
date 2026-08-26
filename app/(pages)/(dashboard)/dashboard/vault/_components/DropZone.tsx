"use client";

import { FC, ReactNode, useRef, useState, type DragEvent } from "react";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Page-level drag-and-drop. Wraps the main content; dragging files anywhere
 * over it raises the lime overlay — the page's one accent moment — and
 * dropping hands the FileList up.
 *
 * dragenter/dragleave fire for every child crossed, so a bare boolean
 * flickers; the standard fix is a depth counter (ref written in event
 * handlers, never render).
 */
export interface DropZoneProps {
  onFiles: (files: FileList) => void;
  children: ReactNode;
  className?: string;
}

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

const DropZone: FC<DropZoneProps> = ({ onFiles, children, className }) => {
  const [active, setActive] = useState(false);
  const depth = useRef(0);

  function onDragEnter(e: DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    setActive(true);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setActive(false);
  }

  function onDragOver(e: DragEvent<HTMLDivElement>) {
    // preventDefault here is what makes the region a legal drop target.
    if (hasFiles(e)) e.preventDefault();
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current = 0;
    setActive(false);
    if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
  }

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn("relative", className)}>
      {children}

      {active && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-[3px] border-dashed border-[#222325] bg-[#e1f073]/85">
          <div className="flex flex-col items-center gap-2.5 text-center">
            <span className="grid h-12 w-12 place-content-center rounded-full bg-[#222325]">
              <Upload className="h-5 w-5 text-[#e1f073]" />
            </span>
            <p className="text-base font-bold text-[#222325]">Drop to add</p>
            <p className="text-xs font-semibold text-[#222325]/70">Files land in your documents with their real name and size</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropZone;
