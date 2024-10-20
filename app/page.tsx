import Header from "@/app/components/Header";
import JobTile from "./components/jobs/JobTile";

export default function Home() {
  return (
    <div>
      <Header />
      <br />
      <section className="w-full max-w-[1000px] m-auto">
        <h2 className="border text-2xl md:text-3xl font-bold">Explore latest and exiciting jobs now</h2>

        <JobTile />
        <JobTile />
        <JobTile />
        <button className="">View all</button>
      </section>
      <br />
    </div>
  );
}
