"use client";

import { useCallback, useEffect, useRef, useState, type FC, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Braces, LoaderCircle, Monitor, Smartphone, SlidersHorizontal, Trash2 } from "lucide-react";
import { getMailSettings } from "@/libs/mail-admin";
import { BLOCK_LABELS, DEFAULT_DESIGN, type Block, type BlockType, type MailDesign, type TemplateContent } from "@/app/lib/mail/types";
import { cn } from "@/lib/utils";
import BlockEditor, { IconButton } from "../BlockEditor";
import ContentFields from "../ContentFields";
import { ErrorBox } from "../ui";
import BlockFields, { type OfferContext } from "./BlockFields";
import BlockOutline, { AddBlockMenu } from "./BlockOutline";
import DesignPanel from "./DesignPanel";
import Fold from "./Fold";
import InboxLine from "./InboxLine";
import MailFrame, { type CanvasField, type MailFrameHandle } from "./MailFrame";
import PreviewUserPicker from "./PreviewUserPicker";
import TestSend from "./TestSend";
import { VarMenu } from "./TextField";
import { BLOCK_ICONS, freshBlock } from "./blocks";
import { canvasPatches, withCanvasText } from "./canvasText";
import { useDismiss } from "./useDismiss";
import { usePreview } from "./usePreview";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const WIDTHS = { phone: 375, desktop: 680 } as const;

type Props = {
  content: TemplateContent;
  onChange: (content: TemplateContent) => void;
  /** The brand default look from Outreach settings. Left out: read here. */
  brandDesign?: MailDesign | null;
  /** A campaign's mail must name who can get it (no "No pref"). */
  prefRequired?: boolean;
  /** The offer around this mail (a campaign's picker and its page). */
  offer?: OfferContext;
  /** Show the mail without editing it (a campaign using a template): this panel replaces the inspector. */
  locked?: ReactNode;
  /** The page keeps a sticky bar at the top (the template's save bar): the inspector and outline stick below it. */
  underBar?: boolean;
};

/**
 * The content editor: the rendered mail is the canvas. Above it the inbox line (from, subject,
 * preview) is edited in place; beside it a compact outline of the blocks; on the right an inspector
 * with the picked block's fields (Content) or the mail's look (Design). Clicking a part of the mail
 * picks it once the renderer marks blocks (previewMail markBlocks); until then the outline picks.
 * In Edit the canvas is the editor render: its text (headings, paragraphs, button labels, the offer
 * box's lines) is typed into in place, variables shown as tokens, and each keystroke lands in the
 * content at once; the server's render follows once the caret leaves (MailFrame). Preview asks
 * without markBlocks, so the sample data or the person previewed as fill real values.
 * When the preview fails, the plain block list takes the canvas's place so the mail stays editable.
 */
