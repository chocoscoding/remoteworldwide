"use client";

import { useState, type FC } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "react-toastify";
import { deleteBlog } from "@/libs/query";
import type { BlogStatus } from "@/app/lib/blog/types";

const BTN = "inline-flex h-9 items-center gap-1.5 rounded-sm border-2 border-primary px-3 text-xs font-bold transition-all drop-shadow-primary2-hover disabled:opacity-50";

const AdminPostActions: FC<{ id: string; slug: string; title: string; status: BlogStatus }> = ({ id, slug, title, status }) => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteBlog(id);
      toast.success("Blog deleted");
      router.push("/heroshima/blogs");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete");
      setBusy(false);
    }
  };

  return (
    <div className="sticky top-0 z-30 border-b-2 border-primary bg-[#222325] text-white">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-2.5">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#e1f073]">Admin view</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${status === "PUBLISHED" ? "bg-[#e1f073] text-[#222325]" : "bg-[#fdeae6] text-[#b23c26]"}`}>{status}</span>
        <span className="text-xs text-white/60">Exactly what readers see.</span>
        <div className="ml-auto flex items-center gap-2">
          {status === "PUBLISHED" && (
            <a href={`/blogs/${slug}`} target="_blank" rel="noreferrer" className={`${BTN} bg-white text-primary`}>
              <ExternalLink className="h-3.5 w-3.5" />
              Open live
            </a>
          )}
          <Link href={`/heroshima/blogs/${slug}/edit`} className={`${BTN} bg-[#e1f073] text-primary`}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
          <button type="button" onClick={remove} disabled={busy} className={`${BTN} bg-[#b23c26] text-white`}>
            <Trash2 className="h-3.5 w-3.5" />
            {busy ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPostActions;
