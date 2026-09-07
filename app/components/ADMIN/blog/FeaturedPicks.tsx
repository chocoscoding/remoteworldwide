"use client";

import { useState, type FC } from "react";
import { toast } from "react-toastify";
import { setFeaturedRank } from "@/libs/blog-admin";
import { ADMIN_HINT } from "./OfferTargeting";

export interface PickRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  featuredRank: number | null;
}

const FeaturedPicks: FC<{ posts: PickRow[] }> = ({ posts }) => {
  const [rows, setRows] = useState(posts);

  const change = async (id: string, value: string) => {
    const rank = value ? Number(value) : null;
    setRows((r) => r.map((p) => (p.id === id ? { ...p, featuredRank: rank } : p)));
    try {
      await setFeaturedRank(id, rank);
      toast.success(rank ? `Ranked #${rank}` : "Removed from Start here");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  };

  const picked = rows.filter((p) => p.featuredRank).sort((a, b) => a.featuredRank! - b.featuredRank!);

  return (
    <div className="rounded-md border border-gray-200 p-4">
      <p className="text-sm font-semibold text-primary">Start here (hand-picked posts)</p>
      <p className={ADMIN_HINT}>Rank 1 is the lead card on the blog landing page; ranks 2–4 sit under it and in every post sidebar. Pick the posts that convert, not the newest.</p>
      {picked.length > 0 && (
        <ol className="mt-3 flex flex-wrap gap-2 text-xs">
          {picked.map((p) => (
            <li key={p.id} className="rounded-full bg-[#e1f073] px-2.5 py-1 font-bold">
              #{p.featuredRank} {p.title}
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 max-h-[420px] overflow-y-auto">
        <table className="w-full text-sm">
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="py-2 pr-3">
                  <span className="font-semibold">{p.title}</span>
                  <span className="ml-2 text-xs text-gray-400">{p.category}</span>
                </td>
                <td className="py-2 text-right">
                  <select value={p.featuredRank ?? ""} onChange={(e) => change(p.id, e.target.value)} className="rounded-md border border-gray-300 p-1 text-xs">
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        #{n}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeaturedPicks;
