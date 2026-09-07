"use server";

import { revalidatePath } from "next/cache";
import { backend, BackendError, backendOrNull, type BackendInit } from "@/app/lib/backend";
import type { BlogSettings, Cta, CtaImageSide, CtaTone, LeadMagnet, Subscriber } from "@/app/lib/blog/types";

export interface LeadMagnetInput {
  slug?: string;
  title: string;
  hook: string;
  bullets: string[];
  buttonLabel: string;
  fileUrl: string;
  fileName: string;
  coverImage?: string | null;
  targetCategories: string[];
  targetTags: string[];
  active: boolean;
}

export interface CtaInput {
  key?: string;
  name: string;
  eyebrow?: string | null;
  headline: string;
  body: string;
  buttonLabel: string;
  href: string;
  tone: CtaTone;
  imageUrl?: string | null;
  imageSide?: CtaImageSide;
  targetCategories: string[];
  targetTags: string[];
  active: boolean;
}

export interface BlogSettingsInput {
  flagshipLeadMagnetSlug: string | null;
  defaultCtaKey: string | null;
  indexCtaKey: string | null;
  categoryLeadMagnets: Record<string, string>;
  categoryCtas: Record<string, string>;
}

export type ConversionKind = "cta" | "magnet";
export type LeadMagnetRow = LeadMagnet & { _count: { blogs: number; claimRecords: number } };
export interface PickRow {
  id: string;
  title: string;
  slug: string;
  category: string;
  featuredRank: number | null;
}

const admin = <T>(path: string, init: BackendInit = {}) => backend<T>(`/blog/admin${path}`, { ...init, session: true });

const revalidateBlog = () => {
  revalidatePath("/blogs");
  revalidatePath("/blogs", "layout");
};

async function attempt<T>(run: () => Promise<T>): Promise<{ data: T; error?: never } | { error: string; data?: never }> {
  try {
    const data = await run();
    revalidateBlog();
    return { data };
  } catch (error) {
    if (error instanceof BackendError && error.status < 500) return { error: error.message };
    throw error;
  }
}

export const listLeadMagnets = async () => admin<LeadMagnetRow[]>("/lead-magnets");
export const getLeadMagnet = async (id: string) => backendOrNull<LeadMagnet>(`/blog/admin/lead-magnets/${id}`, { session: true });
export const createLeadMagnet = async (input: LeadMagnetInput) => attempt(() => admin<LeadMagnet>("/lead-magnets", { method: "POST", body: input }));
export const updateLeadMagnet = async (id: string, input: Partial<LeadMagnetInput>) => attempt(() => admin<LeadMagnet>(`/lead-magnets/${id}`, { method: "PUT", body: input }));
export const deleteLeadMagnet = async (id: string) => {
  await admin(`/lead-magnets/${id}`, { method: "DELETE" });
  revalidateBlog();
  return { status: "deleted" };
};

export const listCtas = async () => admin<Cta[]>("/ctas");
export const getCta = async (id: string) => backendOrNull<Cta>(`/blog/admin/ctas/${id}`, { session: true });
export const createCta = async (input: CtaInput) => attempt(() => admin<Cta>("/ctas", { method: "POST", body: input }));
export const updateCta = async (id: string, input: Partial<CtaInput>) => attempt(() => admin<Cta>(`/ctas/${id}`, { method: "PUT", body: input }));
export const deleteCta = async (id: string) => {
  await admin(`/ctas/${id}`, { method: "DELETE" });
  revalidateBlog();
  return { status: "deleted" };
};

export const listConversions = async () => admin<{ magnets: LeadMagnetRow[]; ctas: Cta[] }>("/conversions");

export const setOfferActive = async (kind: ConversionKind, id: string, active: boolean) => {
  const result = await admin<{ active: boolean }>(`/offers/${kind}/${id}/active`, { method: "PATCH", body: { active } });
  revalidateBlog();
  return result;
};

export const getBlogSettingsRow = async () => admin<BlogSettings>("/settings");
export const saveBlogSettings = async (input: BlogSettingsInput) => attempt(() => admin<BlogSettings>("/settings", { method: "PUT", body: input }));

export const listPicks = async () => admin<PickRow[]>("/posts/picks");
export const setFeaturedRank = async (blogId: string, featuredRank: number | null) => {
  const result = await admin<{ featuredRank: number | null }>(`/posts/${blogId}/featured`, { method: "PATCH", body: { featuredRank } });
  revalidateBlog();
  return { data: result };
};

export const listSubscribers = async (page: number) => admin<{ rows: Subscriber[]; total: number; page: number; pageSize: number }>(`/subscribers?page=${page}`);

export const blogConversionStats = async () =>
  admin<{
    subscribers: number;
    claims: number;
    posts: number;
    magnets: { slug: string; title: string; claims: number; downloads: number; active: boolean }[];
    ctas: { key: string; name: string; clicks: number; active: boolean }[];
  }>("/stats");
