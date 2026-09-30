import Link from "next/link";
import NotFound from "@/app/components/NotFound";
import RecommendationForm from "@/app/components/ADMIN/recommendations/RecommendationForm";
import { getAdminRecommendation } from "@/libs/recommendations-admin";

export const dynamic = "force-dynamic";

// One recommendation: edit the facts, the questions (until answered), the
// stage and the outcome, or delete it. Params are async in this Next.
const Page = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const recommendation = await getAdminRecommendation(id).catch(() => null);
  if (!recommendation) return <NotFound title="Recommendation" link="/heroshima/recommendations/create" buttonType="link" />;
  const who = recommendation.candidate?.name ?? recommendation.candidate?.email ?? "Deleted account";
  return (
    <div className="w-full min-h-screen p-4">
      <Link href="/heroshima/recommendations" className="text-sm font-semibold text-gray-600 hover:text-[#222325]">
        ← All recommendations
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-bold">
        {who} → {recommendation.company}
      </h1>
      <p className="mb-5 text-sm text-gray-500">
        {recommendation.role} · put forward by {recommendation.reviewer.name}
      </p>
      <RecommendationForm initial={recommendation} />
    </div>
  );
};

export default Page;
