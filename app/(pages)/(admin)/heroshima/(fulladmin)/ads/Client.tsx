"use client";

import { useState, useTransition, type FC, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { createAd, deleteAd, updateAd } from "@/libs/ads-admin";
import { AD_SLOTS, AD_SLOT_LABELS, type AdForm, type AdminAd, type AdSlotName } from "@/app/lib/ads/types";

const EMPTY: AdForm = { name: "", advertiser: null, slots: [], imageUrl: "", linkUrl: "", alt: "", active: true, startsAt: null, endsAt: null, weight: 1 };

/** An ISO time as a datetime-local value, in this browser's zone, and back. */
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocal = (value: string) => (value ? new Date(value).toISOString() : null);

const formOf = (ad: AdminAd): AdForm => ({
  name: ad.name,
  advertiser: ad.advertiser,
  slots: ad.slots,
  imageUrl: ad.imageUrl,
  linkUrl: ad.linkUrl,
  alt: ad.alt,
  active: ad.active,
  startsAt: ad.startsAt,
  endsAt: ad.endsAt,
  weight: ad.weight,
});

const INPUT = "w-full rounded-md border border-gray-300 p-2 text-sm";

const AdEditor: FC<{ initial: AdForm; submitLabel: string; onSubmit: (form: AdForm) => Promise<string | null>; onCancel?: () => void }> = ({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}) => {
  const [form, setForm] = useState<AdForm>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const set = <K extends keyof AdForm>(key: K, value: AdForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggleSlot = (slot: AdSlotName) => set("slots", form.slots.includes(slot) ? form.slots.filter((s) => s !== slot) : [...form.slots, slot]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    startSaving(async () => setError(await onSubmit(form)));
  };

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2" aria-label={submitLabel}>
      <label className="text-xs font-semibold text-gray-600">
        Name (only you see it)
        <input className={INPUT} value={form.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} />
      </label>
      <label className="text-xs font-semibold text-gray-600">
        Advertiser (shown as &quot;Sponsored by&quot;, optional)
        <input className={INPUT} value={form.advertiser ?? ""} onChange={(e) => set("advertiser", e.target.value || null)} maxLength={80} />
      </label>
      <label className="text-xs font-semibold text-gray-600">
        Image address (https)
        <input className={INPUT} type="url" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} required placeholder="https://…" />
      </label>
      <label className="text-xs font-semibold text-gray-600">
        Where a press goes (https)
        <input className={INPUT} type="url" value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} required placeholder="https://…" />
      </label>
      <label className="text-xs font-semibold text-gray-600 md:col-span-2">
        Image description, for screen readers
        <input className={INPUT} value={form.alt} onChange={(e) => set("alt", e.target.value)} required maxLength={200} />
      </label>
      <fieldset className="md:col-span-2">
        <legend className="text-xs font-semibold text-gray-600">Slots</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {AD_SLOTS.map((slot) => (
            <label key={slot} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={form.slots.includes(slot)} onChange={() => toggleSlot(slot)} />
              {AD_SLOT_LABELS[slot]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="text-xs font-semibold text-gray-600">
        Starts (empty: now)
        <input className={INPUT} type="datetime-local" value={toLocal(form.startsAt)} onChange={(e) => set("startsAt", fromLocal(e.target.value))} />
      </label>
      <label className="text-xs font-semibold text-gray-600">
        Ends (empty: never)
        <input className={INPUT} type="datetime-local" value={toLocal(form.endsAt)} onChange={(e) => set("endsAt", fromLocal(e.target.value))} />
      </label>
      <label className="text-xs font-semibold text-gray-600">
        Weight (1 to 100: a bigger share of a shared slot)
        <input className={INPUT} type="number" min={1} max={100} value={form.weight} onChange={(e) => set("weight", Number(e.target.value) || 1)} />
      </label>
      <label className="flex items-center gap-2 self-end text-sm font-semibold">
        <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> On
      </label>
      {form.imageUrl ? (
        <div className="md:col-span-2">
          <p className="mb-1 text-xs font-semibold text-gray-600">Preview</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- an advertiser's image on any host */}
          <img src={form.imageUrl} alt={form.alt} className="max-h-48 rounded border border-gray-200" />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[#b23c26] md:col-span-2">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2 md:col-span-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-[#e1f073] px-4 py-2 text-sm font-bold br-plain-press disabled:opacity-60">
          {saving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : null}
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="rounded-md bg-white px-4 py-2 text-sm font-bold br-plain-press">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
};

const Client: FC<{ ads: AdminAd[] }> = ({ ads }) => {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  const done = () => router.refresh();

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <section className="rounded-md border border-black bg-white p-4">
          <h2 className="mb-3 text-sm font-bold">New ad</h2>
          <AdEditor
            initial={EMPTY}
            submitLabel="Place ad"
            onCancel={() => setCreating(false)}
            onSubmit={async (form) => {
              const result = await createAd(form);
              if (result.error) return result.error;
              setCreating(false);
              done();
              return null;
            }}
          />
        </section>
      ) : (
        <button type="button" onClick={() => setCreating(true)} className="self-start rounded-md bg-[#e1f073] px-4 py-2 text-sm font-bold br-plain-press">
          New ad
        </button>
      )}

      {!ads.length ? <p className="text-sm text-gray-500">No ads yet.</p> : null}

      <ul className="flex flex-col gap-3">
        {ads.map((ad) => {
          const ctr = ad.impressions ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%` : "0%";
          return (
            <li key={ad.id} className="rounded-md border border-gray-300 bg-white p-4">
              {editing === ad.id ? (
                <AdEditor
                  initial={formOf(ad)}
                  submitLabel="Save"
                  onCancel={() => setEditing(null)}
                  onSubmit={async (form) => {
                    const result = await updateAd(ad.id, form);
                    if (result.error) return result.error;
                    setEditing(null);
                    done();
                    return null;
                  }}
                />
              ) : (
                <div className="flex flex-wrap items-start gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- an advertiser's image on any host */}
                  <img src={ad.imageUrl} alt={ad.alt} className="h-24 w-24 flex-none rounded border border-gray-200 object-contain" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {ad.name}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${ad.live ? "bg-[#e1f073] text-black" : "bg-gray-100 text-gray-600"}`}>
                        {ad.live ? "Running" : ad.active ? "Scheduled or ended" : "Off"}
                      </span>
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {ad.advertiser ? `${ad.advertiser} · ` : ""}
                      <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {ad.linkUrl}
                      </a>
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      {ad.slots.map((s) => AD_SLOT_LABELS[s]).join(", ")} · weight {ad.weight}
                      {ad.startsAt ? ` · from ${new Date(ad.startsAt).toLocaleString("en-GB")}` : ""}
                      {ad.endsAt ? ` · until ${new Date(ad.endsAt).toLocaleString("en-GB")}` : ""}
                    </p>
                    <p className="mt-1 text-sm tabular-nums">
                      <strong>{ad.impressions.toLocaleString("en-GB")}</strong> views · <strong>{ad.clicks.toLocaleString("en-GB")}</strong> presses · {ctr}
                    </p>
                  </div>
                  <div className="flex flex-none flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        startBusy(async () => {
                          await updateAd(ad.id, { active: !ad.active });
                          done();
                        })
                      }
                      className="rounded-md bg-white px-3 py-1.5 text-xs font-bold br-plain-press disabled:opacity-60">
                      {ad.active ? "Switch off" : "Switch on"}
                    </button>
                    <button type="button" onClick={() => setEditing(ad.id)} className="rounded-md bg-white px-3 py-1.5 text-xs font-bold br-plain-press">
                      Edit
                    </button>
                    {confirmDelete === ad.id ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            startBusy(async () => {
                              await deleteAd(ad.id);
                              setConfirmDelete(null);
                              done();
                            })
                          }
                          className="rounded-md bg-[#b23c26] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
                          Yes, delete
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(null)} className="px-2 text-xs font-semibold text-gray-500">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(ad.id)} className="rounded-md bg-white px-3 py-1.5 text-xs font-bold text-[#b23c26] br-plain-press">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Client;
