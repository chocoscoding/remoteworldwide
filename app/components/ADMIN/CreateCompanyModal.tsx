"use client";

import { FC, useRef } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ExternalLink, Plus, X } from "lucide-react";
import type { Company } from "@prisma/client";
import CompanyForm from "./CompanyForm";

/**
 * "Create new company" popup, opened from the green **Add new Company** entry
 * in the job forms' company select. It carries the same fields as
 * `/heroshima/companies/create` so nothing has to be filled in twice, and the
 * job form behind it keeps everything already typed into it.
 *
 * Deliberately non-modal (`modal={false}`): the Cloudinary upload widget mounts
 * its own iframe outside this dialog, and Radix's modal focus trap would keep
 * yanking focus back out of it. The overlay below is rendered by hand for the
 * same reason — `DialogPrimitive.Overlay` only renders in modal mode.
 */

export interface CreateCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires with the created company — the job form adds it to its own list and selects it. */
  onCreated: (company: Company) => void;
  /** Where "Go to company creation page" sends the admin. */
  creationPageHref?: string;
}

const CLOSE_BUTTON_CLASS =
  "inline-flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-md border-[1.5px] border-[#222325] bg-white text-[#222325] shadow-[2px_2px_0_0_#222325] transition-[transform,box-shadow] duration-100 ease-out hover:shadow-[2.5px_2.5px_0_0_#222325] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

const CreateCompanyModal: FC<CreateCompanyModalProps> = ({
  open,
  onOpenChange,
  onCreated,
  creationPageHref = "/heroshima/companies/create",
}) => {
  // A ref, not state: the widget hands focus to its iframe in the same tick it
  // opens, and the "focus left the dialog" dismissal fires before a setState
  // would have committed. While the widget is up, every outside click, focus
  // move and Escape belongs to it — without this the dialog dismisses itself
  // the moment the admin reaches for a logo.
  const isLogoWidgetOpen = useRef(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const keepOpenForWidget = (event: { preventDefault: () => void }) => {
    if (isLogoWidgetOpen.current) event.preventDefault();
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) isLogoWidgetOpen.current = false;
        onOpenChange(next);
      }}
      modal={false}>
      <DialogPrimitive.Portal>
        <div
          data-state={open ? "open" : "closed"}
          className="fixed inset-0 z-50 bg-[#222325]/45 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <DialogPrimitive.Content
          ref={contentRef}
          onInteractOutside={keepOpenForWidget}
          onEscapeKeyDown={keepOpenForWidget}
          onOpenAutoFocus={(event) => {
            // Default focus lands on the close button; start on Company Name instead.
            event.preventDefault();
            contentRef.current?.querySelector("input")?.focus();
          }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border-[1.5px] border-[#222325] bg-white shadow-[6px_6px_0_0_#222325] duration-200 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex flex-none items-start justify-between gap-4 border-b-[1.5px] border-[#222325] px-6 py-5">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-primary">Create New Company</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-black/50">
                It joins the company list right here once saved — nothing you&apos;ve already filled in on the job is lost.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className={CLOSE_BUTTON_CLASS}>
              <X className="h-3.5 w-3.5" strokeWidth={3} />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <CompanyForm
            className="flex min-h-0 flex-1 flex-col"
            fieldsClassName="min-h-0 flex-1 overflow-y-auto scrollbar-neo px-6 py-5"
            onCreated={onCreated}
            onLogoWidgetOpenChange={(next) => {
              isLogoWidgetOpen.current = next;
            }}
            renderActions={({ isLoading }) => (
              <div className="flex flex-none flex-wrap items-center justify-between gap-3 border-t-[1.5px] border-[#222325] bg-[#f9f8f1] px-6 py-4">
                <Link
                  href={creationPageHref}
                  className="inline-flex items-center gap-2 rounded-lg border-[1.5px] border-[rgba(34,35,37,.25)] bg-white px-3 py-2 text-xs font-bold text-[#222325] transition-all hover:-translate-x-px hover:-translate-y-px hover:border-[#222325] hover:shadow-[3px_3px_0_0_#222325]">
                  <ExternalLink className="h-4 w-4" />
                  Go to company creation page
                </Link>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 rounded-lg border-[1.5px] border-[#222325] bg-secondary px-4 py-2 text-sm font-bold text-primary transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-[4px_4px_0_0_#222325] active:translate-x-0 active:translate-y-0 active:shadow-none disabled:pointer-events-none disabled:opacity-50">
                  <Plus className="h-4 w-4" strokeWidth={3} />
                  {isLoading ? "Creating..." : "Create Company"}
                </button>
              </div>
            )}
          />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default CreateCompanyModal;
