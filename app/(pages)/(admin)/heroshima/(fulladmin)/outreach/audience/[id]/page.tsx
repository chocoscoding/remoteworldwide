import { notFound } from "next/navigation";
import { getAudience, listCampaigns } from "@/libs/mail-admin";
import MailShell from "@/app/components/mail/MailShell";
import { ErrorBox } from "@/app/components/mail/ui";
import AudienceEditor from "./AudienceEditor";

// One audience: the filter builder with a live count and 20 of the people it reaches.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach audience", robots: { index: false, follow: false } };

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const back = { href: "/heroshima/outreach/audience", label: "Audience" };
  const isNew = id === "new";
  if (!isNew && !/^[a-f\d]{24}$/i.test(id)) notFound();

  const [audience, campaigns] = await Promise.all([isNew ? null : getAudience(id), listCampaigns()]);
  const campaignOptions = (campaigns.data ?? []).filter((c) => c.status !== "draft").map((c) => ({ id: c.id, name: c.name }));

  if (audience && (audience.error || !audience.data)) {
    return (
      <MailShell title="Audience" back={back}>
        <ErrorBox>This audience couldn&apos;t be loaded: {audience.error ?? "no answer from the backend."}</ErrorBox>
      </MailShell>
    );
  }
  return (
    <MailShell title={audience?.data?.name || "New audience"} back={back}>
      <AudienceEditor audience={audience?.data ?? null} campaigns={campaignOptions} />
    </MailShell>
  );
};

export default Page;
