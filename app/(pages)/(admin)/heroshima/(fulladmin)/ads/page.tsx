import { BackendError } from "@/app/lib/backend";
import { listAds } from "@/libs/ads-admin";
import type { AdminAd } from "@/app/lib/ads/types";
import Client from "./Client";

// The site's own ads (Google AdSense fills a slot with none running, app/components/main/AdSlot.tsx): place one (an image, where a press goes, which slots, from when to when),
// switch it on or off, edit or remove it, and see its views and presses. Signed-out visitors and
// Free accounts are sent ads; Basic and up never are (the backend decides). Server actions forward
// the admin's session (libs/ads-admin.ts).
export const dynamic = "force-dynamic";
export const metadata = { title: "Ads", robots: { index: false, follow: false } };

const Page = async () => {
  let ads: AdminAd[] | null = null;
  let failure: string | null = null;
  try {
    ads = await listAds();
  } catch (error) {
    if (!(error instanceof BackendError)) throw error;
    failure = error.message || `The backend answered ${error.status}.`;
  }

  return (
    <div className="w-full min-h-screen p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ads</h1>
        <p className="text-sm text-gray-500">
          Place your own ads in the site&apos;s slots. A running ad here takes its slot; a slot with none shows Google AdSense instead, when its
          unit id is set (NEXT_PUBLIC_ADSENSE_CLIENT and NEXT_PUBLIC_ADSENSE_SLOT_*). Only signed-out visitors and Free accounts see ads. The
          slots on the pages are switched off in code until ads launch.
        </p>
      </div>
      {ads ? (
        <Client ads={ads} />
      ) : (
        <div role="alert" className="rounded-md border border-[#f3c4b8] bg-[#fdeae6] p-4 text-sm text-[#b23c26]">
          The ads couldn&apos;t be loaded: {failure ?? "no answer from the backend."}
        </div>
      )}
    </div>
  );
};

export default Page;
