"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FC, type MouseEvent, type SyntheticEvent } from "react";
import Image from "next/image";
import Select from "react-select";
import { CldUploadWidget } from "next-cloudinary";
import type { Quill, RangeStatic } from "react-quill-new";
import { closeUploadWidget, hostInlineImages, uploadImage } from "./uploadWidget";
import { TagsInput } from "react-tag-input-component";
import { toast } from "react-toastify";
import { ArrowDown, ArrowUp, Eye, Globe, PenLine, PlusCircle, RefreshCw, X } from "lucide-react";
import type { Author, EditableBlog, PublishField } from "@/app/lib/blog/types";
import type { Option } from "@/types/main";
import { discardBlogEdit, publishBlog, type BlogInput } from "@/libs/query";
import { previewBlog } from "@/libs/blog-admin";
import { actionErrorMessage } from "@/app/lib/auth/action-error";
import { quillToolbarOptions } from "@/libs/quillconfig";
import { BLOG_CATEGORIES, categoryBySlug, inferCategory } from "@/app/lib/blog/categories";
import { slugifyTitle } from "@/app/lib/blog/slug";
import { normalizeEditorHtml } from "@/app/lib/blog/editorHtml";
import { AUTO, DEFAULT_INLINE_OFFERS, effectiveInlineOffers, offerToken, parseOfferToken, type OfferRef } from "@/app/lib/blog/offers";
import Article from "@/app/components/blog/Article";
import NoImage from "@/app/components/blog/NoImage";
import { canRedo, canUndo, record, redo, settle, startHistory, undo, type History } from "@/app/lib/dashboard/resume/history";
import { cn } from "@/lib/utils";
import BlogEditPill from "./BlogEditPill";
import { useBlogAutosave } from "./useBlogAutosave";
import QuillEditor, { type QuillRef } from "./QuillEditor";
import TableBar from "./TableBar";
import { insertTable } from "./tableStyle";
import { softBreakMatcher, tableEnterBinding } from "./softBreak";
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from "./OfferTargeting";

export interface BlogFormProps {
  authors: Author[];
  me: Author | null;
  magnets: { id: string; slug: string; title: string }[];
  ctas: { key: string; name: string }[];
  blog?: EditableBlog;
}

type Preview = Awaited<ReturnType<typeof previewBlog>>;

const SELECT_THEME = (theme: import("react-select").Theme) => ({ ...theme, borderRadius: 6, colors: { ...theme.colors, primary25: "#e5e5e5", primary: "black" } });
const AUTO_OPTION: Option = { value: "", label: "Auto (category → tags → site default)" };
// The backend's NO_CTA (offerTargeting.ts): the post ends without a product CTA.
const NO_CTA_OPTION: Option = { value: "none", label: "None (no closing CTA)" };

function markerSummary(html: string): { cta: string[]; magnet: string[] } {
  const out = { cta: [] as string[], magnet: [] as string[] };
  for (const m of html.matchAll(/\[\[\s*(cta|magnet|lead-magnet|leadmagnet)\s*(?::\s*([a-z0-9-]+))?\s*\]\]/gi)) {
    (m[1].toLowerCase() === "cta" ? out.cta : out.magnet).push(m[2] ? m[2].toLowerCase() : "auto");
  }
  return out;
}

type View = "editor" | "edited" | "live";

const ViewToggle: FC<{ view: View; loading: View | null; hasLive: boolean; onChange: (v: View) => void }> = ({ view, loading, hasLive, onChange }) => (
  <div role="tablist" aria-label="Mode" className="inline-flex rounded-md border-2 border-[#222325] bg-white p-0.5">
    {(
      [
        { v: "editor", label: "Editor", Icon: PenLine },
        { v: "edited", label: hasLive ? "Preview edited" : "Preview", Icon: Eye },
        ...(hasLive ? [{ v: "live", label: "Preview live", Icon: Globe } as const] : []),
      ] as const
    ).map((t) => {
      const on = view === t.v;
      return (
        <button
          key={t.v}
          type="button"
          role="tab"
          aria-selected={on}
          disabled={loading !== null}
          onClick={() => onChange(t.v)}
          className={`inline-flex items-center gap-1.5 rounded-[4px] px-3.5 py-1.5 text-xs font-bold transition-colors ${on ? "bg-[#222325] text-[#e1f073]" : "text-gray-600 hover:text-[#222325]"}`}>
          <t.Icon className="h-3.5 w-3.5" />
          {loading === t.v ? "Loading…" : t.label}
        </button>
      );
    })}
  </div>
);

