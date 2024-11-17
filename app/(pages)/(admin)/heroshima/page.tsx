import { PlusCircle } from "lucide-react";
import AdminJobTile from "@/app/components/ADMIN/AdminJobTile";
import { auth } from "@/auth";

const dummyData = {
  totalJobs: 120,
  totalCompanies: 45,
  latestJob: {
    title: "Senior Frontend Developer",
    company: "Tech Corp",
    postedDate: "2023-10-01",
  },
};

export default async function AdminAnalytics() {
  const session = await auth();

  if (session !== null && session.user?.role === "AUTHOR") {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <main className="p-8 bg-white shadow-lg rounded-lg text-center">
          <h1 className="text-3xl font-bold mb-4">Welcome to the Authors Admin Panel</h1>
          <p className="mb-4 text-lg">Click the sidebar to visit other pages.</p>
        </main>
      </div>
    );
  }
  return (
    <div className="w-full h-screen overflow-y-scroll">
      <main className="p-4">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[10rem]">
            <div className="p-4 bg-white shadow rounded-lg">
              <h2 className="text-xl font-semibold">Total Jobs</h2>
              <p className="text-3xl font-bold">{dummyData.totalJobs}</p>
            </div>
            <div className="p-4 bg-white shadow rounded-lg">
              <h2 className="text-xl font-semibold">Total Companies</h2>
              <p className="text-3xl font-bold">{dummyData.totalCompanies}</p>
            </div>
          </div>
          <div className="w-full mt-6 bg-transparent border-none">
            <h2 className="text-xl font-semibold mb-4">Latest Job Posted</h2>
            <AdminJobTile />
          </div>
        </section>
        <section className="flex justify-center">
          <button className="flex items-center px-6 py-3 bg-black text-white font-bold rounded-sm ">
            <PlusCircle className="w-6 h-6 mr-2" />
            Create New Job
          </button>
        </section>
      </main>
    </div>
  );
}
