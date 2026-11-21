"use client";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type FC, type Ref } from "react";
import { withFrameScript } from "./frameScript";

/** The fields the editor render lets the canvas type into (heading/paragraph text, button label, offer lines). */
export const CANVAS_FIELDS = ["text", "label", "kicker", "headline", "button"] as const;
export type CanvasField = (typeof CANVAS_FIELDS)[number];

/** Longer than any field the backend keeps (a paragraph's 5000): anything past it is not a real edit. */
const MAX_TEXT = 20_000;

type FrameMessage =
  | { type: "rww-size"; height: number; marked: number }
  | { type: "rww-block"; index: number | null }
  | { type: "rww-at"; top: number; bottom: number }
  | { type: "rww-focus"; index: number; field: CanvasField }
  | { type: "rww-blur" }
  | { type: "rww-edit"; index: number; field: CanvasField; text: string }
  | { type: "rww-var-menu" };

const isIndex = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isField = (value: unknown): value is CanvasField => typeof value === "string" && (CANVAS_FIELDS as readonly string[]).includes(value);

const isMessage = (data: unknown): data is FrameMessage => {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  switch (d.type) {
    case "rww-size":
      return typeof d.height === "number" && typeof d.marked === "number";
    case "rww-block":
      return d.index === null || (typeof d.index === "number" && Number.isInteger(d.index));
    case "rww-at":
      return typeof d.top === "number" && typeof d.bottom === "number";
    case "rww-focus":
      return isIndex(d.index) && isField(d.field);
    case "rww-edit":
      return isIndex(d.index) && isField(d.field) && typeof d.text === "string" && d.text.length <= MAX_TEXT;
    case "rww-blur":
    case "rww-var-menu":
      return true;
    default:
      return false;
  }
};

/** What the editor can ask of the canvas: redraw a field at once (an inspector edit), or put a variable at the caret. */
export type MailFrameHandle = {
  patch: (index: number, field: CanvasField, text: string) => void;
  insertVar: (name: string) => void;
};

/**
 * A rendered mail in a sandboxed iframe (srcdoc, scripts allowed, no same-origin), as tall as the
 * mail. Interactive: blocks the renderer marked light up on hover and a click picks one; the
 * selected block is outlined, and scrolled into view when the pick came from elsewhere (the outline).
 * In the editor render its text fields are typed into in place (frameScript.ts): each keystroke
 * comes back as onEdit, and while a field has the caret a newer render never replaces the frame
 * (it would take the caret away); the newest one is shown once the caret leaves and the render has
 * caught up with what was typed (`upToDate`). Messages are only trusted from this frame's own window.
 */