const authorOption = (a: Author): Option => ({ value: a.id, label: a.name });

// A quote, list or code block that starts or ends the post has no plain line beyond it, so
// the cursor can't leave it. These add one: arrow Up/Down at its edge, or a click below it.
const BLOCK_FORMATS = ["blockquote", "list", "code-block"];
const PLAIN_LINE = { blockquote: false, list: false, "code-block": false };

function addPlainLine(quill: Quill, at: "start" | "end") {
  const index = at === "start" ? 0 : quill.getLength() - 1;
  quill.insertText(index, "\n", "user");
  const line = at === "start" ? 0 : index + 1;
  quill.formatLine(line, 1, PLAIN_LINE, "user");
  quill.setSelection(line, 0, "user");
}

function exitTrailingBlock(quill: Quill, e: MouseEvent<HTMLDivElement>) {
  const last = quill.root.lastElementChild;
  if (e.target !== quill.root || !last || e.clientY <= last.getBoundingClientRect().bottom) return;
  const format = quill.getFormat(quill.getLength() - 1, 1);
  if (!BLOCK_FORMATS.some((f) => format[f])) return;
  e.preventDefault();
  addPlainLine(quill, "end");
}

type LineContext = { offset: number; line: { length(): number } };

// Arrow bindings: return true to let the caret move normally (a line exists beyond, or the
// caret isn't on the block's first/last visual row of a wrapped line).
function leaveBlockUp(this: { quill: Quill }, range: RangeStatic, context: LineContext) {
  if (range.index - context.offset !== 0) return true;
  const caret = this.quill.getBounds(range.index);
  const top = this.quill.getBounds(0);
  if (!caret || !top || caret.top > top.top + 2) return true;
  addPlainLine(this.quill, "start");
  return false;
}

function leaveBlockDown(this: { quill: Quill }, range: RangeStatic, context: LineContext) {
  const end = range.index - context.offset + context.line.length() - 1;
  if (end !== this.quill.getLength() - 1) return true;
  const caret = this.quill.getBounds(range.index);
  const bottom = this.quill.getBounds(end);
  if (!caret || !bottom || caret.top < bottom.top - 2) return true;
  addPlainLine(this.quill, "end");
  return false;
}

/** Puts images on their own line at `range` (replacing any selected text) and moves the cursor past them. */
function insertImages(quill: Quill, range: RangeStatic, urls: string[]) {
  if (range.length > 0) quill.deleteText(range.index, range.length, "user");
  let index = Math.min(range.index, quill.getLength() - 1);
  if (quill.getLine(index)[1] > 0) {
    quill.insertText(index, "\n", "user");
    index += 1;
  }
  for (const url of urls) {
    quill.insertEmbed(index, "image", url, "user");
    index += 1;
  }
  if (quill.getText(index, 1) !== "\n") quill.insertText(index, "\n", "user");
  quill.setSelection(Math.min(index + 1, quill.getLength() - 1), 0, "user");
}

/** Everything the writer edits, as one value: a point in the undo history and what autosave sends. */
interface Draft {
  title: string;
  slug: string;
  slugTouched: boolean;
  description: string;
  tags: string[];
  content: string;
  coauthorIds: string[];
  coverImage: string;
  category: string;
  featuredRank: string;
  leadMagnetId: string;
  ctaKey: string;
  offers: OfferRef[];
}

/** One version of the post as Preview renders it. */
interface Version {
  title: string;
  slug: string;
  description: string;
  content: string;
  coverImage: string;
  tags: string[];
  category: string;
  leadMagnetId: string | null;
  ctaKey: string | null;
  inlineOffers: string[];
  authorIds: string[];
}

const FIELD_ERRORS: Record<PublishField, string> = {
  title: "Add a title",
  description: "Add a description",
  tags: "Add at least one tag",
  content: "Write the post",
  authors: "Pick an author",
  coverImage: "Upload a cover image",
};

// Typing in these folds into one undo step per pause; everything else is a step of its own.
const TYPING_FIELDS = new Set<keyof Draft>(["title", "slug", "description", "content"]);
const TYPING_PAUSE_MS = 700;

