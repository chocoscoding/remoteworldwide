"use client";

import { useEffect, useMemo, useRef, useState, type FC } from "react";
import { withFrameScript } from "./frameScript";

type FrameMessage =
  | { type: "rww-size"; height: number; marked: number }
  | { type: "rww-block"; index: number | null }
  | { type: "rww-at"; top: number; bottom: number };

const isMessage = (data: unknown): data is FrameMessage => {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.type === "rww-size") return typeof d.height === "number" && typeof d.marked === "number";
  if (d.type === "rww-block") return d.index === null || (typeof d.index === "number" && Number.isInteger(d.index));
  if (d.type === "rww-at") return typeof d.top === "number" && typeof d.bottom === "number";
  return false;
};

/**
 * A rendered mail in a sandboxed iframe (srcdoc, scripts allowed, no same-origin), as tall as the
 * mail. Interactive: blocks the renderer marked light up on hover and a click picks one; the
 * selected block is outlined, and scrolled into view when the pick came from elsewhere (the outline).
 * Messages are only trusted from this frame's own window.
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
}> = ({ html, width, title = "Mail preview", minHeight = 360, interactive = false, selected = null, blockCount, onSelect, onMarked }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(minHeight);
  const [room, setRoom] = useState<number | null>(null);
  const srcDoc = useMemo(() => withFrameScript(html, interactive), [html, interactive]);
  // Narrower than the mail: draw it smaller rather than cut it (clicks still land on the right block).
  const scale = room && room < width ? Math.max(0.4, room / width) : 1;

  // The latest props for the message handler, without re-subscribing on each render.
  const latest = useRef({ selected, blockCount, onSelect, onMarked, minHeight, scale });
  useEffect(() => {
    latest.current = { selected, blockCount, onSelect, onMarked, minHeight, scale };
  });

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
      if (data.type === "rww-size") {
        setHeight(Math.max(now.minHeight, Math.min(20_000, Math.ceil(data.height))));
        now.onMarked?.(data.marked);
        // A fresh document (each render reloads the frame): show the selection again.
        frame.current.contentWindow?.postMessage({ type: "rww-select", index: now.selected, scroll: false }, "*");
      } else if (data.type === "rww-block") {
        if (data.index !== null && (data.index < 0 || (now.blockCount !== undefined && data.index >= now.blockCount))) return;
        pickedHere.current = data.index;
        now.onSelect?.(data.index);
      } else if (data.type === "rww-at" && marker.current) {
        marker.current.style.top = `${Math.max(0, data.top * now.scale - 16)}px`;
        marker.current.style.height = `${Math.max(1, (data.bottom - data.top) * now.scale + 32)}px`;
        marker.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
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
