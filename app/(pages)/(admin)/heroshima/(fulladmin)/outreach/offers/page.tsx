import { redirect } from "next/navigation";

// The offers live in Content now, beside the mails that carry them (/templates?show=offers).
// Each offer keeps its own page at /offers/[id].
export const dynamic = "force-dynamic";

const Page = async ({ searchParams }: { searchParams: Promise<{ archived?: string }> }) => {
  const archived = (await searchParams).archived === "1";
  redirect(`/heroshima/outreach/templates?show=offers${archived ? "&archived=1" : ""}`);
};

export default Page;
