"use client";

import { useState, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CldUploadWidget } from "next-cloudinary";
import { closeUploadWidget } from "./uploadWidget";
import { toast } from "react-toastify";
import type { LeadMagnet } from "@/app/lib/blog/types";
import { createLeadMagnet, deleteLeadMagnet, updateLeadMagnet, type LeadMagnetInput } from "@/libs/blog-admin";
import LeadMagnetCard from "@/app/components/blog/LeadMagnetCard";
import OfferTargeting, { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from "./OfferTargeting";
import { OfferSwitch } from "./OfferSwitch";

const BTN_DARK = "drop-shadow-primary2-hover transition-all bg-black text-white border-2 border-primary font-bold rounded-sm px-4 h-10 disabled:opacity-50";
const BTN_LIGHT = "drop-shadow-secondary2-hover transition-all bg-white text-primary border-2 border-primary font-bold rounded-sm px-4 h-10";

const LeadMagnetForm: FC<{ initial?: LeadMagnet }> = ({ initial }) => {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [hook, setHook] = useState(initial?.hook ?? "");
  const [bullets, setBullets] = useState<string[]>([initial?.bullets[0] ?? "", initial?.bullets[1] ?? "", initial?.bullets[2] ?? ""]);
  const [buttonLabel, setButtonLabel] = useState(initial?.buttonLabel ?? "Send it to me");
  const [fileUrl, setFileUrl] = useState(initial?.fileUrl ?? "");
  const [fileName, setFileName] = useState(initial?.fileName ?? "");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [targetCategories, setTargetCategories] = useState<string[]>(initial?.targetCategories ?? []);
  const [targetTags, setTargetTags] = useState<string[]>(initial?.targetTags ?? []);
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);

  const payload = (): LeadMagnetInput => ({
    slug: slug.trim() || undefined,
    title: title.trim(),
    hook: hook.trim(),
    bullets: bullets.map((b) => b.trim()).filter(Boolean),
    buttonLabel: buttonLabel.trim() || "Send it to me",
    fileUrl: fileUrl.trim(),
    fileName: fileName.trim() || fileUrl.split("/").pop() || "download.pdf",
    coverImage: coverImage.trim() || null,
    targetCategories,
    targetTags,
    active,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !hook.trim() || !fileUrl.trim()) {
      toast.error("Title, hook and a file are required.");
      return;
    }
    setBusy(true);
    try {
      const result = initial ? await updateLeadMagnet(initial.id, payload()) : await createLeadMagnet(payload());
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(initial ? "Lead magnet updated" : "Lead magnet created");
      router.push("/heroshima/conversions");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial || !window.confirm(`Delete "${initial.title}"? Posts that used it fall back to automatic resolution.`)) return;
    setBusy(true);
    try {
      await deleteLeadMagnet(initial.id);
      toast.success("Deleted");
      router.push("/heroshima/conversions");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={ADMIN_LABEL}>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={ADMIN_INPUT} placeholder="The Remote Resume Checklist" required />
        </div>
        <div>
          <label className={ADMIN_LABEL}>Hook (one sentence — the promise)</label>
          <textarea value={hook} onChange={(e) => setHook(e.target.value)} className={ADMIN_INPUT} rows={2} placeholder="27 checks that get a resume past the software and past a hiring manager." required />
        </div>
        <div>
          <label className={ADMIN_LABEL}>What is inside (up to 3 lines)</label>
          {bullets.map((b, i) => (
            <input key={i} value={b} onChange={(e) => setBullets(bullets.map((x, j) => (j === i ? e.target.value : x)))} className={ADMIN_INPUT} placeholder={`Line ${i + 1}`} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL}>Button label</label>
            <input value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} className={ADMIN_INPUT} />
          </div>
          <div>
            <label className={ADMIN_LABEL}>Slug (optional)</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={ADMIN_INPUT} placeholder="auto from title" />
            <p className={ADMIN_HINT}>Used in markers: [[magnet:{slug || "slug"}]]</p>
          </div>
        </div>

        <div className="rounded-md border border-gray-200 p-4">
          <p className="text-sm font-semibold text-primary">The file</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <CldUploadWidget
              options={{ sources: ["local", "url"], folder: "lead-magnets", resourceType: "auto", clientAllowedFormats: ["pdf", "xlsx", "docx", "zip"] }}
              uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_PRESET}
              onSuccess={(result) => {
                const info = result?.info;
                if (info && typeof info !== "string" && info.secure_url) {
                  setFileUrl(info.secure_url);
                  setFileName(`${info.original_filename ?? "download"}.${info.format ?? "pdf"}`);
                }
              }}
              onQueuesEnd={(_r, { widget }) => closeUploadWidget(widget)}>
              {({ open }) => (
                <button type="button" onClick={() => open()} className={BTN_DARK}>
                  Upload file
                </button>
              )}
            </CldUploadWidget>
            <span className="text-xs text-gray-500">or paste a URL below (e.g. /lead-magnets/remote-resume-checklist.pdf)</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
            <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} className={ADMIN_INPUT} placeholder="https://… or /lead-magnets/file.pdf" required />
            <input value={fileName} onChange={(e) => setFileName(e.target.value)} className={ADMIN_INPUT} placeholder="download file name.pdf" />
          </div>
        </div>

        <div className="rounded-md border border-gray-200 p-4">
          <p className="text-sm font-semibold text-primary">Cover image (optional, portrait 4:5)</p>
          <div className="mt-2 flex items-center gap-3">
            {coverImage && <Image src={coverImage} alt="" width={96} height={120} className="rounded-md border" />}
            <CldUploadWidget
              options={{ sources: ["local", "url", "unsplash"], folder: "lead-magnets" }}
              uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_PRESET}
              onSuccess={(result) => {
                const info = result?.info;
                if (info && typeof info !== "string" && info.secure_url) setCoverImage(info.secure_url);
              }}
              onQueuesEnd={(_r, { widget }) => closeUploadWidget(widget)}>
              {({ open }) => (
                <button type="button" onClick={() => open()} className={BTN_LIGHT}>
                  {coverImage ? "Replace cover" : "Upload cover"}
                </button>
              )}
            </CldUploadWidget>
            {coverImage && (
              <button type="button" onClick={() => setCoverImage("")} className="text-xs text-red-600 underline">
                Remove
              </button>
            )}
          </div>
        </div>

        <OfferTargeting categories={targetCategories} tags={targetTags} onCategories={setTargetCategories} onTags={setTargetTags} />

        <div className="flex flex-col gap-1">
          <OfferSwitch checked={active} onChange={setActive} label={active ? "On — readers can see this" : "Off — hidden everywhere, even where a post names it"} />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" disabled={busy} className={BTN_DARK}>
            {busy ? "Saving…" : initial ? "Save changes" : "Create lead magnet"}
          </button>
          {initial && (
            <button type="button" onClick={remove} disabled={busy} className="h-10 rounded-sm border-2 border-red-600 px-4 font-bold text-red-600">
              Delete
            </button>
          )}
        </div>
      </form>

      <div>
        <p className="mb-2 text-sm font-semibold text-primary">Preview (sidebar card)</p>
        <LeadMagnetCard
          magnet={{
            slug: slug || "preview",
            title: title || "Your lead magnet title",
            hook: hook || "One sentence that makes the download irresistible.",
            bullets: bullets.filter(Boolean),
            buttonLabel: buttonLabel || "Send it to me",
            coverImage: coverImage || null,
            fileName: fileName || "download.pdf",
          }}
          variant="sidebar"
          placement="sidebar"
        />
      </div>
    </div>
  );
};

export default LeadMagnetForm;
