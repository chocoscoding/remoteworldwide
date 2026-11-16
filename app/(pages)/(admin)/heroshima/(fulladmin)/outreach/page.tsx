import Link from "next/link";
import { getMailOverview, getMailSettings, getMailTable, listCampaigns, listThreads } from "@/libs/mail-admin";
import { DEFAULT_SETTINGS, type Rates } from "@/app/lib/mail/types";
import MailShell from "@/app/components/mail/MailShell";
import Accordion from "@/app/components/mail/overview/Accordion";
import { feedbackFold, offersFold, sourcesFold, triggersFold } from "@/app/components/mail/overview/Folds";
import Headline from "@/app/components/mail/overview/Headline";
import NeedsYou, { HealthChip, type PausedCampaign } from "@/app/components/mail/overview/NeedsYou";
import WhatsWorking from "@/app/components/mail/overview/WhatsWorking";
import { healthOf, type WorkingBy } from "@/app/components/mail/overview/metrics";
import { ErrorBox } from "@/app/components/mail/ui";
import { EMPTY_TOTALS } from "@/app/components/mail/format";
import PauseSwitch from "./PauseSwitch";

// Outreach overview: what needs looking at now, and the rest folded away. Four headlines with their
// change against the previous window, one chart the headline you press picks, what's working
// (mails, playbook steps or campaigns ranked by upgrades), what needs the admin, then offers,
// feedback, sources and triggers one at a time. Read through libs/mail-admin.ts; the (fulladmin)
// layout and the backend's isAdmin both require an ADMIN.
export const dynamic = "force-dynamic";
export const metadata = { title: "Outreach", robots: { index: false, follow: false } };

const RANGES = [7, 30, 90] as const;
const ZERO_RATES: Rates = { delivered: 0, opened: 0, clicked: 0, clickToOpen: 0, replied: 0, unsubscribed: 0, bounced: 0, complained: 0, converted: 0 };
const FIRST_VIEW: WorkingBy = "template";

const Page = async ({ searchParams }: { searchParams: Promise<{ days?: string }> }) => {
  const params = await searchParams;
  const asked = Number.parseInt(params.days ?? "30", 10);
  const days = (RANGES as readonly number[]).includes(asked) ? asked : 30;

  const [overview, table, settingsRes, inbox, campaigns] = await Promise.all([
    getMailOverview(days),
    getMailTable(FIRST_VIEW, days),
    getMailSettings(),
    listThreads({ status: "open", page: 1 }),
    listCampaigns(),
  ]);
  const settings = settingsRes.data ?? DEFAULT_SETTINGS;
  const limits = { ...DEFAULT_SETTINGS.alarms, ...(settings.alarms ?? {}) };
  const data = overview.data;
  const health = healthOf(data?.alarms, limits);

  // The backend counts unread open threads across every page; an older backend without counts falls back to
  // the newest page, exact on one page and a floor past it.
  const unread = inbox.data
    ? inbox.data.counts
      ? { count: inbox.data.counts.unread, atLeast: false }
      : { count: inbox.data.items.filter((t) => t.unread).length, atLeast: inbox.data.pages > 1 }
    : null;
  const pausedCampaigns: PausedCampaign[] = (campaigns.data ?? [])
    .filter((c) => c.status === "paused" && /^paused automatically/i.test(c.pausedReason ?? ""))
    .map((c) => ({ id: c.id, name: c.name, reason: c.pausedReason ?? "" }));

  return (
    <MailShell
      title="Overview"
      actions={
        <>
          {data ? <HealthChip health={health} /> : null}
          <nav aria-label="Range" className="flex gap-1.5">
            {RANGES.map((r) => (
              <Link
                key={r}
                href={`/heroshima/outreach?days=${r}`}
                aria-current={r === days ? "page" : undefined}
                className={`rounded-md border px-3 py-1.5 text-xs font-bold ${r === days ? "border-black bg-black text-[#e1f073]" : "border-gray-300 bg-white text-gray-700 hover:border-black"}`}>
                {r} days
              </Link>
            ))}
          </nav>
          {settingsRes.data ? <PauseSwitch paused={settings.paused} /> : null}
        </>
      }>
      {overview.error || !data ? (
        <ErrorBox>The outreach numbers couldn&apos;t be loaded: {overview.error ?? "no answer from the backend."}</ErrorBox>
      ) : (
        <div className="flex flex-col gap-4">
          <Headline
            days={days}
            totals={{ ...EMPTY_TOTALS, ...data.totals }}
            rates={{ ...ZERO_RATES, ...(data.rates ?? {}) }}
            daily={data.daily ?? []}
            previous={data.previous}
            conversionsDaily={data.conversions?.daily}
          />

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <WhatsWorking key={days} days={days} initialBy={FIRST_VIEW} initialRows={table.data ?? null} initialError={table.error ?? null} />
            </div>
            <NeedsYou health={health} alarms={data.alarms} limits={limits} unread={unread} marketingPaused={Boolean(settingsRes.data?.paused)} pausedCampaigns={pausedCampaigns} />
          </div>

          <Accordion label="More numbers" items={[offersFold(data.offers), feedbackFold(data.feedback, days), sourcesFold(data.bySource), triggersFold(data.actions)]} />
        </div>
      )}
    </MailShell>
  );
};

export default Page;
