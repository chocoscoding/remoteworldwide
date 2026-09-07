import Link from "next/link";
import NotFound from "@/app/components/NotFound";
import LeadMagnetForm from "@/app/components/ADMIN/blog/LeadMagnetForm";
import { getLeadMagnet } from "@/libs/blog-admin";

export const dynamic = "force-dynamic";

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const magnet = await getLeadMagnet(id).catch(() => null);
  if (!magnet) return <NotFound title="Lead magnet" link="/heroshima/conversions/new?type=magnet" buttonType="link" />;
  return (
    <div className="w-full min-h-screen p-4">
      <Link href="/heroshima/conversions" className="text-sm font-semibold text-gray-600 hover:text-[#222325]">
        ← All conversions
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold">Edit lead magnet</h1>
      <LeadMagnetForm initial={magnet} />
    </div>
  );
};

export default Page;
