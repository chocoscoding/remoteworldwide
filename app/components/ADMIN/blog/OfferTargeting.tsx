"use client";

import type { FC } from "react";
import { TagsInput } from "react-tag-input-component";
import { BLOG_CATEGORIES } from "@/app/lib/blog/categories";

export const ADMIN_LABEL = "block text-sm font-medium text-primary";
export const ADMIN_INPUT = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2";
export const ADMIN_HINT = "mt-1 text-xs text-gray-500";

const OfferTargeting: FC<{
  categories: string[];
  tags: string[];
  onCategories: (next: string[]) => void;
  onTags: (next: string[]) => void;
}> = ({ categories, tags, onCategories, onTags }) => (
  <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
    <p className="text-sm font-semibold text-primary">Targeting</p>
    <p className={ADMIN_HINT}>Posts pick this offer automatically when their category matches; otherwise when their tags overlap. Leave both empty for a general offer.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {BLOG_CATEGORIES.map((c) => {
        const on = categories.includes(c.slug);
        return (
          <button
            key={c.slug}
            type="button"
            onClick={() => onCategories(on ? categories.filter((s) => s !== c.slug) : [...categories, c.slug])}
            className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${on ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
            {c.name}
          </button>
        );
      })}
    </div>
    <div className="mt-3">
      <label className={ADMIN_LABEL}>Target tags</label>
      <TagsInput value={tags} onChange={onTags} name="targetTags" placeHolder="resume, interview, async…" classNames={{ input: ADMIN_INPUT }} />
    </div>
  </div>
);

export default OfferTargeting;