const MailFrame: FC<{
  html: string;
  width: number;
  title?: string;
  minHeight?: number;
  interactive?: boolean;
  selected?: number | null;
  /** The number of blocks the content has: a picked index outside it is ignored. */
  blockCount?: number;
  onSelect?: (index: number | null) => void;
  /** How many marked elements the render has (0: the renderer doesn't mark blocks yet). */
  onMarked?: (count: number) => void;
  /** A field was typed in: its whole text, as template text. */
  onEdit?: (index: number, field: CanvasField, text: string) => void;
  /** The caret went into a field (null: it left the fields). */
  onFieldFocus?: (at: { index: number; field: CanvasField } | null) => void;
  /** "{{" was typed in a field. */
  onVarMenu?: () => void;
  /** False while the render shown is older than the content (a newer one is on its way). */
  upToDate?: boolean;
  ref?: Ref<MailFrameHandle>;
}> = ({
  html,
  width,
  title = "Mail preview",
  minHeight = 360,
  interactive = false,
  selected = null,
  blockCount,
  onSelect,
  onMarked,
  onEdit,
  onFieldFocus,
  onVarMenu,
  upToDate = true,
  ref,
}) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(minHeight);
  const [room, setRoom] = useState<number | null>(null);
  // Typing in the frame: the document being typed in stays (`frozen`) until the caret has left and
  // the render has caught up; a newer render replacing it would throw the caret and the text away.
  const [freeze, setFreeze] = useState<{ doc: string; editing: boolean } | null>(null);
  // The caret has left and the render has caught up: the newest render shows from now on.
  if (freeze && !freeze.editing && upToDate) setFreeze(null);
  const hold = interactive && freeze !== null && (freeze.editing || !upToDate);
  const shown = hold && freeze ? freeze.doc : html;
  const srcDoc = useMemo(() => withFrameScript(shown, interactive), [shown, interactive]);
  // Narrower than the mail: draw it smaller rather than cut it (clicks still land on the right block).
  const scale = room && room < width ? Math.max(0.4, room / width) : 1;

  // The latest props for the message handler, without re-subscribing on each render.
  const latest = useRef({ selected, blockCount, onSelect, onMarked, onEdit, onFieldFocus, onVarMenu, minHeight, scale, shown });
  useEffect(() => {
    latest.current = { selected, blockCount, onSelect, onMarked, onEdit, onFieldFocus, onVarMenu, minHeight, scale, shown };
  });

  useImperativeHandle(
    ref,
    () => ({
      patch: (index, field, text) => frame.current?.contentWindow?.postMessage({ type: "rww-patch", index, field, text }, "*"),
      insertVar: (name) => frame.current?.contentWindow?.postMessage({ type: "rww-insert-var", name }, "*"),
    }),
    [],
  );

  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => setRoom(Math.floor(entries[0]?.contentRect.width ?? 0) || null));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // The index the frame itself picked last: no need to scroll to it.
  const pickedHere = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow || !isMessage(event.data)) return;
      const data = event.data;
      const now = latest.current;
      const inRange = (index: number) => now.blockCount === undefined || index < now.blockCount;
      if (data.type === "rww-size") {
        setHeight(Math.max(now.minHeight, Math.min(20_000, Math.ceil(data.height))));
        now.onMarked?.(data.marked);
        // A fresh document (each render reloads the frame): show the selection again.
        frame.current.contentWindow?.postMessage({ type: "rww-select", index: now.selected, scroll: false }, "*");
      } else if (data.type === "rww-block") {
        if (data.index !== null && (data.index < 0 || !inRange(data.index))) return;
        pickedHere.current = data.index;
        now.onSelect?.(data.index);
      } else if (data.type === "rww-at" && marker.current) {
        marker.current.style.top = `${Math.max(0, data.top * now.scale - 16)}px`;
        marker.current.style.height = `${Math.max(1, (data.bottom - data.top) * now.scale + 32)}px`;
        marker.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
      } else if (data.type === "rww-focus") {
        if (!inRange(data.index)) return;
        // Keep the document being typed in: the one on screen now (the frozen one when coming back to it).
        setFreeze({ doc: now.shown, editing: true });
        pickedHere.current = data.index;
        now.onFieldFocus?.({ index: data.index, field: data.field });
      } else if (data.type === "rww-blur") {
        setFreeze((f) => (f ? { ...f, editing: false } : f));
        now.onFieldFocus?.(null);
      } else if (data.type === "rww-edit") {
        if (!inRange(data.index)) return;
        pickedHere.current = data.index;
        now.onEdit?.(data.index, data.field, data.text);
      } else if (data.type === "rww-var-menu") {
        now.onVarMenu?.();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const fromFrame = pickedHere.current === selected;
    pickedHere.current = undefined;
    frame.current?.contentWindow?.postMessage({ type: "rww-select", index: selected, scroll: !fromFrame && selected !== null }, "*");
  }, [selected, interactive]);

  return (
    <div ref={box} className="w-full">
      <div className="relative mx-auto overflow-hidden" style={{ width: Math.floor(width * scale), height: Math.ceil(height * scale) }}>
        <div ref={marker} aria-hidden className="pointer-events-none absolute left-0 w-px" />
        <iframe
          ref={frame}
          title={title}
          sandbox="allow-scripts"
          srcDoc={srcDoc}
          className="block border-0 bg-white"
          style={{ width, height, transform: scale < 1 ? `scale(${scale})` : undefined, transformOrigin: "0 0" }}
        />
      </div>
      {scale < 0.98 ? <p className="mt-1.5 text-center text-[11px] text-gray-500">Shown at {Math.round(scale * 100)}% to fit</p> : null}
    </div>
  );
};

export default MailFrame;
