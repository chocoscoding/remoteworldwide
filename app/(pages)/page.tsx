import Header from "@/app/components/Header";
import JobTile from "@/app/components/main/JobTile";

export default function Home() {
  return (
    <div>
      <Header />
      <br />
      <section className="w-full max-w-[1000px] m-auto px-3 lg:px-0">
        <h2 className="text-2xl md:text-3xl font-bold">Explore latest and exiciting jobs now</h2>
        <br />

        <JobTile />
        <JobTile />
        <JobTile />
        <div className="w-full flex justify-center">
          <button className="bg-secondary text-primary px-20 py-4 text-lg font-bold">View all jobs</button>
        </div>
      </section>
      <br />
    </div>
  );
}
