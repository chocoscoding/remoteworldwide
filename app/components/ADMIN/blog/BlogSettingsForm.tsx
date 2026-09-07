"use client";

import { useState, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { saveBlogSettings, type BlogSettingsInput } from "@/libs/blog-admin";
import { BLOG_CATEGORIES } from "@/app/lib/blog/categories";
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from "./OfferTargeting";

const BTN_DARK = "drop-shadow-primary2-hover transition-all bg-black text-white border-2 border-primary font-bold rounded-sm px-4 h-10 disabled:opacity-50";

const BlogSettingsForm: FC<{
  initial: BlogSettingsInput;
  magnets: { slug: string; title: string }[];
  ctas: { key: string; name: string }[];
}> = ({ initial, magnets, ctas }) => {
  const router = useRouter();
  const [form, setForm] = useState<BlogSettingsInput>(initial);
  const [busy, setBusy] = useState(false);

  const setCategoryMap = (field: "categoryLeadMagnets" | "categoryCtas", slug: string, value: string) =>
    setForm((f) => {
      const next = { ...f[field] };
      if (value) next[slug] = value;
      else delete next[slug];
      return { ...f, [field]: next };
    });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await saveBlogSettings(form);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Settings saved");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const magnetSelect = (value: string | null, onChange: (v: string) => void, placeholder: string) => (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={ADMIN_INPUT}>
      <option value="">{placeholder}</option>
      {magnets.map((m) => (
        <option key={m.slug} value={m.slug}>
          {m.title}
        </option>
      ))}
    </select>
  );
  const ctaSelect = (value: string | null, onChange: (v: string) => void, placeholder: string) => (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={ADMIN_INPUT}>
      <option value="">{placeholder}</option>
      {ctas.map((c) => (
        <option key={c.key} value={c.key}>
          {c.name}
        </option>
      ))}
    </select>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className={ADMIN_LABEL}>Flagship lead magnet</label>
          {magnetSelect(form.flagshipLeadMagnetSlug, (v) => setForm({ ...form, flagshipLeadMagnetSlug: v || null }), "First active offer")}
          <p className={ADMIN_HINT}>The blog landing hero, and the fallback for every post.</p>
        </div>
        <div>
          <label className={ADMIN_LABEL}>Default product CTA</label>
          {ctaSelect(form.defaultCtaKey, (v) => setForm({ ...form, defaultCtaKey: v || null }), "First active CTA")}
          <p className={ADMIN_HINT}>Used when neither the post nor its category names one.</p>
        </div>
        <div>
          <label className={ADMIN_LABEL}>Landing page band CTA</label>
          {ctaSelect(form.indexCtaKey, (v) => setForm({ ...form, indexCtaKey: v || null }), "Same as default")}
        </div>
      </div>

      <div className="rounded-md border border-gray-200 p-4">
        <p className="text-sm font-semibold text-primary">Per category</p>
        <p className={ADMIN_HINT}>Each category is a marketing page. Map it to the offer and CTA that fit its readers; posts inherit these unless overridden.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4">Lead magnet</th>
                <th className="py-2">Product CTA</th>
              </tr>
            </thead>
            <tbody>
              {BLOG_CATEGORIES.map((c) => (
                <tr key={c.slug} className="border-t">
                  <td className="py-2 pr-4 font-semibold">{c.name}</td>
                  <td className="py-2 pr-4">{magnetSelect(form.categoryLeadMagnets[c.slug] ?? null, (v) => setCategoryMap("categoryLeadMagnets", c.slug, v), "Auto")}</td>
                  <td className="py-2">{ctaSelect(form.categoryCtas[c.slug] ?? null, (v) => setCategoryMap("categoryCtas", c.slug, v), "Auto")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <button type="submit" disabled={busy} className={BTN_DARK}>
        {busy ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
};

export default BlogSettingsForm;
