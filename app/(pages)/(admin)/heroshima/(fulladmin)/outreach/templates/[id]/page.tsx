import { notFound } from "next/navigation";
import { getMailSettings, getTemplate } from "@/libs/mail-admin";
import { DEFAULT_DESIGN } from "@/app/lib/mail/types";
import MailShell from "@/app/components/mail/MailShell";
import { ErrorBox } from "@/app/components/mail/ui";
import TemplateEditor from "./TemplateEditor";

// One reusable mail in the content editor: the rendered mail is the canvas, the inspector edits the
// picked block or the mail's look. /templates/new starts an empty one.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach mail", robots: { index: false, follow: false } };

const BACK = { href: "/heroshima/outreach/templates", label: "Content" };

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const isNew = id === "new";
  if (!isNew && !/^[a-f\d]{24}$/i.test(id)) notFound();

  const [res, settings] = await Promise.all([isNew ? null : getTemplate(id), getMailSettings()]);
  const brandDesign = settings.data?.design ?? DEFAULT_DESIGN;

  if (isNew) {
    return (
      <MailShell back={BACK}>
        <TemplateEditor template={null} brandDesign={brandDesign} />
      </MailShell>
    );
  }
  if (!res || res.error || !res.data) {
    return (
      <MailShell title="Mail" back={BACK}>
        <ErrorBox>This mail couldn&apos;t be loaded: {res?.error ?? "no answer from the backend."}</ErrorBox>
      </MailShell>
    );
  }
  return (
    <MailShell back={BACK}>
      <TemplateEditor template={res.data} brandDesign={brandDesign} />
    </MailShell>
  );
};

export default Page;
