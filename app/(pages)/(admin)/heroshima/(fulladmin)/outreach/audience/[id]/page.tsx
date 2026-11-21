import { notFound } from "next/navigation";
import { getAudience, listCampaigns } from "@/libs/mail-admin";
import type { AudienceFilter, MailAudience } from "@/app/lib/mail/types";
import AudienceShell from "@/app/components/mail/audience/AudienceShell";
import FixedAudience from "@/app/components/mail/audience/FixedAudience";
import { BUILT_IN_NAMES, filterToSave } from "@/app/components/mail/audience/filterText";
import { ErrorBox } from "@/app/components/mail/ui";
import AudienceEditor from "./AudienceEditor";

// One audience: its name as the title, the filters as chips, and its people a page at a time to tick
// in or out. A fixed audience opens read only. `new?from=<id>` starts a new one from another.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach audience", robots: { index: false, follow: false } };

const OBJECT_ID = /^[a-f\d]{24}$/i;
const isFixed = (a: MailAudience): a is MailAudience & { builtIn: NonNullable<MailAudience["builtIn"]> } => Boolean(a.builtIn);

const Page = async ({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string | string[] }> }) => {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !OBJECT_ID.test(id)) notFound();
  const fromParam = (await searchParams).from;
  const from = isNew && typeof fromParam === "string" && OBJECT_ID.test(fromParam) ? fromParam : null;

  const [audience, source, campaigns] = await Promise.all([isNew ? null : getAudience(id), from ? getAudience(from) : null, listCampaigns()]);
  const campaignOptions = (campaigns.data ?? []).filter((c) => c.status !== "draft").map((c) => ({ id: c.id, name: c.name }));

  if (audience && (audience.error || !audience.data)) {
    return (
      <AudienceShell>
        <ErrorBox>This audience couldn&apos;t be loaded: {audience.error ?? "no answer from the backend."}</ErrorBox>
      </AudienceShell>
    );
  }
  const current = audience?.data ?? null;
  if (current && isFixed(current)) {
    return (
      <AudienceShell>
        <FixedAudience audience={current} />
      </AudienceShell>
    );
  }

  // Duplicating: the other audience's filters and picks, under a new name, not saved until Create.
  const original = source?.data ?? null;
  const seed = original
    ? {
        name: `Copy of ${original.name || (original.builtIn ? BUILT_IN_NAMES[original.builtIn] : "an audience")}`,
        filter: filterToSave(original.filter ?? ({ kind: "users" } as AudienceFilter)),
      }
    : null;

  return (
    <AudienceShell>
      <AudienceEditor key={current?.id ?? `new-${from ?? ""}`} audience={current} seed={seed} campaigns={campaignOptions} />
    </AudienceShell>
  );
};

export default Page;
