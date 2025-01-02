import { PlusCircle } from "lucide-react";
import AdminJobTile from "@/app/components/ADMIN/AdminJobTile";
import { auth } from "@/auth";
import { getAdminDashboardInfo } from "@/libs/query";
import Link from "next/link";

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
  const ADMIN_DASHBOARD_INFO = await getAdminDashboardInfo();
  return (
    <div className="w-full h-screen overflow-y-scroll">
      <main className="p-4">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white shadow rounded-lg h-[8rem]">
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Total Jobs</h2>
              <p className="text-3xl font-bold">{ADMIN_DASHBOARD_INFO.jobsCount}</p>
            </div>
            <div className="p-4 bg-white shadow rounded-lg h-[8rem]">
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Total Companies</h2>
              <p className="text-3xl font-bold">{ADMIN_DASHBOARD_INFO.companiesCount}</p>
            </div>
            <div className="p-4 bg-white shadow rounded-lg h-[8rem]">
              <h2 className="text-xl font-semibold text-slate-800 mb-1">Total Blogs</h2>
              <p className="text-3xl font-bold">{ADMIN_DASHBOARD_INFO.blogsCount}</p>
            </div>
          </div>
          <div className="w-full mt-6 bg-transparent border-none">
            <h2 className="text-xl font-semibold mb-4">Latest Job Posted</h2>
            {ADMIN_DASHBOARD_INFO.latestJob && <AdminJobTile jobDetail={ADMIN_DASHBOARD_INFO.latestJob} />}
          </div>
        </section>
        <section className="flex justify-center transition-all">
          <Link
            href={"/heroshima/jobs/create"}
            className="flex items-center px-6 py-4 group bg-primary text-white outline outline-2 outline-primary font-bold rounded-md drop-shadow-primary2-hover transition-all">
            <PlusCircle className="w-6 h-6 mr-2 group-hover:scale-90" />
            Create more jobs
          </Link>
        </section>
      </main>
    </div>
  );
}
