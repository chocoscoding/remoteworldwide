import Link from "next/link";
import RecommendationForm from "@/app/components/ADMIN/recommendations/RecommendationForm";

// Putting a candidate in front of a company. The form's server actions forward
// the admin session; the backend's isAdmin is what actually guards the write.
const Page = () => (
  <div className="w-full min-h-screen p-4">
    <Link href="/heroshima/recommendations" className="text-sm font-semibold text-gray-600 hover:text-[#222325]">
      ← All recommendations
    </Link>
    <h1 className="mb-1 mt-2 text-2xl font-bold">New recommendation</h1>
    <p className="mb-5 text-sm text-gray-500">The candidate sees it on their Recommendations screen straight away, and gets a line in their bell.</p>
    <RecommendationForm />
  </div>
);

export default Page;