const MailEditor: FC<Props> = ({ content, onChange, brandDesign, prefRequired, offer, locked, underBar }) => {
  const [picked, setPicked] = useState<number | null>(null);
  // Edit: canvas, block list and inspector. Preview: only the mail, as the reader gets it.
  const [view, setView] = useState<"edit" | "preview">("edit");
  const previewing = view === "preview";
  const [tab, setTab] = useState<"content" | "design">("content");
  const [width, setWidth] = useState<keyof typeof WIDTHS>("desktop");
  const [sampleOffer, setSampleOffer] = useState(true);
  const [asUser, setAsUser] = useState("");
  const [marked, setMarked] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [fetchedBrand, setFetchedBrand] = useState<MailDesign | null>(null);
  // The canvas field with the caret (null: none), and the canvas's Variable menu.
  const [canvasField, setCanvasField] = useState<{ index: number; field: CanvasField } | null>(null);
  const [varMenu, setVarMenu] = useState(false);
  const frameApi = useRef<MailFrameHandle>(null);

  const blocks = content.blocks;
  const selected = picked !== null && picked < blocks.length ? picked : null;
  const userId = OBJECT_ID.test(asUser.trim()) ? asUser.trim() : "";
  const empty = !blocks.length && !content.subject.trim();
  // Edit shows the editor render (fields and variable tokens); Preview and a locked mail show real values.
  const editing = !locked && !previewing;
  const preview = usePreview({ content, sampleOffer, userId, markBlocks: editing }, !empty);
  const brand = brandDesign === undefined ? fetchedBrand : (brandDesign ?? DEFAULT_DESIGN);

  // The brand default, when the page didn't pass it.
  useEffect(() => {
    if (brandDesign !== undefined) return;
    let live = true;
    getMailSettings().then(
      (res) => live && setFetchedBrand(res.data?.design ?? DEFAULT_DESIGN),
      () => live && setFetchedBrand(DEFAULT_DESIGN),
    );
    return () => {
      live = false;
    };
  }, [brandDesign]);

  const setBlocks = (next: Block[]) => onChange({ ...content, blocks: next });
  const pick = (index: number | null) => {
    setPicked(index);
    setConfirmDelete(null);
    if (index !== null) setTab("content");
  };
  const insert = (at: number, type: BlockType) => {
    const next = [...blocks];
    next.splice(at, 0, freshBlock(type));
    setBlocks(next);
    pick(at);
  };
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
    setPicked(j);
  };
  const remove = (i: number) => {
    setBlocks(blocks.filter((_, j) => j !== i));
    pick(null);
  };
  // Typed in the canvas: into the content at once (the frame already shows it), and that block picked.
  const editFromCanvas = (index: number, field: CanvasField, text: string) => {
    const block = blocks[index];
    const next = block ? withCanvasText(block, field, text) : null;
    if (!next) return;
    setVarMenu(false);
    setBlocks(blocks.map((b, j) => (j === index ? next : b)));
    if (selected !== index) pick(index);
  };
  const focusFromCanvas = (at: { index: number; field: CanvasField } | null) => {
    setCanvasField(at);
    if (!at) setVarMenu(false);
    else if (selected !== at.index) pick(at.index);
  };
  // Changed in the inspector: the canvas redraws those fields at once, before the server's render arrives.
  const changeFromInspector = (index: number, block: Block) => {
    const patches = canvasPatches(blocks[index], block);
    setBlocks(blocks.map((x, j) => (j === index ? block : x)));
    for (const p of patches) frameApi.current?.patch(index, p.field, p.text);
  };

  const canvasBody = empty ? (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-sm text-gray-500">Write a subject or add a block to see the mail.</p>
      {!locked && !previewing ? <AddBlockMenu onPick={(type) => insert(0, type)} className="w-48" /> : null}
    </div>
  ) : preview.error && !preview.rendered ? (
    // Never drawn: the plain block list stands in for the canvas, so the mail stays editable.
    <div className="flex flex-col gap-3">
      <ErrorBox>
        The preview couldn&apos;t be drawn: {preview.error}{" "}
        <button type="button" onClick={preview.retry} className="font-semibold underline">
          Try again
        </button>
      </ErrorBox>
      {locked || previewing ? null : (
        <div className="rounded-md border border-gray-300 bg-white p-3">
          <p className="mb-2 text-xs text-gray-600">You can keep editing the blocks here meanwhile.</p>
          <BlockEditor blocks={blocks} onChange={setBlocks} offer={offer} />
        </div>
      )}
    </div>
  ) : preview.rendered ? (
    <div className="flex flex-col gap-3">
      {preview.error ? (
        // Drawn before: keep the last picture (faded) while the newest edit can't be drawn.
        <ErrorBox>
          The latest change couldn&apos;t be drawn: {preview.error}{" "}
          <button type="button" onClick={preview.retry} className="font-semibold underline">
            Try again
          </button>
        </ErrorBox>
      ) : null}
      <div className={cn(preview.error && "opacity-50")}>
        <MailFrame
          ref={frameApi}
          html={preview.rendered.html}
          width={WIDTHS[width]}
          minHeight={480}
          interactive={editing}
          selected={previewing ? null : selected}
          blockCount={blocks.length}
          onSelect={(index) => {
            setVarMenu(false);
            pick(index);
          }}
          onMarked={setMarked}
          onEdit={editFromCanvas}
          onFieldFocus={focusFromCanvas}
          onVarMenu={() => setVarMenu(true)}
          upToDate={preview.upToDate}
        />
      </div>
    </div>
  ) : (
    <p className="py-16 text-center text-sm text-gray-500">Drawing the mail...</p>
  );

  return (
    <div className="flex flex-col gap-3">
      <InboxLine content={content} onChange={onChange} shownSubject={preview.rendered?.subject} disabled={Boolean(locked) || previewing} />

      <div className={cn("grid items-start gap-4", !previewing && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        {/* At least a screen tall (the inspector's own cap), so the canvas fills the editor instead of
            stopping under a short mail; the 1fr rows hand the extra height to the grey canvas. */}
        <section
          aria-label="Mail"
          className={cn(
            "grid min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] overflow-clip rounded-md border border-gray-300 bg-white",
            underBar ? "lg:min-h-[calc(100vh-5rem)]" : "lg:min-h-[calc(100vh-2rem)]",
          )}>
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 px-3 py-2">
            <div className="inline-flex rounded-md border border-gray-300 p-0.5" role="radiogroup" aria-label="Mode">
              {(
                [
                  { value: "edit", label: "Edit" },
                  { value: "preview", label: "Preview" },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={view === value}
                  onClick={() => setView(value)}
                  className={cn("rounded px-2.5 py-1 text-xs font-bold", view === value ? "bg-black text-[#e1f073]" : "text-gray-600 hover:text-black")}>
                  {label}
                </button>
              ))}
            </div>
            <span aria-hidden className="h-5 w-px bg-gray-200" />
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Width">
              {(
                [
                  { value: "phone", label: "Phone", Icon: Smartphone },
                  { value: "desktop", label: "Desktop", Icon: Monitor },
                ] as const
              ).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={width === value}
                  onClick={() => setWidth(value)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold",
                    width === value ? "bg-black text-[#e1f073]" : "text-gray-600 hover:bg-gray-100 hover:text-black",
                  )}>
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
                </button>
              ))}
            </div>
            {editing ? (
              <CanvasVariable
                enabled={canvasField !== null}
                open={varMenu && canvasField !== null}
                setOpen={setVarMenu}
                onPick={(name) => {
                  setVarMenu(false);
                  frameApi.current?.insertVar(name);
                }}
              />
            ) : null}
            <PreviewOptions sampleOffer={sampleOffer} setSampleOffer={setSampleOffer} asUser={asUser} setAsUser={setAsUser} />
            {preview.loading ? <LoaderCircle className="h-4 w-4 animate-spin text-gray-500" aria-label="Updating the preview" /> : null}
            <div className="ml-auto">
              <TestSend content={content} userId={userId} disabled={empty} />
            </div>
          </div>

          <div className={cn("grid", locked || previewing ? "grid-rows-[1fr]" : "grid-rows-[auto_1fr] xl:grid-cols-[190px_minmax(0,1fr)] xl:grid-rows-[1fr]")}>
            {locked || previewing ? null : (
              <div className="border-b border-gray-200 p-2 xl:border-b-0 xl:border-r">
                <div className={cn("xl:sticky", underBar ? "xl:top-16" : "xl:top-4")}>
                  <BlockOutline blocks={blocks} selected={selected} onSelect={pick} onInsert={insert} />
                  {marked === 0 && blocks.length && preview.rendered && !preview.error ? (
                    <p className="mt-3 px-1 text-[11px] leading-snug text-gray-500">Pick a block here to edit it. Clicking inside the mail works once the mail service marks blocks.</p>
                  ) : null}
                </div>
              </div>
            )}
            <div className="min-w-0 overflow-x-auto bg-gray-100 p-3 sm:p-4">{canvasBody}</div>
          </div>
        </section>

        <aside
          aria-label="Inspector"
          hidden={previewing}
          className={cn(
            "min-w-0 rounded-md border border-gray-300 bg-white lg:sticky lg:overflow-y-auto",
            underBar ? "lg:top-16 lg:max-h-[calc(100vh-5rem)]" : "lg:top-4 lg:max-h-[calc(100vh-2rem)]",
          )}>
          {locked ? (
            <div className="p-4">{locked}</div>
          ) : (
            <>
              <div role="tablist" aria-label="Inspector" className="flex border-b border-gray-200 px-2">
                {(
                  [
                    { value: "content", label: "Content" },
                    { value: "design", label: "Design" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.value}
                    onClick={() => setTab(t.value)}
                    className={cn("-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold", tab === t.value ? "border-black text-black" : "border-transparent text-gray-500 hover:text-black")}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {tab === "design" ? (
                  <DesignPanel design={content.design} brand={brand} onChange={(design) => onChange({ ...content, design })} />
                ) : selected !== null ? (
                  <BlockInspector
                    block={blocks[selected]}
                    index={selected}
                    count={blocks.length}
                    offer={offer}
                    confirmDelete={confirmDelete === selected}
                    onChange={(b) => changeFromInspector(selected, b)}
                    onMove={(by) => move(selected, by)}
                    onDelete={() => (confirmDelete === selected ? remove(selected) : setConfirmDelete(selected))}
                    onCancelDelete={() => setConfirmDelete(null)}
                    onDone={() => pick(null)}
                  />
                ) : (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-gray-600">
                      {marked ? "Click any text in the mail to type in it. Click any other part, or pick a block from the list, to edit it here." : "Pick a block from the list to edit it."}
                    </p>
                    <Fold title="Mail settings" variant="line" className="border-t border-gray-200 pt-2" summary={mailSettingsSummary(content)}>
                      <ContentFields content={content} onChange={onChange} prefRequired={prefRequired} />
                    </Fold>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

const mailSettingsSummary = (c: TemplateContent) =>
  [c.pref === "emailOffers" ? "Offers on" : c.pref === "emailProductNews" ? "Product news on" : "No pref", c.feedbackFooter ? "Yes / No footer" : null].filter(Boolean).join(" · ");

/** The picked block: its type, where it sits, move and delete, then its fields. */
const BlockInspector: FC<{
  block: Block;
  index: number;
  count: number;
  offer?: OfferContext;
  confirmDelete: boolean;
  onChange: (block: Block) => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
  onCancelDelete: () => void;
  onDone: () => void;
}> = ({ block, index, count, offer, confirmDelete, onChange, onMove, onDelete, onCancelDelete, onDone }) => {
  const Icon = BLOCK_ICONS[block.type];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded bg-[#e1f073]">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight">{BLOCK_LABELS[block.type]}</p>
          <p className="text-[11px] text-gray-500">
            Block {index + 1} of {count}
          </p>
        </div>
        <span className="ml-auto flex gap-1">
          <IconButton label="Move up" onClick={() => onMove(-1)} disabled={index === 0}>
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
          <IconButton label="Move down" onClick={() => onMove(1)} disabled={index === count - 1}>
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
          <IconButton label="Delete block" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5 text-[#b23c26]" aria-hidden />
          </IconButton>
        </span>
      </div>
      {confirmDelete ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-md border border-[#f3c4b8] bg-[#fdeae6] px-3 py-2 text-xs text-[#b23c26]">
          Delete this block?
          <button type="button" onClick={onDelete} className="rounded bg-[#b23c26] px-2 py-0.5 font-bold text-white">
            Delete
          </button>
          <button type="button" onClick={onCancelDelete} className="font-semibold text-gray-600">
            Keep it
          </button>
        </div>
      ) : null}
      <BlockFields block={block} onChange={onChange} offer={offer} />
      <button type="button" onClick={onDone} className="self-start text-xs font-semibold text-gray-500 hover:text-black">
        Done
      </button>
    </div>
  );
};

/**
 * The canvas's Variable menu: puts a variable token where the caret is in the mail. Usable while a
 * field in the canvas has the caret; pressing it never takes the focus, so the caret stays put.
 */
const CanvasVariable: FC<{ enabled: boolean; open: boolean; setOpen: (open: boolean) => void; onPick: (name: string) => void }> = ({ enabled, open, setOpen, onPick }) => {
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useDismiss(box, open, close);
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={!enabled}
        title={enabled ? "Put a variable where the caret is" : "Click into the mail's text first"}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-100 hover:text-black disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent">
        <Braces className="h-3.5 w-3.5" aria-hidden /> Variable
      </button>
      {open ? <VarMenu onPick={onPick} keepFocus className="left-0" /> : null}
    </div>
  );
};

/** The preview's options, folded: the sample offer and "preview as" a user. */
const PreviewOptions: FC<{ sampleOffer: boolean; setSampleOffer: (v: boolean) => void; asUser: string; setAsUser: (v: string) => void }> = ({ sampleOffer, setSampleOffer, asUser, setAsUser }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(box, open, close);
  // The name of the person picked to preview as; the editor itself keeps only their id.
  const [asWho, setAsWho] = useState<{ id: string; label: string } | null>(null);
  const changed = !sampleOffer || Boolean(asUser.trim());
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold hover:bg-gray-100", changed ? "text-black" : "text-gray-600")}>
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Sample data{changed ? " (changed)" : ""}
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 flex w-72 flex-col gap-3 rounded-md border border-gray-300 bg-white p-3 text-xs">
          <label className="flex items-center gap-2 font-semibold text-gray-700">
            <input type="checkbox" checked={sampleOffer} onChange={(e) => setSampleOffer(e.target.checked)} /> Fill the offer box with a sample offer
          </label>
          <div className="flex flex-col gap-1 font-semibold text-gray-700">
            Preview as someone
            <PreviewUserPicker
              value={asUser && asWho?.id === asUser ? asWho : null}
              onChange={(picked) => {
                setAsWho(picked);
                setAsUser(picked?.id ?? "");
              }}
            />
          </div>
          <button type="button" onClick={close} className="self-end font-semibold text-gray-500 hover:text-black">
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default MailEditor;
