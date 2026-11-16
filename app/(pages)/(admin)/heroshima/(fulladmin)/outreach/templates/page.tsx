import { getMailSettings, listOffers, listTemplates } from "@/libs/mail-admin";
import MailShell from "@/app/components/mail/MailShell";
import ContentLibrary from "@/app/components/mail/content/ContentLibrary";

// Content: the reusable mails and the offers they carry, in one library (?show=offers opens the
// offers). A mail card opens the content editor; an offer card opens the offer's page.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach content", robots: { index: false, follow: false } };

const Page = async ({ searchParams }: { searchParams: Promise<{ archived?: string; show?: string }> }) => {
  const params = await searchParams;
  const archived = params.archived === "1";
  const [templates, offers, settings] = await Promise.all([listTemplates({ archived }), listOffers(), getMailSettings()]);

  return (
    <MailShell title="Content" description="The mails campaigns and playbooks send, and the offers they carry.">
      <ContentLibrary
        templates={templates.data ?? []}
        templatesError={templates.error}
        offers={offers.data ?? []}
        offersError={offers.error}
        brandDesign={settings.data?.design ?? null}
        archived={archived}
        initialShow={params.show === "offers" ? "offers" : "mails"}
      />
    </MailShell>
  );
};

export default Page;
