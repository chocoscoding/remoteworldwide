"use client";

import { useMemo, useRef, useState, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Select from "react-select";
import { CldUploadWidget } from "next-cloudinary";
import { closeUploadWidget } from "./uploadWidget";
import { TagsInput } from "react-tag-input-component";
import { toast } from "react-toastify";
import { ArrowDown, ArrowUp, PlusCircle, X } from "lucide-react";
import type { Blog } from "@/app/lib/blog/types";
import type { Option } from "@/types/main";
import { createBlog, editBlog } from "@/libs/query";
import { quillToolbarOptions } from "@/libs/quillconfig";
import { BLOG_CATEGORIES, inferCategory } from "@/app/lib/blog/categories";
import { slugifyTitle } from "@/app/lib/blog/slug";
import { AUTO, DEFAULT_INLINE_OFFERS, effectiveInlineOffers, offerToken, parseOfferToken, type OfferRef } from "@/app/lib/blog/offers";
import QuillEditor, { type QuillRef } from "./QuillEditor";
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from "./OfferTargeting";

export interface BlogFormProps {
  authors: Option[];
  magnets: { id: string; slug: string; title: string }[];
  ctas: { key: string; name: string }[];
  blog?: Blog & { author: { name: string } };
}

const SELECT_THEME = (theme: import("react-select").Theme) => ({ ...theme, borderRadius: 6, colors: { ...theme.colors, primary25: "#e5e5e5", primary: "black" } });
const AUTO_OPTION: Option = { value: "", label: "Auto (category → tags → site default)" };

function markerSummary(html: string): { cta: string[]; magnet: string[] } {
  const out = { cta: [] as string[], magnet: [] as string[] };
  for (const m of html.matchAll(/\[\[\s*(cta|magnet|lead-magnet|leadmagnet)\s*(?::\s*([a-z0-9-]+))?\s*\]\]/gi)) {
    (m[1].toLowerCase() === "cta" ? out.cta : out.magnet).push(m[2] ? m[2].toLowerCase() : "auto");
  }
  return out;
}

const StatusChips: FC<{ value: "PUBLISHED" | "DRAFT"; onChange: (v: "PUBLISHED" | "DRAFT") => void }> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="Status" className="mt-1 inline-flex rounded-md border-2 border-[#222325] bg-white p-0.5">
    {(
      [
        { v: "PUBLISHED", label: "Published" },
        { v: "DRAFT", label: "Draft" },
      ] as const
    ).map((s) => {
      const on = value === s.v;
      return (
        <label
          key={s.v}
          className={`cursor-pointer rounded-[4px] px-3.5 py-1.5 text-xs font-bold transition-colors ${on ? "bg-[#222325] text-[#e1f073]" : "text-gray-600 hover:text-[#222325]"}`}>
          <input type="radio" name="status" value={s.v} checked={on} onChange={() => onChange(s.v)} className="sr-only" />
          {s.label}
        </label>
      );
    })}
  </div>
);

