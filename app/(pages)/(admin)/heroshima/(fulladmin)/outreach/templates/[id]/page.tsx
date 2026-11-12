import { notFound } from "next/navigation";
import { getTemplate } from "@/libs/mail-admin";
import MailShell from "@/app/components/mail/MailShell";
import { ErrorBox } from "@/app/components/mail/ui";
import TemplateEditor from "./TemplateEditor";

// One template: its blocks, subject, sender and pref, with a live preview and a test send.
// /templates/new starts an empty one.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach template", robots: { index: false, follow: false } };

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const back = { href: "/heroshima/outreach/templates", label: "Templates" };
  if (id === "new") {
    return (
      <MailShell title="New template" back={back}>
        <TemplateEditor template={null} />
      </MailShell>
    );
  }
  if (!/^[a-f\d]{24}$/i.test(id)) notFound();
  const res = await getTemplate(id);
  if (res.error || !res.data) {
    return (
      <MailShell title="Template" back={back}>
        <ErrorBox>This template couldn&apos;t be loaded: {res.error ?? "no answer from the backend."}</ErrorBox>
      </MailShell>
    );
  }
  return (
    <MailShell title={res.data.name || "Template"} description={res.data.archived ? "Archived" : undefined} back={back}>
      <TemplateEditor template={res.data} />
    </MailShell>
  );
};

export default Page;
