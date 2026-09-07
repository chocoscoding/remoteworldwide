"use client";

import { useState, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CldUploadWidget } from "next-cloudinary";
import { closeUploadWidget } from "./uploadWidget";
import { toast } from "react-toastify";
import type { Cta, CtaImageSide, CtaTone } from "@/app/lib/blog/types";
import { createCta, deleteCta, updateCta, type CtaInput } from "@/libs/blog-admin";
import CtaCard from "@/app/components/blog/CtaCard";
import OfferTargeting, { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from "./OfferTargeting";
import { OfferSwitch } from "./OfferSwitch";

const BTN_DARK = "drop-shadow-primary2-hover transition-all bg-black text-white border-2 border-primary font-bold rounded-sm px-4 h-10 disabled:opacity-50";
const TONES: { value: CtaTone; label: string }[] = [
  { value: "INK", label: "Ink — black card, lime shadow" },
  { value: "LIME", label: "Lime — lime card, black shadow" },
  { value: "PAPER", label: "Paper — off-white card" },
];

const CtaForm: FC<{ initial?: Cta }> = ({ initial }) => {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [eyebrow, setEyebrow] = useState(initial?.eyebrow ?? "");
  const [headline, setHeadline] = useState(initial?.headline ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [buttonLabel, setButtonLabel] = useState(initial?.buttonLabel ?? "");
  const [href, setHref] = useState(initial?.href ?? "/dashboard/ats");
  const [tone, setTone] = useState<CtaTone>(initial?.tone ?? "INK");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [imageSide, setImageSide] = useState<CtaImageSide>(initial?.imageSide ?? "RIGHT");
  const [targetCategories, setTargetCategories] = useState<string[]>(initial?.targetCategories ?? []);
  const [targetTags, setTargetTags] = useState<string[]>(initial?.targetTags ?? []);
  const [active, setActive] = useState(initial?.active ?? true);
  const [busy, setBusy] = useState(false);

  const payload = (): CtaInput => ({
    key: key.trim() || undefined,
    name: name.trim(),
    eyebrow: eyebrow.trim() || null,
    headline: headline.trim(),
    body: body.trim(),
    buttonLabel: buttonLabel.trim(),
    href: href.trim(),
    tone,
    imageUrl: imageUrl.trim() || null,
    imageSide,
    targetCategories,
    targetTags,
    active,
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !headline.trim() || !buttonLabel.trim() || !href.trim()) {
      toast.error("Name, headline, button label and link are required.");
      return;
    }
    if (!/^(\/|https?:\/\/)/.test(href.trim())) {
      toast.error("Link must start with / or https://");
      return;
    }
    setBusy(true);
    try {
      const result = initial ? await updateCta(initial.id, payload()) : await createCta(payload());
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(initial ? "CTA updated" : "CTA created");
      router.push("/heroshima/conversions");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial || !window.confirm(`Delete "${initial.name}"? Posts that named it fall back to automatic resolution.`)) return;
    setBusy(true);
    try {
      await deleteCta(initial.id);
      toast.success("Deleted");
      router.push("/heroshima/conversions");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_440px]">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL}>Name (admin label)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={ADMIN_INPUT} placeholder="ATS scorer" required />
          </div>
          <div>
            <label className={ADMIN_LABEL}>Key (optional)</label>
            <input value={key} onChange={(e) => setKey(e.target.value)} className={ADMIN_INPUT} placeholder="auto from name" />
            <p className={ADMIN_HINT}>Used in markers: [[cta:{key || "key"}]]</p>
          </div>
        </div>
        <div>
          <label className={ADMIN_LABEL}>Eyebrow (optional)</label>
          <input value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} className={ADMIN_INPUT} placeholder="Free tool" />
        </div>
        <div>
          <label className={ADMIN_LABEL}>Headline</label>
          <input value={headline} onChange={(e) => setHeadline(e.target.value)} className={ADMIN_INPUT} placeholder="See how the software reads your resume" required />
        </div>
        <div>
          <label className={ADMIN_LABEL}>Body</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} className={ADMIN_INPUT} rows={2} placeholder="One or two sentences." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL}>Button label</label>
            <input value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} className={ADMIN_INPUT} placeholder="Score my resume" required />
          </div>
          <div>
            <label className={ADMIN_LABEL}>Link</label>
            <input value={href} onChange={(e) => setHref(e.target.value)} className={ADMIN_INPUT} placeholder="/dashboard/ats" required />
            <p className={ADMIN_HINT}>Clicks go through /go/{key || "key"} and are counted.</p>
          </div>
        </div>
        <div>
          <label className={ADMIN_LABEL}>Tone</label>
          <select value={tone} onChange={(e) => setTone(e.target.value as CtaTone)} className={ADMIN_INPUT}>
            {TONES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-md border border-gray-200 p-4">
          <p className="text-sm font-semibold text-primary">Image (optional)</p>
          <p className={ADMIN_HINT}>Landscape works best — the card crops it to 4:3. Uploads go to Cloudinary under ctas/.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {imageUrl && <Image src={imageUrl} alt="" width={120} height={90} className="h-[90px] w-[120px] rounded-md border object-cover" />}
            <CldUploadWidget
              options={{ sources: ["local", "url", "unsplash"], folder: "ctas", clientAllowedFormats: ["png", "jpg", "jpeg", "webp", "avif"] }}
              uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_PRESET}
              onSuccess={(result) => {
                const info = result?.info;
                if (info && typeof info !== "string" && info.secure_url) setImageUrl(info.secure_url);
              }}
              onQueuesEnd={(_r, { widget }) => closeUploadWidget(widget)}>
              {({ open }) => (
                <button type="button" onClick={() => open()} className={BTN_DARK}>
                  {imageUrl ? "Replace image" : "Upload image"}
                </button>
              )}
            </CldUploadWidget>
            {imageUrl && (
              <button type="button" onClick={() => setImageUrl("")} className="text-xs text-red-600 underline">
                Remove image
              </button>
            )}
          </div>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className={ADMIN_INPUT}
            placeholder="or paste a Cloudinary image URL"
            aria-label="Image URL"
          />
          <fieldset className="mt-3" disabled={!imageUrl}>
            <legend className="text-sm font-medium text-primary">Image side</legend>
            <div className="mt-1.5 flex gap-2">
              {(["LEFT", "RIGHT"] as const).map((side) => (
                <label
                  key={side}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${imageSide === side ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"} ${!imageUrl ? "opacity-50" : ""}`}>
                  <input type="radio" name="imageSide" value={side} checked={imageSide === side} onChange={() => setImageSide(side)} className="sr-only" />
                  {side === "LEFT" ? "Image on the left" : "Image on the right"}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <OfferTargeting categories={targetCategories} tags={targetTags} onCategories={setTargetCategories} onTags={setTargetTags} />

        <div className="flex flex-col gap-1">
          <OfferSwitch checked={active} onChange={setActive} label={active ? "On — readers can see this" : "Off — hidden everywhere, even where a post names it"} />
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" disabled={busy} className={BTN_DARK}>
            {busy ? "Saving…" : initial ? "Save changes" : "Create CTA"}
          </button>
          {initial && (
            <button type="button" onClick={remove} disabled={busy} className="h-10 rounded-sm border-2 border-red-600 px-4 font-bold text-red-600">
              Delete
            </button>
          )}
        </div>
      </form>

      <div>
        <p className="mb-2 text-sm font-semibold text-primary">Preview (in-content card)</p>
        <CtaCard
          cta={{
            key: key || "preview",
            eyebrow: eyebrow || null,
            headline: headline || "Your headline goes here",
            body: body || "One or two sentences that make the next step obvious.",
            buttonLabel: buttonLabel || "Do the thing",
            tone,
            imageUrl: imageUrl || null,
            imageSide,
          }}
          variant="inline"
          placement="inline"
          className="my-0"
        />
      </div>
    </div>
  );
};

export default CtaForm;