const BlogForm: FC<BlogFormProps> = ({ authors, magnets, ctas, blog }) => {
  const router = useRouter();
  const quillRef: QuillRef = useRef(null);

  const [title, setTitle] = useState(blog?.title ?? "");
  const [description, setDescription] = useState(blog?.description ?? "");
  const [tags, setTags] = useState<string[]>(blog?.tags ?? []);
  const [text, setText] = useState(blog?.content ?? "");
  const [author, setAuthor] = useState<Option | undefined>(blog ? { value: blog.authorId, label: blog.author.name } : undefined);
  const [coverImage, setCoverImage] = useState(blog?.coverImage ?? "");
  const [category, setCategory] = useState<string>(blog?.category ?? "");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">(blog?.status ?? "PUBLISHED");
  const [featuredRank, setFeaturedRank] = useState<string>(blog?.featuredRank ? String(blog.featuredRank) : "");
  const [leadMagnetId, setLeadMagnetId] = useState<string>(blog?.leadMagnetId ?? "");
  const [ctaKey, setCtaKey] = useState<string>(blog?.ctaKey ?? "");
  const [offers, setOffers] = useState<OfferRef[]>(() =>
    blog ? effectiveInlineOffers(blog) : DEFAULT_INLINE_OFFERS.map((t) => parseOfferToken(t)!).filter(Boolean),
  );
  const [slug, setSlug] = useState(blog?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  const categoryOptions: Option[] = BLOG_CATEGORIES.map((c) => ({ value: c.slug, label: c.name }));
  const magnetOptions: Option[] = [AUTO_OPTION, ...magnets.map((m) => ({ value: m.id, label: m.title }))];
  const ctaOptions: Option[] = [AUTO_OPTION, ...ctas.map((c) => ({ value: c.key, label: c.name }))];
  const suggested = useMemo(() => (category ? null : inferCategory(tags)), [category, tags]);
  const markers = useMemo(() => markerSummary(text), [text]);
  const effectiveSlug = useMemo(() => {
    if (!slugTouched) return blog?.slug ?? slugifyTitle(title || "post");
    return slug.trim() ? slugifyTitle(slug) : slugifyTitle(title || "post");
  }, [blog?.slug, slug, slugTouched, title]);
  const slugChanged = Boolean(blog) && effectiveSlug !== blog?.slug;
  const handPlaced = markers.cta.length + markers.magnet.length > 0;

  const offerLabel = (o: OfferRef) => {
    if (o.kind === "cta") return o.ref === AUTO ? "Auto — the product CTA" : (ctas.find((c) => c.key === o.ref)?.name ?? `CTA "${o.ref}"`);
    return o.ref === AUTO ? "Auto — the sidebar offer" : (magnets.find((m) => m.slug === o.ref)?.title ?? `Download "${o.ref}"`);
  };
  const addOffer = (o: OfferRef) => setOffers((prev) => [...prev, o]);
  const removeOffer = (i: number) => setOffers((prev) => prev.filter((_, j) => j !== i));
  const moveOffer = (i: number, dir: -1 | 1) =>
    setOffers((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const chosenCategory = category || suggested?.slug || "job-search";
    if (!title || !description || tags.length === 0 || !text || !author || !coverImage) {
      toast.error("Please fill in all fields and upload a cover image.");
      return;
    }
    const knownCtas = new Set(ctas.map((c) => c.key));
    const knownMagnets = new Set(magnets.map((m) => m.slug));
    const badCta = markers.cta.find((k) => k !== "auto" && !knownCtas.has(k));
    const badMagnet = markers.magnet.find((k) => k !== "auto" && !knownMagnets.has(k));
    if (badCta || badMagnet) {
      toast.error(badCta ? `No CTA with the key "${badCta}". Fix or remove that marker.` : `No lead magnet with the slug "${badMagnet}". Fix or remove that marker.`);
      return;
    }
    const values = {
      title,
      description,
      tags,
      content: text,
      authorId: author.value,
      coverImage,
      slug: effectiveSlug,
      category: chosenCategory,
      status,
      featuredRank: featuredRank ? Number(featuredRank) : null,
      leadMagnetId: leadMagnetId || null,
      ctaKey: ctaKey || null,
      inlineOffers: offers.map(offerToken),
      autoCtas: false,
    };
    setBusy(true);
    try {
      if (blog) {
        const res = await editBlog(blog.id, values);
        toast.success("Blog updated");
        router.push(`/heroshima/blogs/${res.data.slug}`);
      } else {
        const res = await createBlog(values);
        toast.success("Blog created");
        router.push(`/heroshima/blogs/${res.data.slug}`);
      }
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full p-4">
      <h1 className="mb-4 text-2xl font-bold">{blog ? "Edit blog" : "Create new blog"}</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className={ADMIN_LABEL}>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter blog title" className={ADMIN_INPUT} required />
        </div>
        <div>
          <label className={ADMIN_LABEL}>URL</label>
          <div className="mt-1 flex items-center gap-0 rounded-md border border-gray-300 bg-white px-2">
            <span className="select-none whitespace-nowrap py-2 text-sm text-gray-400">/blogs/</span>
            <input
              type="text"
              value={slugTouched ? slug : effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="auto from the title"
              className="min-w-0 flex-1 py-2 text-sm text-primary outline-none"
            />
          </div>
          <p className={ADMIN_HINT}>
            Short and descriptive ranks better than long. Keep the words a reader would search for.
            {slugChanged && <span className="ml-1 font-semibold text-[#b23c26]">Changing this moves the post; the old URL will permanently redirect here.</span>}
          </p>
        </div>
        <div>
          <label className={ADMIN_LABEL}>Description (the dek under the title, and the card summary)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One or two sentences." className={ADMIN_INPUT} required />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className={ADMIN_LABEL}>Tags</label>
            <TagsInput value={tags} placeHolder="Enter tags" classNames={{ input: ADMIN_INPUT }} onChange={setTags} name="tags" />
          </div>
          <div>
            <label className={ADMIN_LABEL}>Author</label>
            <Select theme={SELECT_THEME} value={author} onChange={(v) => setAuthor(v ?? undefined)} options={authors} placeholder="Select author" className="mt-1" />
          </div>
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-primary">Conversion</p>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div>
              <label className={ADMIN_LABEL}>Category</label>
              <Select
                theme={SELECT_THEME}
                value={categoryOptions.find((o) => o.value === category) ?? null}
                onChange={(v) => setCategory(v?.value ?? "")}
                options={categoryOptions}
                placeholder={suggested ? `Auto: ${suggested.name}` : "Select category"}
                className="mt-1"
                isClearable
              />
              {!category && suggested && <p className={ADMIN_HINT}>Suggested from tags: {suggested.name}</p>}
            </div>
            <div>
              <label className={ADMIN_LABEL}>Status</label>
              <div>
                <StatusChips value={status} onChange={setStatus} />
              </div>
              <p className={ADMIN_HINT}>Drafts are visible to writers only.</p>
            </div>
            <div>
              <label className={ADMIN_LABEL}>Sidebar offer</label>
              <Select theme={SELECT_THEME} value={magnetOptions.find((o) => o.value === leadMagnetId) ?? AUTO_OPTION} onChange={(v) => setLeadMagnetId(v?.value ?? "")} options={magnetOptions} className="mt-1" />
            </div>
            <div>
              <label className={ADMIN_LABEL}>Product CTA (closes the post)</label>
              <Select theme={SELECT_THEME} value={ctaOptions.find((o) => o.value === ctaKey) ?? AUTO_OPTION} onChange={(v) => setCtaKey(v?.value ?? "")} options={ctaOptions} className="mt-1" />
            </div>
          </div>

          <div className="mt-4 rounded-md border border-gray-200 bg-white p-3" data-offers>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-primary">Inside the article</p>
              <p className="text-xs text-gray-500">{offers.length === 0 ? "Nothing in the body" : `${offers.length} spread evenly, top to bottom`}</p>
            </div>
            {offers.length > 0 && (
              <ol className="mt-2 space-y-1.5">
                {offers.map((o, i) => (
                  <li key={`${o.kind}-${o.ref}-${i}`} className="flex items-center gap-2 rounded-md border border-gray-200 px-2.5 py-1.5" data-offer-row>
                    <span className="w-5 text-center text-xs font-bold text-gray-400">{i + 1}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${o.kind === "cta" ? "bg-[#e1f073] text-[#222325]" : "bg-[#222325] text-[#e1f073]"}`}>
                      {o.kind === "cta" ? "CTA" : "Download"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-primary">{offerLabel(o)}</span>
                    <button type="button" onClick={() => moveOffer(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => moveOffer(i, 1)} disabled={i === offers.length - 1} aria-label="Move down" className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => removeOffer(i)} aria-label="Remove" className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-2.5 flex flex-wrap gap-2">
              <select
                aria-label="Add a CTA"
                className="rounded-md border border-gray-300 bg-white p-1.5 text-xs"
                value=""
                onChange={(e) => {
                  if (e.target.value) addOffer({ kind: "cta", ref: e.target.value });
                }}>
                <option value="">+ Add a CTA…</option>
                <option value={AUTO}>Auto — the product CTA</option>
                {ctas.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Add a download form"
                className="rounded-md border border-gray-300 bg-white p-1.5 text-xs"
                value=""
                onChange={(e) => {
                  if (e.target.value) addOffer({ kind: "magnet", ref: e.target.value });
                }}>
                <option value="">+ Add a download form…</option>
                <option value={AUTO}>Auto — the sidebar offer</option>
                {magnets.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
            <p className={ADMIN_HINT}>
              {handPlaced
                ? `This post has ${markers.cta.length + markers.magnet.length} marker(s) typed in the text — those positions win and this list is ignored.`
                : "Want one at an exact spot? Type [[cta:key]] or [[magnet:slug]] on its own line in the text."}
            </p>
          </div>

          <div className="mt-4">
            <label className={ADMIN_LABEL}>Start here rank</label>
            <select value={featuredRank} onChange={(e) => setFeaturedRank(e.target.value)} className={`${ADMIN_INPUT} max-w-xs`}>
              <option value="">Not hand-picked</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                  {n === 1 ? " — the lead" : ""}
                </option>
              ))}
            </select>
            <p className={ADMIN_HINT}>Hand-picked posts show on the blog landing page and in every sidebar.</p>
          </div>
        </div>

        <div className="gap-4 items-center">
          {coverImage ? <Image src={coverImage} alt="" width={1080} height={720} className="outline outline-2 outline-gray-300 w-6/12 aspect-video rounded-md p-1 shadow-md mb-2" /> : null}
          <CldUploadWidget
            options={{ sources: ["local", "url", "unsplash"], folder: "blogs" }}
            uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_PRESET}
            onSuccess={(result) => {
              const info = result?.info;
              if (info && typeof info !== "string" && info.secure_url) setCoverImage(info.secure_url);
            }}
            onQueuesEnd={(_r, { widget }) => closeUploadWidget(widget)}>
            {({ open }) => (
              <button type="button" onClick={() => open()} className="drop-shadow-primary2-hover transition-all bg-black text-base text-white border-2 border-primary font-bold h-10 rounded-sm px-0.5 w-6/12 mb-1">
                Upload cover image
              </button>
            )}
          </CldUploadWidget>
        </div>

        <div>
          <label className={ADMIN_LABEL}>Content</label>
          <QuillEditor forwardedRef={quillRef} value={text} theme="snow" onChange={setText} modules={{ toolbar: quillToolbarOptions }} placeholder="Write the post" className="mt-1 bg-white" />
        </div>

        <div className="flex justify-center">
          <button type="submit" disabled={busy} className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3 hover:rounded-md disabled:opacity-50">
            <PlusCircle className="w-6 h-6 mr-2" />
            {busy ? "Saving…" : blog ? "Save changes" : "Publish"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BlogForm;