/** A draft's slug that is still just its title's (or the placeholder), so it should keep following the title. */
function followsTitle(slug: string, title: string) {
  if (slug.startsWith("untitled-")) return true;
  const base = slugifyTitle(title || "post");
  return slug === base || new RegExp(`^${base}-\\d+$`).test(slug);
}

function draftOf(blog: EditableBlog | undefined): Draft {
  const offers = (tokens: string[]) => tokens.flatMap((t) => parseOfferToken(t) ?? []);
  if (!blog) {
    return {
      title: "",
      slug: "",
      slugTouched: false,
      description: "",
      tags: [],
      content: "",
      coauthorIds: [],
      coverImage: "",
      category: "",
      featuredRank: "",
      leadMagnetId: "",
      ctaKey: "",
      offers: offers(DEFAULT_INLINE_OFFERS),
    };
  }
  const p = blog.pendingEdit;
  const v = p ?? blog;
  const slug = p?.slug ?? blog.slug;
  return {
    title: v.title,
    slug,
    slugTouched: blog.status === "PUBLISHED" ? slug !== blog.slug : !followsTitle(blog.slug, blog.title),
    description: v.description,
    tags: v.tags,
    content: v.content,
    coauthorIds: v.authorIds.slice(1),
    coverImage: v.coverImage,
    category: v.category ?? "",
    featuredRank: v.featuredRank ? String(v.featuredRank) : "",
    leadMagnetId: v.leadMagnetId ?? "",
    ctaKey: v.ctaKey ?? "",
    offers: p ? offers(p.inlineOffers) : effectiveInlineOffers(blog),
  };
}

