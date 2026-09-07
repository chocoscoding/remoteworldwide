import Link from "next/link";
import NotFound from "@/app/components/NotFound";
import CtaForm from "@/app/components/ADMIN/blog/CtaForm";
import { getCta } from "@/libs/blog-admin";

export const dynamic = "force-dynamic";

const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const cta = await getCta(id).catch(() => null);
  if (!cta) return <NotFound title="CTA" link="/heroshima/conversions/new?type=cta" buttonType="link" />;
  return (
    <div className="w-full min-h-screen p-4">
      <Link href="/heroshima/conversions" className="text-sm font-semibold text-gray-600 hover:text-[#222325]">
        ← All conversions
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-bold">Edit call-to-action</h1>
      <CtaForm initial={cta} />
    </div>
  );
};

export default Page;