const BlogForm: FC<BlogFormProps> = ({ authors, me, magnets, ctas, blog }) => {
  const quillRef: QuillRef = useRef(null);
  const imagePicker = useRef<HTMLButtonElement>(null);
  const editorWrap = useRef<HTMLDivElement>(null);
  const imageRange = useRef<RangeStatic | null>(null);
  const hostedImages = useRef(new Map<string, string>());
  const byId = useMemo(() => new Map(authors.map((a) => [a.id, a])), [authors]);

  // Memoised: react-quill rebuilds the editor whenever `modules` changes, and new handler
  // functions each render would count as a change. Handlers only touch refs.
  const quillModules = useMemo(
    () => ({
      toolbar: {
        container: quillToolbarOptions,
        handlers: {
          // The same Cloudinary widget as the cover image: upload, paste a link, or search Unsplash.
          image() {
            const quill = quillRef.current?.getEditor();
            if (!quill) return;
            imageRange.current = quill.getSelection(true);
            imagePicker.current?.click();
          },
          table() {
            const quill = quillRef.current?.getEditor();
            if (!quill) return;
            insertTable(quill);
          },
        },
      },
      keyboard: {
        bindings: {
          "leave block up": { key: "ArrowUp", collapsed: true, format: BLOCK_FORMATS, handler: leaveBlockUp },
          "leave block down": { key: "ArrowDown", collapsed: true, format: BLOCK_FORMATS, handler: leaveBlockDown },
          "table enter": tableEnterBinding,
        },
      },
      clipboard: { matchers: [softBreakMatcher] },
      table: true,
      uploader: {
        mimetypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
        // Pasted and dropped images go to Cloudinary; Quill's default inlines them as base64, which posts can't show.
        handler(this: { quill: Quill }, range: RangeStatic, files: File[]) {
          const quill = this.quill;
          toast
            .promise(Promise.all(files.map((file) => uploadImage(file))), { pending: "Uploading image…", success: "Image added", error: "Image upload failed" })
            .then((urls) => insertImages(quill, range, urls))
            .catch(() => undefined);
        },
      },
    }),
    [],
  );

  // The post as the server last returned it: its live fields, status and any edited version.
  const [post, setPost] = useState<EditableBlog | null>(blog ?? null);
  const [publisher] = useState<Author | null>(() => (blog ? (byId.get(blog.authorIds[0]) ?? null) : me));
  const [history, setHistory] = useState<History<Draft>>(() => startHistory(draftOf(blog)));
  const touched = useRef(false);
  const draft = history.present;
  const { title, description, tags, content: text, coverImage, category, featuredRank, leadMagnetId, ctaKey, offers } = draft;
  const coauthors = useMemo(() => draft.coauthorIds.flatMap((id) => byId.get(id) ?? []), [draft.coauthorIds, byId]);

  const [errors, setErrors] = useState<Partial<Record<PublishField, string>>>({});
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<View>("editor");
  const [preview, setPreview] = useState<{ version: Version; offers: Preview } | null>(null);
  const [previewing, setPreviewing] = useState<View | null>(null);

  const status = post?.status ?? "DRAFT";
  const published = status === "PUBLISHED";

  // Lists compare by value: the tags input re-sends its list on mount, which is not an edit.
  const set = <K extends keyof Draft>(key: K, value: Draft[K], group: string | null = TYPING_FIELDS.has(key) ? key : null) => {
    const current = history.present[key];
    if (Object.is(current, value) || (Array.isArray(value) && JSON.stringify(current) === JSON.stringify(value))) return;
    touched.current = true;
    setHistory((h) => record(h, { ...h.present, [key]: value }, group));
  };

  // A typing pause closes the run, so the next keystroke starts a new undo step.
  useEffect(() => {
    if (history.pending === null) return;
    const timer = window.setTimeout(() => setHistory(settle), TYPING_PAUSE_MS);
    return () => window.clearTimeout(timer);
  }, [history]);

  const doUndo = useCallback(() => setHistory(undo), []);
  const doRedo = useCallback(() => setHistory(redo), []);

  // One undo stack for the whole form, the rich-text body included: the keys are
  // taken before the focused input (or Quill's own history) can act on them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === "z" && !e.shiftKey;
      const isRedo = (key === "z" && e.shiftKey) || key === "y";
      if (!isUndo && !isRedo) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('[role="dialog"], iframe')) return;
      e.preventDefault();
      e.stopPropagation();
      if (isUndo) doUndo();
      else doRedo();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [doUndo, doRedo]);

  const categoryOptions: Option[] = BLOG_CATEGORIES.map((c) => ({ value: c.slug, label: c.name }));
  const magnetOptions: Option[] = [AUTO_OPTION, ...magnets.map((m) => ({ value: m.id, label: m.title }))];
  const ctaOptions: Option[] = [AUTO_OPTION, NO_CTA_OPTION, ...ctas.map((c) => ({ value: c.key, label: c.name }))];
  const coauthorOptions = authors.filter((a) => a.id !== publisher?.id).map(authorOption);
  const suggested = useMemo(() => (category ? null : inferCategory(tags)), [category, tags]);
  const chosenCategory = category || suggested?.slug || "job-search";
  const markers = useMemo(() => markerSummary(normalizeEditorHtml(text)), [text]);
  const effectiveSlug = useMemo(() => {
    if (draft.slugTouched && draft.slug.trim()) return slugifyTitle(draft.slug);
    if (published && post) return post.slug;
    return title.trim() ? slugifyTitle(title) : (post?.slug ?? "");
  }, [draft.slug, draft.slugTouched, published, post, title]);
  const slugChanged = published && Boolean(post) && effectiveSlug !== post?.slug;
  const handPlaced = markers.cta.length + markers.magnet.length > 0;
  const allAuthors = publisher ? [publisher, ...coauthors] : coauthors;

  const toPayload = useCallback(
    async (d: Draft): Promise<Partial<BlogInput>> => ({
      title: d.title,
      description: d.description,
      tags: d.tags,
      authorIds: [...(publisher ? [publisher.id] : []), ...d.coauthorIds],
      coverImage: d.coverImage,
      slug: d.slugTouched && d.slug.trim() ? slugifyTitle(d.slug) : undefined,
      category: d.category || inferCategory(d.tags)?.slug || "job-search",
      featuredRank: d.featuredRank ? Number(d.featuredRank) : null,
      leadMagnetId: d.leadMagnetId || null,
      ctaKey: d.ctaKey || null,
      inlineOffers: d.offers.map(offerToken),
      autoCtas: false,
      // Before the server action: base64 images would be dropped on the page, and can exceed its 1MB body limit.
      content: await hostInlineImages(normalizeEditorHtml(d.content), hostedImages.current),
    }),
    [publisher],
  );

  const autosave = useBlogAutosave({
    id: blog?.id ?? null,
    snapshot: draft,
    pristine: !touched.current,
    toPayload,
    onSaved: (saved, created) => {
      setPost(saved);
      // The draft now exists: later loads (a refresh, the back button) open it rather than a blank form.
      if (created) window.history.replaceState(null, "", `/heroshima/blogs/${saved.id}/edit`);
    },
  });

  const notUpdated = published && (Boolean(post?.hasPendingEdit) || autosave.dirty);

  const offerLabel = (o: OfferRef) => {
    if (o.kind === "cta") return o.ref === AUTO ? "Auto: the product CTA" : (ctas.find((c) => c.key === o.ref)?.name ?? `CTA "${o.ref}"`);
    return o.ref === AUTO ? "Auto: the sidebar offer" : (magnets.find((m) => m.slug === o.ref)?.title ?? `Download "${o.ref}"`);
  };
  const addOffer = (o: OfferRef) => set("offers", [...offers, o]);
  const removeOffer = (i: number) => set("offers", offers.filter((_, j) => j !== i));
  const moveOffer = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= offers.length) return;
    const next = [...offers];
    [next[i], next[j]] = [next[j], next[i]];
    set("offers", next);
  };

  const editedVersion = (): Version => ({
    title,
    slug: effectiveSlug,
    description,
    content: text,
    coverImage,
    tags,
    category: chosenCategory,
    leadMagnetId: leadMagnetId || null,
    ctaKey: ctaKey || null,
    inlineOffers: offers.map(offerToken),
    authorIds: allAuthors.map((a) => a.id),
  });

  const liveVersion = (p: EditableBlog): Version => ({
    title: p.title,
    slug: p.slug,
    description: p.description,
    content: p.content,
    coverImage: p.coverImage,
    tags: p.tags,
    category: p.category,
    leadMagnetId: p.leadMagnetId,
    ctaKey: p.ctaKey,
    inlineOffers: effectiveInlineOffers(p).map(offerToken),
    authorIds: p.authorIds,
  });

  const switchView = async (next: View) => {
    if (next === "editor") {
      setView("editor");
      return;
    }
    const version = next === "live" && post ? liveVersion(post) : editedVersion();
    setPreviewing(next);
    try {
      const content = await hostInlineImages(version.content, hostedImages.current);
      const offersFor = await previewBlog({ content, category: version.category, tags: version.tags, leadMagnetId: version.leadMagnetId, ctaKey: version.ctaKey, inlineOffers: version.inlineOffers });
      setPreview({ version: { ...version, content }, offers: offersFor });
      setView(next);
    } catch (error) {
      toast.error(`Could not build the preview: ${actionErrorMessage(error)}`);
    } finally {
      setPreviewing(null);
    }
  };

  /** What still stops the post going live, checked the way the backend's missingForPublish does. */
  const missingNow = (): PublishField[] => {
    const body = text.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    const missing: PublishField[] = [];
    if (!title.trim()) missing.push("title");
    if (!description.trim()) missing.push("description");
    if (tags.length === 0) missing.push("tags");
    if (!body && !/<img\b/i.test(text)) missing.push("content");
    if (allAuthors.length === 0) missing.push("authors");
    if (!coverImage.trim()) missing.push("coverImage");
    return missing;
  };

  const publish = async () => {
    const missing = missingNow();
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((f) => [f, FIELD_ERRORS[f]])));
      if (view !== "editor") setView("editor");
      window.setTimeout(() => document.querySelector(`[data-field="${missing[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
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
    setBusy(true);
    try {
      // Whatever is still waiting for the debounce goes first, so what goes live is what's on screen.
      const id = await autosave.flush();
      if (!id) {
        toast.error("Could not save the draft. Try again.");
        return;
      }
      const res = await publishBlog(id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setPost(res.data);
      toast.success(published ? "Live post updated" : "Blog published");
    } catch (err: unknown) {
      toast.error(`Could not publish: ${actionErrorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!post || !window.confirm("Discard your edits and go back to the live version?")) return;
    setBusy(true);
    try {
      await autosave.flush();
      const res = await discardBlogEdit(post.id);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      const fresh = draftOf(res.data);
      setPost(res.data);
      setHistory(startHistory(fresh));
      autosave.markSaved(fresh);
      touched.current = false;
      setView("editor");
      toast.success("Edits discarded");
    } catch (err: unknown) {
      toast.error(`Could not discard: ${actionErrorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  };

  // The first touch of any field after a failed publish clears every error at once.
  const clearErrors = (e: SyntheticEvent) => {
    if (Object.keys(errors).length === 0) return;
    if ((e.target as HTMLElement).closest("[data-publish]")) return;
    setErrors({});
  };

  const invalid = (field: PublishField) => Boolean(errors[field]);
  const labelFor = (field: PublishField, text: string) => (
    <label className={cn(ADMIN_LABEL, invalid(field) && "text-[#b23c26]")}>
      {text}
      {invalid(field) && <span className="ml-2 text-xs font-semibold">{errors[field]}</span>}
    </label>
  );
  const inputClass = (field: PublishField) => cn(ADMIN_INPUT, invalid(field) && "border-[#b23c26]");

  const previewVersion = preview?.version;
  const previewPost = previewVersion && {
    slug: previewVersion.slug,
    title: previewVersion.title || "Untitled post",
    description: previewVersion.description,
    coverImage: previewVersion.coverImage,
    tags: previewVersion.tags,
    status: view === "live" ? ("PUBLISHED" as const) : status,
    createdAt: post?.createdAt ?? new Date(),
    updatedAt: view === "live" && post ? post.updatedAt : new Date(),
    publishedAt: post?.publishedAt ?? null,
    authors: previewVersion.authorIds.flatMap((id) => byId.get(id) ?? []),
  };

  const primaryLabel = busy ? (published ? "Updating…" : "Publishing…") : published ? "Update" : "Publish";
  const primaryDisabled = busy || (published && !notUpdated);
  const PrimaryButton = (
    <button
      type="button"
      data-publish
      onClick={publish}
      disabled={primaryDisabled}
      title={published && !notUpdated ? "Up to date" : undefined}
      className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3 hover:rounded-md disabled:opacity-50">
      {published ? <RefreshCw className="w-5 h-5 mr-2" /> : <PlusCircle className="w-6 h-6 mr-2" />}
      {primaryLabel}
    </button>
  );

  return (
    <div className="w-full p-4 pt-16" onFocusCapture={clearErrors} onInputCapture={clearErrors}>
      <BlogEditPill
        canUndo={canUndo(history)}
        canRedo={canRedo(history)}
        onUndo={doUndo}
        onRedo={doRedo}
        status={autosave.status}
        onRetry={() => void autosave.flush()}
        savedLabel={published ? "Edits saved" : undefined}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{post ? "Edit blog" : "Create new blog"}</h1>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${published ? "bg-[#e1f073] text-[#222325]" : "bg-[#fdeae6] text-[#b23c26]"}`}>{published ? "Published" : "Draft"}</span>
          {notUpdated && <span className="rounded-full bg-[#fdf4f2] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#b23c26]" data-not-updated>Not updated</span>}
          {published && post?.hasPendingEdit && (
            <button type="button" onClick={discard} disabled={busy} className="text-xs font-semibold text-gray-500 underline underline-offset-2 hover:text-[#b23c26] disabled:opacity-50">
              Discard changes
            </button>
          )}
        </div>
        <ViewToggle view={view} loading={previewing} hasLive={published} onChange={switchView} />
      </div>

      {view !== "editor" && preview && previewPost && (
        <div className="mb-6 overflow-clip rounded-[20px] border-2 br-shadow br-lime" data-preview={view}>
          <div className="flex items-center gap-3 border-b-2 border-[#222325] bg-[#222325] px-4 py-2 text-white">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#e1f073]">{view === "live" ? "Live version" : "Edited version"}</span>
            <span className="text-xs text-white/60">
              {view === "live" ? "What readers see right now." : published ? "Your saved edits. Readers see them once you press Update." : "Exactly what readers will see, conversions included."}
            </span>
          </div>
          <Article
            data={{ post: previewPost, category: categoryBySlug(previewVersion!.category) ?? null, ...preview.offers, featured: [], related: [] }}
            rendered={preview.offers.rendered}
          />
        </div>
      )}

      <form onSubmit={(e) => e.preventDefault()} className={view !== "editor" ? "hidden" : "space-y-4"}>
        <div data-field="title">
          {labelFor("title", "Title")}
          <input type="text" value={title} onChange={(e) => set("title", e.target.value)} placeholder="Enter blog title" className={inputClass("title")} aria-invalid={invalid("title")} />
        </div>
        <div>
          <label className={ADMIN_LABEL}>URL</label>
          <div className="mt-1 flex items-center gap-0 rounded-md border border-gray-300 bg-white px-2">
            <span className="select-none whitespace-nowrap py-2 text-sm text-gray-400">/blogs/</span>
            <input
              type="text"
              value={draft.slugTouched ? draft.slug : effectiveSlug}
              onChange={(e) => {
                const value = e.target.value;
                touched.current = true;
                setHistory((h) => record(h, { ...h.present, slug: value, slugTouched: true }, "slug"));
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
        <div data-field="description">
          {labelFor("description", "Description (the dek under the title, and the card summary)")}
          <textarea value={description} onChange={(e) => set("description", e.target.value)} placeholder="One or two sentences." className={inputClass("description")} aria-invalid={invalid("description")} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div data-field="tags" className={cn(invalid("tags") && "[&_.rti--container]:!border-[#b23c26]")}>
            {labelFor("tags", "Tags")}
            <TagsInput value={tags} placeHolder="Enter tags" classNames={{ input: ADMIN_INPUT }} onChange={(next) => set("tags", next)} name="tags" />
          </div>
          <div data-authors data-field="authors">
            {labelFor("authors", "Authors")}
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {publisher && (
                <span className="inline-flex items-center gap-2 rounded-full border-2 border-[#222325] bg-[#e1f073] py-1 pl-1 pr-3 text-xs font-bold text-[#222325]" data-publisher>
                  <span className="relative h-6 w-6 overflow-hidden rounded-full border border-[#222325]">
                    <Image src={publisher.profileImage} alt="" fill sizes="24px" className="object-cover" />
                  </span>
                  {publisher.name}
                  <span className="rounded-full bg-[#222325] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#e1f073]">{blog ? "Publisher" : "You · publisher"}</span>
                </span>
              )}
              <Select
                theme={SELECT_THEME}
                isMulti
                value={coauthors.map(authorOption)}
                onChange={(v) => set("coauthorIds", v.map((o) => o.value))}
                options={coauthorOptions}
                placeholder={publisher ? "Add co-authors" : "Select authors"}
                className="min-w-[240px] flex-1"
                aria-label="Co-authors"
              />
            </div>
            <p className={ADMIN_HINT}>
              {publisher ? "The publisher is always listed first." : "No author profile is linked to your account. The first author you pick becomes the publisher."}
            </p>
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
                onChange={(v) => set("category", v?.value ?? "")}
                options={categoryOptions}
                placeholder={suggested ? `Auto: ${suggested.name}` : "Select category"}
                className="mt-1"
                isClearable
              />
              {!category && suggested && <p className={ADMIN_HINT}>Suggested from tags: {suggested.name}</p>}
            </div>
            <div>
              <label className={ADMIN_LABEL}>Start here rank</label>
              <select value={featuredRank} onChange={(e) => set("featuredRank", e.target.value)} className={ADMIN_INPUT}>
                <option value="">Not hand-picked</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n}
                    {n === 1 ? " - the lead" : ""}
                  </option>
                ))}
              </select>
              <p className={ADMIN_HINT}>Hand-picked posts show on the blog landing page and in every sidebar.</p>
            </div>
            <div>
              <label className={ADMIN_LABEL}>Sidebar offer</label>
              <Select theme={SELECT_THEME} value={magnetOptions.find((o) => o.value === leadMagnetId) ?? AUTO_OPTION} onChange={(v) => set("leadMagnetId", v?.value ?? "")} options={magnetOptions} className="mt-1" />
            </div>
            <div>
              <label className={ADMIN_LABEL}>Product CTA (closes the post)</label>
              <Select theme={SELECT_THEME} value={ctaOptions.find((o) => o.value === ctaKey) ?? AUTO_OPTION} onChange={(v) => set("ctaKey", v?.value ?? "")} options={ctaOptions} className="mt-1" />
            </div>
          </div>

          <div className="mt-4 rounded-md border border-gray-200 bg-white p-3" data-offers>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-primary">Inside the article</p>
              <p className="text-xs text-gray-500">{offers.length === 0 ? "Nothing in the body" : `${offers.length} placed before section headings`}</p>
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
                <option value={AUTO}>Auto: the product CTA</option>
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
                <option value={AUTO}>Auto: the sidebar offer</option>
                {magnets.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
            <p className={ADMIN_HINT}>
              {handPlaced
                ? `This post has ${markers.cta.length + markers.magnet.length} marker(s) typed in the text. Those positions win and this list is ignored.`
                : "Want one at an exact spot? Type [[cta:key]] or [[magnet:slug]] on its own line in the text. Conversions only show in Preview."}
            </p>
          </div>
        </div>

        <div data-field="coverImage">
          {labelFor("coverImage", "Cover image")}
          <div className={cn("mt-1 mb-2 w-6/12 rounded-md p-1 outline outline-2", invalid("coverImage") ? "outline-[#b23c26]" : "outline-gray-300")}>
            {coverImage ? <Image src={coverImage} alt="" width={1080} height={720} className="aspect-video w-full rounded object-cover" /> : <NoImage className="aspect-video w-full rounded" />}
          </div>
          <CldUploadWidget
            options={{ sources: ["local", "url", "unsplash"], folder: "blogs" }}
            uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_PRESET}
            onSuccess={(result) => {
              const info = result?.info;
              if (info && typeof info !== "string" && info.secure_url) set("coverImage", info.secure_url);
            }}
            onQueuesEnd={(_r, { widget }) => closeUploadWidget(widget)}>
            {({ open }) => (
              <button type="button" onClick={() => open()} className="drop-shadow-primary2-hover transition-all bg-black text-base text-white border-2 border-primary font-bold h-10 rounded-sm px-0.5 w-6/12 mb-1">
                {coverImage ? "Replace cover image" : "Upload cover image"}
              </button>
            )}
          </CldUploadWidget>
        </div>

        <div data-field="content">
          {labelFor("content", "Content")}
          <div
            ref={editorWrap}
            className={cn("relative", invalid("content") && "[&_.ql-container.ql-snow]:!border-[#b23c26] [&_.ql-toolbar.ql-snow]:!border-[#b23c26]")}
            onMouseDown={(e) => {
              const quill = quillRef.current?.getEditor();
              if (quill) exitTrailingBlock(quill, e);
            }}>
            <QuillEditor
              forwardedRef={quillRef}
              value={text}
              theme="snow"
              onChange={(value, _delta, source) => {
                // Only the writer's own typing is an edit. Quill reshaping HTML it was handed (on load,
                // or after an undo) just keeps the snapshot in step, so it never becomes an undo step.
                if (source === "user") set("content", value);
                else setHistory((h) => (h.present.content === value ? h : { ...h, present: { ...h.present, content: value } }));
              }}
              modules={quillModules}
              placeholder="Write the post"
              className="post-editor mt-1"
            />
            <TableBar quillRef={quillRef} wrapRef={editorWrap} />
          </div>
          <p className={ADMIN_HINT}>
            Tables: the table button adds one at the cursor. Hover a table for its controls. The letter switches the style: F = Full (first row is the heading), R = Rows only, L = Rows only with column labels.
          </p>
          <p className={ADMIN_HINT}>
            Quotes: to credit a source, end the quote with a line starting with “---” (e.g. “--- Jane Doe[link here]”). It can be a link. Leave it out for no source. Press Enter on an empty quote line, or click below the quote, to carry on with normal text.
          </p>
          {/* Opened by the toolbar's image button. The widget keeps its first callbacks, so they read refs only. */}
          <CldUploadWidget
            options={{ sources: ["local", "url", "unsplash"], folder: "blogs", multiple: false }}
            uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_PRESET}
            onSuccess={(result) => {
              const info = result?.info;
              const quill = quillRef.current?.getEditor();
              if (quill && imageRange.current && info && typeof info !== "string" && info.secure_url) insertImages(quill, imageRange.current, [info.secure_url]);
            }}
            onQueuesEnd={(_r, { widget }) => closeUploadWidget(widget)}>
            {({ open, isLoading }) => (
              <button type="button" ref={imagePicker} hidden onClick={() => (isLoading ? toast.info("The image picker is still loading. Try again in a moment.") : open())} />
            )}
          </CldUploadWidget>
        </div>

        <div className="flex justify-center">{PrimaryButton}</div>
      </form>

      {view !== "editor" && <div className="flex justify-center">{PrimaryButton}</div>}
    </div>
  );
};

export default BlogForm;
